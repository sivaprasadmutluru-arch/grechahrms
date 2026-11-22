package com.example.demo.onboarding.service;

import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.service.ReportingManagerService;
import com.example.demo.leave.entity.*;
import com.example.demo.leave.repository.*;
import com.example.demo.leave.service.LeavePeriodResolver;
import com.example.demo.leave.service.LeaveAccrualService;
import com.example.demo.notification.repository.NotificationRepository;
import com.example.demo.onboarding.entity.*;
import com.example.demo.onboarding.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

@Service @RequiredArgsConstructor
public class ProbationConfirmationService {
    private final ProbationPolicyRepository policies;
    private final ProbationConfirmationRepository confirmations;
    private final ProbationEligibility eligibility;
    private final EmployeeRepository employees;
    private final com.example.demo.base.repository.CompanyRepository companies;
    private final LeaveTypeRepository leaveTypes;
    private final AvailableLeaveRepository balances;
    private final LeaveAllocationRepository allocations;
    private final ReportingManagerService reportingManagers;
    private final NotificationRepository notifications;
    private final LeaveAccrualService accruals;

    private static final String PROBATION_REVIEW = "PROBATION_REVIEW";

    public record PolicyView(Long companyId, boolean enabled, LocalDate effectiveFrom, int probationMonths) {}
    public record EmployeeView(Long employeeId, String employeeName, LocalDate joiningDate,
            LocalDate probationEndsOn, String status, LocalDate confirmedOn) {}

    private void requireCompany(Long companyId) {
        var scope = AccessScopeContext.get();
        if (scope == null || scope.isSelfScope()
                || scope.getScope() == com.example.demo.auth.entity.UserRole.AccessScope.DEPARTMENT
                || !scope.canAccess(companyId)
                || scope.getFilterCompanyId() != null && !scope.getFilterCompanyId().equals(companyId)) {
            throw new AccessDeniedException("You do not have access to this company's probation settings");
        }
        var company = companies.findById(companyId).orElseThrow(() -> new ResourceNotFoundException("Company", companyId));
        requireTenant(company);
    }

    private void requireTenant(com.example.demo.base.entity.Company company) {
        String schema = company.isHeadOffice() ? company.getSchemaName()
                : company.getParentCompany() == null ? null : company.getParentCompany().getSchemaName();
        if (schema == null || !schema.equals(com.example.demo.common.tenant.TenantContext.getTenant()))
            throw new AccessDeniedException("Select this company in the company switcher before managing its probation policy");
    }

    @Transactional(readOnly = true)
    public PolicyView policy(Long companyId) {
        requireCompany(companyId);
        var policy = policies.findByCompanyId(companyId).orElse(null);
        return new PolicyView(companyId, policy != null && policy.isEnabled(),
                policy == null ? null : policy.getEffectiveFrom(), 6);
    }

    @Transactional
    public PolicyView savePolicy(Long companyId, boolean enabled, LocalDate effectiveFrom) {
        requireCompany(companyId);
        if (effectiveFrom == null) throw new BadRequestException("Select the earliest joining date covered by this policy");
        var policy = policies.findByCompanyId(companyId).orElseGet(ProbationPolicy::new);
        // Changing the cohort after confirmations would reinterpret historical entitlement.
        if (policy.getId() != null && !Objects.equals(policy.getEffectiveFrom(), effectiveFrom)
                && !confirmations.findByCompanyId(companyId).isEmpty()) {
            throw new BadRequestException("The effective joining date cannot change after employees have been confirmed");
        }
        policy.setCompanyId(companyId);
        policy.setEnabled(enabled);
        policy.setEffectiveFrom(effectiveFrom);
        policies.save(policy);
        return new PolicyView(companyId, enabled, effectiveFrom, 6);
    }

