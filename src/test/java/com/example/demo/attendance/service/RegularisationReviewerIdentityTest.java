package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.RegularisationRequestDto;
import com.example.demo.attendance.dto.RegularisationSubmitRequest;
import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.entity.AttendanceRegularisationRequest;
import com.example.demo.attendance.repository.AttendanceRegularisationRequestRepository;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.repository.UserRepository;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.notification.service.NotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegularisationReviewerIdentityTest {
    @Mock AttendanceRegularisationRequestRepository requestRepository;
    @Mock AttendanceRepository attendanceRepository;
    @Mock EmployeeRepository employeeRepository;
    @Mock UserRoleRepository userRoleRepository;
    @Mock UserRepository userRepository;
    @Mock AttendanceService attendanceService;
    @Mock NotificationService notificationService;
    @Mock com.example.demo.employee.service.ReportingManagerService reportingManagers;
    @InjectMocks AttendanceRegularisationService service;
    AttendanceRegularisationRequest request;
    User reviewer;
    Company company;

    @BeforeEach void setup() {
        company = new Company(); company.setId(55L);
        var employee = new Employee(); employee.setId(1L); employee.setCompany(company); employee.setFirstName("Employee");
        request = new AttendanceRegularisationRequest(); request.setId(12L); request.setCompany(company); request.setEmployee(employee);
        request.setStatus(AttendanceRegularisationRequest.RequestStatus.PENDING);
        request.setRequestType(AttendanceRegularisationRequest.RequestType.MISSING_PUNCH);
        request.setRequestDate(LocalDate.of(2026, 10, 2));
        reviewer = new User(); reviewer.setId(126L); reviewer.setFirstName("Reviewing"); reviewer.setLastName("Admin"); reviewer.setUsername("admin");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(126L,55L,UserRole.AccessScope.ENTERPRISE,List.of(55L)));
        lenient().when(requestRepository.findById(12L)).thenReturn(Optional.of(request));
    }

    private void validReviewer() {
        when(userRepository.findById(126L)).thenReturn(Optional.of(reviewer));
        when(employeeRepository.findByUserId(126L)).thenReturn(Optional.empty());
        when(requestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }
    @AfterEach void clear() { AccessScopeContext.clear(); }

    @Test void bothLatePunchesCanBeExplainedButEachOnlyOnceWhilePending() {
        var record = new Attendance();
        record.setId(30L);
        record.setCompany(company);
        record.setEmployee(request.getEmployee());
        record.setAttendanceDate(LocalDate.now(ZoneId.of("Asia/Dubai")));
        record.setAttendanceStatus(Attendance.AttendanceQualityStatus.REGULAR);
        var shift = new ShiftSchedule();
        shift.setStartTime(LocalTime.of(9, 0));
        shift.setEndTime(LocalTime.of(18, 0));
        record.setShift(shift);
        record.setCheckIn(LocalTime.of(9, 5));
        record.setCheckOut(LocalTime.of(18, 10));
        record.setCheckOutDate(record.getAttendanceDate());
        request.setAttendance(record);
        request.setRequestType(AttendanceRegularisationRequest.RequestType.LATE_CHECK_IN_REASON);
        when(attendanceRepository.findById(30L)).thenReturn(Optional.of(record));
        when(employeeRepository.findByUserId(126L)).thenReturn(Optional.of(request.getEmployee()));
        when(attendanceService.attendanceRequired(any(), any())).thenReturn(true);
        when(requestRepository.findByAttendanceId(30L)).thenReturn(List.of(request));
        when(requestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var payload = new RegularisationSubmitRequest();
        payload.setAttendanceId(30L);
        payload.setRequestType("LATE_CHECK_OUT_REASON");
        payload.setReason("Finished a client call");
        assertThat(service.submitRequest(payload, 126L).getRequestType()).isEqualTo("LATE_CHECK_OUT_REASON");

        payload.setRequestType("LATE_CHECK_IN_REASON");
        assertThatThrownBy(() -> service.submitRequest(payload, 126L))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("already been submitted");
    }

    @Test void adminWithoutLocalEmployeeCanApproveWithUserAuditIdentity() {
        validReviewer(); when(attendanceService.attendanceRequired(any(),any())).thenReturn(true);
        var result = service.approve(12L,"Verified",126L);
        assertThat(result.getStatus()).isEqualTo("APPROVED");
        assertThat(request.getHrApprovedBy()).isNull();
        assertThat(result.getHrApprovedById()).isNull();
        assertThat(result.getHrApprovedByUserId()).isEqualTo(126L);
        assertThat(result.getHrApprovedByName()).isEqualTo("Reviewing Admin");
        assertThat(request.getHrApprovedAt()).isNotNull();
        verify(attendanceService).applyRegularisationApproval(request);
        verify(employeeRepository,never()).save(any());
    }

    @Test void adminWithoutLocalEmployeeCanRejectWithUserAuditIdentity() {
        validReviewer();
        var result = service.reject(12L,"Evidence not sufficient",126L);
        assertThat(result.getStatus()).isEqualTo("REJECTED");
        assertThat(request.getRejectedBy()).isNull();
        assertThat(result.getRejectedByUserId()).isEqualTo(126L);
        assertThat(result.getRejectedByName()).isEqualTo("Reviewing Admin");
        assertThat(request.getRejectedAt()).isNotNull();
        verify(attendanceService,never()).applyRegularisationApproval(any());
    }

    @Test void localManagerEmployeeLinkIsRetainedSeparatelyFromUserId() {
        when(userRepository.findById(126L)).thenReturn(Optional.of(reviewer));
        var manager = new Employee(); manager.setId(7L); manager.setCompany(company);
        when(employeeRepository.findByUserId(126L)).thenReturn(Optional.of(manager));
        when(requestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(attendanceService.attendanceRequired(any(),any())).thenReturn(true);
        var result = service.approve(12L,null,126L);
        assertThat(result.getHrApprovedById()).isEqualTo(7L);
        assertThat(result.getHrApprovedByUserId()).isEqualTo(126L);
    }

    @Test void anotherBranchEmployeeIsNotLinkedAsThisCompanyReviewer() {
        when(userRepository.findById(126L)).thenReturn(Optional.of(reviewer));
        var other = new Company(); other.setId(56L);
        var employee = new Employee(); employee.setId(7L); employee.setCompany(other);
        when(employeeRepository.findByUserId(126L)).thenReturn(Optional.of(employee));
        when(requestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(service.reject(12L,"Reviewed",126L).getRejectedById()).isNull();
        assertThat(request.getRejectedByUserId()).isEqualTo(126L);
    }

    @Test void outOfCompanyApprovalIsDeniedBeforeReviewerLookupOrSave() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(126L,56L,UserRole.AccessScope.ENTERPRISE,List.of(56L)));
        assertThatThrownBy(() -> service.approve(12L,null,126L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(userRepository,employeeRepository);
        verify(requestRepository,never()).save(any());
    }

    @Test void mismatchedSelectedCompanyIsDeniedEvenWhenAnotherCompanyIsAccessible() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(126L,55L,UserRole.AccessScope.ENTERPRISE,List.of(55L,56L),null,56L));
        assertThatThrownBy(() -> service.reject(12L,"Reviewed",126L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(userRepository,employeeRepository);
    }

    @Test void actorCannotBeSpoofedThroughServiceParameter() {
        assertThatThrownBy(() -> service.reject(12L,"Reviewed",999L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(userRepository,employeeRepository);
        verify(requestRepository,never()).save(any());
    }

    @Test void inactiveOrMissingUserCannotReview() {
        reviewer.setActive(false);
        when(userRepository.findById(126L)).thenReturn(Optional.of(reviewer));
        assertThatThrownBy(() -> service.reject(12L,"Reviewed",126L)).isInstanceOf(AccessDeniedException.class);
        verify(requestRepository,never()).save(any());
    }

    @Test void rejectionStillRequiresReasonAndCompletedRequestsCannotBeReviewedAgain() {
        assertThatThrownBy(() -> service.reject(12L," ",126L)).isInstanceOf(BadRequestException.class);
        request.setStatus(AttendanceRegularisationRequest.RequestStatus.APPROVED);
        assertThatThrownBy(() -> service.approve(12L,null,126L)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(userRepository,employeeRepository);
        verify(requestRepository,never()).save(any());
    }

    @Test void historicalEmployeeOnlyRecordsKeepExistingDisplayAndId() {
        var employee = new Employee(); employee.setId(7L); employee.setFirstName("Historical"); employee.setLastName("Manager");
        request.setHrApprovedBy(employee); request.setRejectedBy(employee);
        var result = RegularisationRequestDto.from(request);
        assertThat(result.getHrApprovedById()).isEqualTo(7L);
        assertThat(result.getHrApprovedByName()).isEqualTo("Historical Manager");
        assertThat(result.getHrApprovedByUserId()).isNull();
        assertThat(result.getRejectedByName()).isEqualTo("Historical Manager");
    }

    @Test void nameSnapshotTakesPriorityAndUsernameIsFallbackWhenNoPersonalName() {
        reviewer.setFirstName(null); reviewer.setLastName(null);
        validReviewer();
        var result = service.reject(12L,"Reviewed",126L);
        assertThat(result.getRejectedByName()).isEqualTo("admin");
        reviewer.setUsername("changed-later");
        assertThat(RegularisationRequestDto.from(request).getRejectedByName()).isEqualTo("admin");
    }
}
