package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.RegularisationRequestDto;
import com.example.demo.attendance.dto.RegularisationSubmitRequest;
import com.example.demo.attendance.dto.UnresolvedIrregularAttendanceDto;
import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.entity.AttendanceRegularisationRequest;
import com.example.demo.attendance.entity.AttendanceRegularisationRequest.RequestStatus;
import com.example.demo.attendance.entity.AttendanceRegularisationRequest.RequestType;
import com.example.demo.attendance.repository.AttendanceRegularisationRequestRepository;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.auth.entity.Role;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.repository.UserRepository;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.service.ReportingManagerService;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceRegularisationService {

    private final AttendanceRegularisationRequestRepository requestRepository;
    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;
    private final AttendanceService attendanceService;
    private final NotificationService notificationService;
    private final ReportingManagerService reportingManagers;

    private static final List<Role.RoleName> ADMIN_APPROVER_ROLES = List.of(
            Role.RoleName.BRANCH_ADMIN, Role.RoleName.ENTERPRISE_ADMIN,
            Role.RoleName.PLATFORM_SUPER_ADMIN, Role.RoleName.HR_MANAGER
    );

    private static final ZoneId DUBAI_ZONE = ZoneId.of("Asia/Dubai");
    private static final int REGULARISATION_LOOKBACK_MONTHS = 1;

    /** Request types allowed when there is no backing attendance row yet (Absent/On Leave/Holiday/Week Off) —
     *  all of them amount to "I was actually present that day", proven by a check-in time. */
    private static final List<RequestType> NO_ATTENDANCE_REQUEST_TYPES = List.of(
            RequestType.MISSING_PUNCH, RequestType.WORK_FROM_HOME, RequestType.OFFICIAL_DUTY);

    // ─── Employee: Submit Request ─────────────────────────────────────────────

    @Transactional
    public RegularisationRequestDto submitRequest(RegularisationSubmitRequest req, Long submittingUserId) {
        if (req == null) {
            throw new BadRequestException("Request body is required");
        }
        if (req.getRequestType() == null || req.getRequestType().isBlank()) {
            throw new BadRequestException("Request type is required");
        }
        if (req.getReason() == null || req.getReason().isBlank()) {
            throw new BadRequestException("Reason is required");
        }
        RequestType requestType;
        try {
            requestType = RequestType.valueOf(req.getRequestType());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid request type: " + req.getRequestType());
        }

        // Normally the submitter is filing for themselves. When employeeId is set, an HR/Admin
        // (authority already checked in the controller) is filing on behalf of that employee instead.
        Employee employee = req.getEmployeeId() != null
                ? employeeRepository.findById(req.getEmployeeId())
                        .orElseThrow(() -> new ResourceNotFoundException("Employee", req.getEmployeeId()))
                : employeeRepository.findByUserId(submittingUserId)
                        .orElseThrow(() -> new ResourceNotFoundException("Employee for user", submittingUserId));

        if (req.getAttendanceId() == null) {
            return submitNoAttendanceRequest(req, employee, requestType);
        }

        Attendance att = attendanceRepository.findById(req.getAttendanceId())
                .orElseThrow(() -> new ResourceNotFoundException("Attendance", req.getAttendanceId()));

        boolean reviewRequest = requestType.isLatePunchReason() || requestType == RequestType.OVERTIME_REQUEST
                || (requestType == RequestType.WORKING_HOURS_CORRECTION && Boolean.TRUE.equals(att.getCheckoutNeedsReview()))
                || (requestType == RequestType.MISSING_PUNCH && OvertimeReview.missingCheckout(att, LocalDate.now(DUBAI_ZONE)));
        if (!reviewRequest && att.getAttendanceStatus() != Attendance.AttendanceQualityStatus.IRREGULAR) {
            throw new BadRequestException("Only IRREGULAR attendance records can be regularised");
        }

        // Ownership check — the attendance row must belong to the target employee (self, unless
        // an HR/Admin explicitly filed on someone else's behalf via employeeId above).
        if (!att.getEmployee().getId().equals(employee.getId())) {
            throw new BadRequestException("You can only submit requests for your own attendance");
        }
        validateRequestDate(att.getAttendanceDate(), LocalDate.now(DUBAI_ZONE));
        if (!attendanceService.attendanceRequired(employee, att.getAttendanceDate()))
            throw new BadRequestException("Attendance regularisation is not needed on an exempt date");

        var previousRequests = requestRepository.findByAttendanceId(att.getId());
        if (requestType.isLatePunchReason()) {
            if (req.getReason() == null || req.getReason().isBlank()) {
                throw new BadRequestException("Enter a reason, or dismiss the prompt to submit it later.");
            }
            if (previousRequests.stream().anyMatch(r -> r.getRequestType() == requestType
                    && r.getStatus() != RequestStatus.REJECTED)) {
                throw new BadRequestException("A reason has already been submitted for this punch");
            }
        } else if (previousRequests.stream().anyMatch(r -> r.getStatus() == RequestStatus.PENDING
                && (r.getRequestType() == null || !r.getRequestType().isLatePunchReason()))) {
            throw new BadRequestException("A regularisation request is already pending for this attendance");
        }

        validateRequestAgainstAttendance(att, requestType, req.getRequestedCheckIn(),
                req.getRequestedCheckOut(), req.getRequestedOvertimeHours());

        AttendanceRegularisationRequest request = new AttendanceRegularisationRequest();
        request.setAttendance(att);
        request.setEmployee(employee);
        request.setCompany(att.getCompany());
        request.setRequestType(requestType);
        request.setReason(req.getReason());
        request.setAttachmentUrl(req.getAttachmentUrl());
        request.setRequestedCheckIn(req.getRequestedCheckIn());
        request.setRequestedCheckOut(req.getRequestedCheckOut());
        request.setRequestedOvertimeHours(req.getRequestedOvertimeHours());
        request.setStatus(RequestStatus.PENDING);

        AttendanceRegularisationRequest saved = requestRepository.save(request);

        // Update attendance quick-flag
        att.setRegularisationStatus(Attendance.RegularisationStatus.HAS_PENDING);
        attendanceRepository.save(att);

        // Notify company admins/HR managers
        notifyAdmins(saved, employee);

        return RegularisationRequestDto.from(saved);
    }

    /** Submit a regularisation request for a day with no attendance row yet
     *  (currently displayed as Absent / On Leave / Holiday / Week Off). */
    private RegularisationRequestDto submitNoAttendanceRequest(
            RegularisationSubmitRequest req, Employee employee, RequestType requestType) {
        if (req.getAttendanceDate() == null) {
            throw new BadRequestException("Attendance date is required");
        }
        validateRequestDate(req.getAttendanceDate(), LocalDate.now(DUBAI_ZONE));
        if (!attendanceService.attendanceRequired(employee, req.getAttendanceDate()))
            throw new BadRequestException("Attendance regularisation is not needed on an exempt date");
        if (!NO_ATTENDANCE_REQUEST_TYPES.contains(requestType)) {
            throw new BadRequestException("This request type requires an existing attendance record");
        }
        if (req.getRequestedCheckIn() == null) {
            throw new BadRequestException("Enter the check-in time");
        }
        if (attendanceRepository.findByEmployeeIdAndAttendanceDate(employee.getId(), req.getAttendanceDate()).isPresent()) {
            throw new BadRequestException("An attendance record already exists for this date");
        }
        if (requestRepository.existsByEmployeeIdAndRequestDateAndStatus(
                employee.getId(), req.getAttendanceDate(), RequestStatus.PENDING)) {
            throw new BadRequestException("A regularisation request is already pending for this date");
        }

        AttendanceRegularisationRequest request = new AttendanceRegularisationRequest();
        request.setEmployee(employee);
        request.setCompany(employee.getCompany());
        request.setRequestDate(req.getAttendanceDate());
        request.setRequestType(requestType);
        request.setReason(req.getReason());
        request.setAttachmentUrl(req.getAttachmentUrl());
        request.setRequestedCheckIn(req.getRequestedCheckIn());
        request.setRequestedCheckOut(req.getRequestedCheckOut());
        request.setStatus(RequestStatus.PENDING);

        AttendanceRegularisationRequest saved = requestRepository.save(request);
        notifyAdmins(saved, employee);
        return RegularisationRequestDto.from(saved);
    }

    // ─── Admin/HR Manager: Approve ────────────────────────────────────────────

    @Transactional
    public RegularisationRequestDto approve(Long requestId, String remarks, Long approverUserId) {
        AttendanceRegularisationRequest request = findRequest(requestId);
        requireCompanyAccess(request.getCompany().getId());

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new BadRequestException("Request is not pending approval");
        }
        if (request.getRequestType() == RequestType.OVERTIME_REQUEST && request.getEmployee().getUser() != null
                && java.util.Objects.equals(request.getEmployee().getUser().getId(), approverUserId))
            throw new AccessDeniedException("You cannot approve your own overtime request");
        if (!attendanceService.attendanceRequired(request.getEmployee(), effectiveDate(request)))
            throw new BadRequestException("Attendance regularisation is not needed on an exempt date");
        if (request.getAttendance() != null) {
            validateRequestAgainstAttendance(request.getAttendance(), request.getRequestType(),
                    request.getRequestedCheckIn(), request.getRequestedCheckOut(),
                    request.getRequestedOvertimeHours());
        }

        User reviewer = reviewerUser(approverUserId);
        Employee approverEmployee = reviewerEmployee(approverUserId, request.getCompany().getId());
        request.setHrApprovedBy(approverEmployee);
        request.setHrApprovedByUserId(reviewer.getId());
        request.setHrApprovedByUserName(reviewerName(reviewer));
        request.setHrApprovedAt(LocalDateTime.now());
        request.setHrRemarks(remarks);
        request.setStatus(RequestStatus.APPROVED);

        AttendanceRegularisationRequest saved = requestRepository.save(request);

        // Apply effect on attendance record (creates the attendance row first if none exists yet)
        attendanceService.applyRegularisationApproval(saved);
        if (request.getRequestType().isLatePunchReason()) {
            resetAttendanceRegularisationFlag(saved.getAttendance());
        } else if (saved.getAttendance() != null && requestRepository.findByAttendanceId(saved.getAttendance().getId())
                .stream().anyMatch(r -> r.getStatus() == RequestStatus.PENDING)) {
            saved.getAttendance().setRegularisationStatus(Attendance.RegularisationStatus.HAS_PENDING);
            attendanceRepository.save(saved.getAttendance());
        }

        notifyEmployee(request.getEmployee(), saved,
                Notification.NotificationType.REGULARISATION_APPROVED,
                "Regularisation Request: Approved",
                "Your regularisation request for " + effectiveDate(request)
                        + (request.getRequestType().isLatePunchReason()
                        ? " has been approved and the day is now regularised. Your punch times and overtime are unchanged."
                        : " has been approved. Your attendance record has been updated."));

        return RegularisationRequestDto.from(saved);
    }

    private void validateRequestAgainstAttendance(
            Attendance att,
            RequestType requestType,
            java.time.LocalTime requestedCheckIn,
            java.time.LocalTime requestedCheckOut,
            Double requestedOvertimeHours) {
        var shift = att.getShift();
        int graceMinutes = attendanceService.resolveGraceMinutes(att);

        boolean missingPunch = att.getCheckIn() == null || att.getCheckOut() == null;
        boolean lateArrival = shift != null && shift.getStartTime() != null && att.getCheckIn() != null
                && att.getCheckIn().isAfter(shift.getStartTime().plusMinutes(graceMinutes));
        boolean earlyCheckout = shift != null && shift.getEndTime() != null && att.getCheckOut() != null
                && att.getCheckOut().isBefore(shift.getEndTime().minusMinutes(graceMinutes));
        double workedHours = att.getWorkedHour() != null ? att.getWorkedHour() : 0.0;
        double minimumHours = att.getMinimumHour() != null ? att.getMinimumHour() : 0.0;
        boolean shortHours = minimumHours > 0 && workedHours < minimumHours;

        switch (requestType) {
            case LATE_CHECK_IN_REASON -> {
                if (!OvertimeReview.lateCheckIn(att))
                    throw new BadRequestException("A late check-in reason requires a check-in after the scheduled start.");
            }
            case LATE_CHECK_OUT_REASON -> {
                if (OvertimeReview.lateCheckoutSeconds(att) <= 0)
                    throw new BadRequestException("A late checkout reason requires a checkout after the scheduled end.");
            }
            case LATE_ARRIVAL -> {
                if (!lateArrival) {
                    throw new BadRequestException("Late Arrival can only be selected when check-in is after the assigned shift start time.");
                }
            }
            case MISSING_PUNCH -> {
                if (!missingPunch) {
                    throw new BadRequestException("Missing Punch can only be selected when check-in or check-out is missing.");
                }
                if (requestedCheckIn == null && requestedCheckOut == null) {
                    throw new BadRequestException("Enter the missing check-in or check-out time.");
                }
            }
            case WORKING_HOURS_CORRECTION -> {
                if (!earlyCheckout && !shortHours && !lateArrival && !Boolean.TRUE.equals(att.getCheckoutNeedsReview())) {
                    throw new BadRequestException("Working Hours Correction requires a late arrival, early checkout, or short-hours record.");
                }
                if (requestedCheckIn == null && requestedCheckOut == null) {
                    throw new BadRequestException("Enter the corrected check-in or check-out time.");
                }
            }
            case OVERTIME_REQUEST -> {
                if (missingPunch || requestedOvertimeHours == null || !Double.isFinite(requestedOvertimeHours)
                        || requestedOvertimeHours <= 0)
                    throw new BadRequestException("Overtime requires both punches and a positive number of hours.");
                if (attendanceService.usesOvertimeReview(att)) {
                    int eligible = java.util.Optional.ofNullable(att.getReviewableOvertimeSeconds()).orElse(0);
                    if (eligible <= 0 || Math.round(requestedOvertimeHours * 3600) > eligible
                            || Math.round(requestedOvertimeHours * 3600) <= 0)
                        throw new BadRequestException("Requested overtime exceeds the eligible time on this attendance.");
                    return;
                }
                double eligibleOvertime = Math.max(0.0, workedHours - minimumHours);
                if (shift != null && shift.getEndTime() != null && att.getCheckOut() != null
                        && att.getCheckOut().isAfter(shift.getEndTime())) {
                    eligibleOvertime = Math.max(eligibleOvertime,
                            ChronoUnit.MINUTES.between(shift.getEndTime(), att.getCheckOut()) / 60.0);
                }
                if (requestedOvertimeHours == null || requestedOvertimeHours <= 0) {
                    throw new BadRequestException("Enter overtime hours greater than zero.");
                }
                if (eligibleOvertime <= 0) {
                    throw new BadRequestException("Overtime Request is not allowed because this attendance has no overtime worked.");
                }
                if (requestedOvertimeHours > eligibleOvertime + 0.01) {
                    throw new BadRequestException(String.format(
                            "Requested overtime exceeds the %.2f hours supported by this attendance.", eligibleOvertime));
                }
            }
            case WRONG_STATUS -> {
                if (missingPunch) {
                    throw new BadRequestException("Use Missing Punch when check-in or check-out is absent.");
                }
            }
            default -> {
                // These request types depend on business context and approver evidence,
                // not solely on punch timestamps.
            }
        }
    }

    // ─── Admin/HR Manager: Reject ─────────────────────────────────────────────

    @Transactional
    public RegularisationRequestDto reject(Long requestId, String remarks, Long approverUserId) {
        AttendanceRegularisationRequest request = findRequest(requestId);
        requireCompanyAccess(request.getCompany().getId());

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new BadRequestException("Request is not pending approval");
        }
        requireRemarks(remarks, "Rejection reason is required");

        User reviewer = reviewerUser(approverUserId);
        Employee approverEmployee = reviewerEmployee(approverUserId, request.getCompany().getId());
        request.setRejectedBy(approverEmployee);
        request.setRejectedByUserId(reviewer.getId());
        request.setRejectedByUserName(reviewerName(reviewer));
        request.setRejectedAt(LocalDateTime.now());
        request.setRejectionRemarks(remarks);
        request.setStatus(RequestStatus.REJECTED);

        AttendanceRegularisationRequest saved = requestRepository.save(request);
        resetAttendanceRegularisationFlag(request.getAttendance());

        notifyEmployee(request.getEmployee(), saved,
                Notification.NotificationType.REGULARISATION_REJECTED,
                "Regularisation Request: Rejected",
                "Your regularisation request for " + effectiveDate(request)
                        + " was rejected."
                        + (remarks != null ? " Reason: " + remarks : ""));

        return RegularisationRequestDto.from(saved);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RegularisationRequestDto> getPendingApproval(Long companyId) {
        requireCompanyAccess(companyId);
        return requestRepository.findPendingApproval(companyId)
                .stream().map(RegularisationRequestDto::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UnresolvedIrregularAttendanceDto> getUnresolvedForEmployee(Long userId) {
        Employee employee = employeeRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee for user", userId));
        LocalDate today = LocalDate.now(DUBAI_ZONE);
        return attendanceRepository.findByEmployeeIdAndAttendanceDateBetween(
                        employee.getId(), today.minusMonths(REGULARISATION_LOOKBACK_MONTHS), today)
                .stream()
                .filter(a -> a.getRegularisationStatus() != Attendance.RegularisationStatus.HAS_PENDING
                        && (a.getAttendanceStatus() == Attendance.AttendanceQualityStatus.IRREGULAR
                                && a.getRegularisationStatus() == Attendance.RegularisationStatus.NONE
                            || Boolean.TRUE.equals(a.getCheckoutNeedsReview())
                            || OvertimeReview.missingCheckout(a, today)))
                .filter(a -> attendanceService.attendanceRequired(employee, a.getAttendanceDate()))
                .map(UnresolvedIrregularAttendanceDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RegularisationRequestDto> getMyRequests(Long userId) {
        Employee employee = employeeRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee for user", userId));
        return requestRepository.findByEmployeeIdOrderByCreatedAtDesc(employee.getId())
                .stream().map(RegularisationRequestDto::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RegularisationRequestDto> getAllForCompany(Long companyId) {
        requireCompanyAccess(companyId);
        return requestRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                .stream().map(RegularisationRequestDto::from).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RegularisationRequestDto getById(Long requestId) {
        AttendanceRegularisationRequest request = findRequest(requestId);
        requireCompanyAccess(request.getCompany().getId());
        AccessScopeContext.ScopeData scope = AccessScopeContext.get();
        if (scope.isSelfScope()
                && (request.getEmployee() == null || request.getEmployee().getUser() == null
                    || !scope.getUserId().equals(request.getEmployee().getUser().getId()))) {
            throw new AccessDeniedException("Employees can only view their own regularisation requests");
        }
        return RegularisationRequestDto.from(request);
    }

    @Transactional(readOnly = true)
    public long countPendingApproval(Long companyId) {
        requireCompanyAccess(companyId);
        return requestRepository.countPendingApproval(companyId);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private AttendanceRegularisationRequest findRequest(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RegularisationRequest", id));
    }

    private void requireCompanyAccess(Long companyId) {
        AccessScopeContext.ScopeData scope = AccessScopeContext.get();
        if (scope == null || companyId == null || !scope.canAccess(companyId)
                || (scope.getFilterCompanyId() != null && !scope.getFilterCompanyId().equals(companyId))) {
            throw new AccessDeniedException("You do not have access to this company's regularisation requests");
        }
    }

    private User reviewerUser(Long userId) {
        var scope = AccessScopeContext.get();
        if (scope == null || userId == null || !userId.equals(scope.getUserId())) {
            throw new AccessDeniedException("Reviewer must be the authenticated user");
        }
        return userRepository.findById(userId).filter(User::isActive)
                .orElseThrow(() -> new AccessDeniedException("An active reviewer account is required"));
    }

    private Employee reviewerEmployee(Long userId, Long companyId) {
        return employeeRepository.findByUserId(userId)
                .filter(employee -> employee.isActive() && employee.getCompany() != null
                        && companyId.equals(employee.getCompany().getId()))
                .orElse(null);
    }

    private String reviewerName(User reviewer) {
        String name = ((reviewer.getFirstName() == null ? "" : reviewer.getFirstName()) + " "
                + (reviewer.getLastName() == null ? "" : reviewer.getLastName())).trim();
        if (name.isBlank()) name = reviewer.getUsername();
        if (name == null || name.isBlank()) name = "User #" + reviewer.getId();
        return name.substring(0, Math.min(250, name.length()));
    }

    private void requireRemarks(String remarks, String message) {
        if (remarks == null || remarks.isBlank()) {
            throw new BadRequestException(message);
        }
    }

    /** The correction window is enforced on the server for every client. */
    static void validateRequestDate(LocalDate requestDate, LocalDate today) {
        if (requestDate == null) {
            throw new BadRequestException("Attendance date is required");
        }
        if (requestDate.isAfter(today)) {
            throw new BadRequestException("Attendance regularisation cannot be requested for a future date");
        }
        LocalDate earliest = today.minusMonths(REGULARISATION_LOOKBACK_MONTHS);
        if (requestDate.isBefore(earliest)) {
            throw new BadRequestException("Attendance regularisation can only be requested up to 1 month in the past");
        }
    }

    /** Reset attendance quick-flag when a request is rejected (no pending request anymore). */
    private void resetAttendanceRegularisationFlag(Attendance att) {
        if (att == null) return;
        // Check if any other pending request exists before clearing the flag
        boolean stillPending = requestRepository.findByAttendanceId(att.getId()).stream()
                .anyMatch(r -> r.getStatus() == RequestStatus.PENDING);
        var flag = stillPending ? Attendance.RegularisationStatus.HAS_PENDING
                : att.getAttendanceStatus() == Attendance.AttendanceQualityStatus.REGULARISED
                ? Attendance.RegularisationStatus.REGULARISED : Attendance.RegularisationStatus.NONE;
        if (att.getRegularisationStatus() != flag) {
            att.setRegularisationStatus(flag);
            attendanceRepository.save(att);
        }
    }

    /** Reporting relationships confer team approval, not a company-wide admin role. */
    Set<Long> notificationRecipients(AttendanceRegularisationRequest request, Employee employee) {
        Long companyId = request.getCompany().getId();
        Set<Long> recipients = new LinkedHashSet<>();
        for (Role.RoleName roleName : ADMIN_APPROVER_ROLES) {
            for (UserRole userRole : userRoleRepository.findByCompanyIdAndRoleName(companyId, roleName)) {
                recipients.add(userRole.getUser().getId());
            }
        }
        Employee manager = reportingManagers.resolve(employee);
        if (manager != null && manager.isActive() && manager.getCompany() != null
                && companyId.equals(manager.getCompany().getId())
                && !manager.getId().equals(employee.getId())
                && manager.getUser() != null && manager.getUser().isActive()) {
            recipients.add(manager.getUser().getId());
        }
        return recipients;
    }

    private void notifyAdmins(AttendanceRegularisationRequest request, Employee employee) {
        String message = fullName(employee)
                + " submitted a regularisation request for "
                + effectiveDate(request)
                + " (" + request.getRequestType().name().replace("_", " ") + ")";
        for (Long recipientUserId : notificationRecipients(request, employee)) {
            notificationService.send(
                    recipientUserId,
                    "New Regularisation Request",
                    message,
                    Notification.NotificationType.REGULARISATION_SUBMITTED,
                    "REGULARISATION_REQUEST",
                    request.getId(),
                    request.getCompany()
            );
        }
    }

    private static LocalDate effectiveDate(AttendanceRegularisationRequest r) {
        return r.getAttendance() != null ? r.getAttendance().getAttendanceDate() : r.getRequestDate();
    }

    private static String fullName(Employee e) {
        String first = e.getFirstName() != null ? e.getFirstName() : "";
        String last = e.getLastName() != null ? e.getLastName() : "";
        return (first + " " + last).trim();
    }

    private void notifyEmployee(Employee employee, AttendanceRegularisationRequest request,
                                 Notification.NotificationType type, String title, String message) {
        if (employee.getUser() == null) return;
        notificationService.send(
                employee.getUser().getId(),
                title,
                message,
                type,
                "REGULARISATION_REQUEST",
                request.getId(),
                request.getCompany()
        );
    }
}