    @Transactional(readOnly = true)
    public List<EmployeeView> list(Long companyId, LocalDate today) {
        requireCompany(companyId);
        var policy = policies.findByCompanyId(companyId).orElse(null);
        var confirmed = confirmations.findByCompanyId(companyId).stream()
                .collect(java.util.stream.Collectors.toMap(ProbationConfirmation::getEmployeeId, c -> c));
        return employees.findByCompanyIdAndIsActiveTrue(companyId).stream().map(employee -> {
            LocalDate joining = eligibility.joiningDate(employee);
            var confirmation = confirmed.get(employee.getId());
            boolean applies = eligibility.applies(policy, joining);
            LocalDate due = joining == null ? null : joining.plusMonths(6);
            String status = confirmation != null ? "CONFIRMED" : joining == null ? "JOINING_DATE_REQUIRED"
                    : !applies ? "NOT_COVERED" : due.isAfter(today) ? "ON_PROBATION"
                    : "PENDING_AUTOMATIC_CONFIRMATION";
            return new EmployeeView(employee.getId(), employeeName(employee), joining, due, status,
                    confirmation == null ? null : confirmation.getConfirmedOn());
        }).toList();
    }

    @Transactional
    public boolean confirmIfDue(Long companyId, Long employeeId, LocalDate today) {
        Employee employee = lockEmployee(employeeId);
        if (!Objects.equals(companyId, employee.getCompany().getId())) return false;
        requireTenant(employee.getCompany());
        LocalDate due = dueDate(employee, today);
        if (due == null || confirmations.findByEmployeeId(employeeId).isPresent()) return false;
        confirm(employee, due, today);
        return true;
    }

    /** Keep existing manager actions usable while the automatic job handles confirmation. */
    @Transactional
    public boolean confirmAsManager(Long companyId, Long employeeId, LocalDate today) {
        var scope = AccessScopeContext.get();
        if (scope == null || scope.getUserId() == null || !Objects.equals(companyId, scope.getCompanyId())
                || !scope.canAccess(companyId)) {
            throw new AccessDeniedException("Select the employee's company before confirming probation");
        }
        Employee employee = lockEmployee(employeeId);
        if (!Objects.equals(companyId, employee.getCompany().getId())
                || !scope.getUserId().equals(managerUserId(employee))) {
            throw new AccessDeniedException("Only the employee's current reporting manager can confirm probation");
        }
        requireTenant(employee.getCompany());
        if (confirmations.findByEmployeeId(employeeId).isPresent()) return false;
        LocalDate due = dueDate(employee, today);
        if (due == null)
            throw new BadRequestException("This employee is not yet eligible for probation confirmation");
        confirm(employee, due, today);
        return true;
    }

    private void confirm(Employee employee, LocalDate confirmedOn, LocalDate processedOn) {
        Long employeeId = employee.getId();
        Long companyId = employee.getCompany().getId();
        for (LeaveType type : leaveTypes.findAll()) {
            if (eligibility.applicableLeaveType(employee, type)) {
                provisionEntitlement(employee, type, confirmedOn, processedOn);
            }
        }
        ProbationConfirmation confirmation = new ProbationConfirmation();
        confirmation.setEmployeeId(employeeId);
        confirmation.setCompanyId(companyId);
        confirmation.setConfirmedOn(confirmedOn);
        confirmation.setProcessedOn(processedOn);
        confirmations.save(confirmation);
        accruals.processProbationAccrual(employeeId, processedOn);
        notifications.completeRelatedAction(companyId, PROBATION_REVIEW, employeeId, "PROBATION_CONFIRMED",
                "Probation confirmed", employeeName(employee) + " was confirmed effective " + confirmedOn + ".");
    }

    private Employee lockEmployee(Long employeeId) {
        return employees.findByIdForProbationConfirmation(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));
    }

    private LocalDate dueDate(Employee employee, LocalDate today) {
        if (!employee.isActive() || !employee.getCompany().isActive()
                || employee.getCompany().getStatus() != com.example.demo.base.entity.Company.CompanyStatus.ACTIVE) return null;
        var policy = policies.findByCompanyId(employee.getCompany().getId()).orElse(null);
        LocalDate joining = eligibility.joiningDate(employee);
        if (!eligibility.applies(policy, joining)) return null;
        LocalDate due = joining.plusMonths(6);
        return due.isAfter(today) ? null : due;
    }

    private Long managerUserId(Employee employee) {
        Employee manager = reportingManagers.resolve(employee);
        if (manager == null || !manager.isActive() || Objects.equals(manager.getId(), employee.getId())
                || manager.getCompany() == null || !Objects.equals(manager.getCompany().getId(), employee.getCompany().getId())
                || manager.getUser() == null || !manager.getUser().isActive()) return null;
        Long id = manager.getUser().getId();
        return employee.getUser() != null && Objects.equals(employee.getUser().getId(), id) ? null : id;
    }

    private static String employeeName(Employee employee) {
        return (Objects.toString(employee.getFirstName(), "") + " " + Objects.toString(employee.getLastName(), "")).trim();
    }

    private void provisionEntitlement(Employee employee, LeaveType type, LocalDate confirmedOn, LocalDate processedOn) {
        // Never overwrite used, imported, or previously credited balances.
        if (balances.findByEmployeeIdAndLeaveTypeId(employee.getId(), type.getId()).isPresent()) return;
        var period = LeavePeriodResolver.containing(type, processedOn);
        LocalDate allocationStart = confirmedOn.isBefore(period.start()) ? period.start() : confirmedOn;
        if (allocations.findByEmployeeIdAndLeaveTypeIdAndYear(employee.getId(), type.getId(), period.start().getYear()).isPresent()) return;
        boolean monthly = Boolean.TRUE.equals(type.getAccrualEnabled());
        double days = monthly ? 0 : upfrontDays(type, allocationStart, period);
        AvailableLeave balance = new AvailableLeave();
        balance.setEmployee(employee); balance.setLeaveType(type); balance.setAvailableDays(days);
        balance.setAssignedDate(allocationStart);
        if (Boolean.TRUE.equals(type.getReset())) balance.setResetDate(balance.computeNextResetDate(processedOn));
        if (type.getCarryforwardType() == LeaveType.CarryforwardType.CARRYFORWARD_EXPIRE)
            balance.setExpiredDate(type.getCarryforwardExpireDate());
        balances.save(balance);
        if (!monthly) {
            LeaveAllocation allocation = new LeaveAllocation();
            allocation.setEmployee(employee); allocation.setLeaveType(type); allocation.setCompany(employee.getCompany());
            allocation.setYear(period.start().getYear()); allocation.setTotalLeaveDays(days); allocation.setAvailableDays(days);
            allocation.setCarryforwardDays(0.0);
            allocations.save(allocation);
        }
    }

    static double upfrontDays(LeaveType type, LocalDate eligibleFrom, LeavePeriodResolver.Period period) {
        double annual = type.getTotalDays() == null ? 0 : Math.max(0, type.getTotalDays());
        if (type.getMidYearJoinerMode() != LeaveType.MidYearJoinerMode.AUTO_PRORATA) return annual;
        LocalDate start = eligibleFrom.isAfter(period.start()) ? eligibleFrom : period.start();
        if (start.isAfter(period.end())) return 0;
        boolean workingDays = type.getAccrualProrationBasis() == LeaveType.AccrualProrationBasis.WORKING_DAYS;
        long total = eligibleDays(period.start(), period.end(), workingDays);
        long remaining = eligibleDays(start, period.end(), workingDays);
        if (total == 0) return 0;
        return Math.round(annual * remaining / total * 100.0) / 100.0;
    }

    private static long eligibleDays(LocalDate start, LocalDate end, boolean workingDays) {
        if (!workingDays) return ChronoUnit.DAYS.between(start, end) + 1;
        return start.datesUntil(end.plusDays(1)).filter(d -> d.getDayOfWeek() != java.time.DayOfWeek.SATURDAY
                && d.getDayOfWeek() != java.time.DayOfWeek.SUNDAY).count();
    }
}
