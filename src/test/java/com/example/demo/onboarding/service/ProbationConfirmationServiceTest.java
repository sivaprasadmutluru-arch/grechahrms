package com.example.demo.onboarding.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.tenant.TenantContext;
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
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class ProbationConfirmationServiceTest {
    @Mock ProbationPolicyRepository policies;
    @Mock ProbationConfirmationRepository confirmations;
    @Mock ProbationEligibility eligibility;
    @Mock EmployeeRepository employees;
    @Mock CompanyRepository companies;
    @Mock LeaveTypeRepository types;
    @Mock AvailableLeaveRepository balances;
    @Mock LeaveAllocationRepository allocations;
    @Mock ReportingManagerService reportingManagers;
    @Mock NotificationRepository notifications;
    @Mock LeaveAccrualService accruals;
    @InjectMocks ProbationConfirmationService service;
    Employee employee;
    Company company;
    ProbationPolicy policy;
    Employee manager;
    final LocalDate joined = LocalDate.of(2026, 4, 22), due = joined.plusMonths(6);

    @BeforeEach void setup() {
        company = new Company(); company.setId(1L); company.setSchemaName("test_company");
        employee = new Employee(); employee.setId(2L); employee.setCompany(company); employee.setDateJoining(joined);
        policy = new ProbationPolicy(); policy.setCompanyId(1L); policy.setEnabled(true); policy.setEffectiveFrom(joined);
        lenient().when(employees.findByIdForProbationConfirmation(2L)).thenReturn(Optional.of(employee));
        manager = new Employee(); manager.setId(4L); manager.setCompany(company);
        User user = new User(); user.setId(5L); manager.setUser(user);
        TenantContext.setTenant("test_company");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(5L, 1L, UserRole.AccessScope.SELF, List.of(1L)));
    }
    @AfterEach void clearContext() {
        AccessScopeContext.clear(); TenantContext.clear();
    }
    void assignedManager() {
        when(reportingManagers.resolve(employee)).thenReturn(manager);
    }
    boolean confirm(LocalDate today) {
        return service.confirmAsManager(1L, 2L, today);
    }
    void covered() {
        when(policies.findByCompanyId(1L)).thenReturn(Optional.of(policy));
        when(eligibility.joiningDate(employee)).thenReturn(joined);
        when(eligibility.applies(policy, joined)).thenReturn(true);
    }
    LeaveType type(boolean monthly) {
        LeaveType type = new LeaveType(); type.setId(3L); type.setCompany(company); type.setTotalDays(30); type.setAccrualEnabled(monthly);
        when(types.findAll()).thenReturn(List.of(type));
        when(eligibility.applicableLeaveType(employee, type)).thenReturn(true);
        return type;
    }
    @Test void doesNotConfirmBeforeSixMonthAnniversary() {
        assignedManager(); covered();
        assertThrows(BadRequestException.class, () -> confirm(due.minusDays(1)));
        verifyNoInteractions(types, balances, allocations);
    }
    @Test void automaticallyConfirmsAndAllocatesLeaveWithoutAReportingManager() {
        covered(); type(false);
        AccessScopeContext.clear();
        assertTrue(service.confirmIfDue(1L, 2L, due));
        verifyNoInteractions(reportingManagers);
        verify(confirmations).save(argThat(c -> due.equals(c.getConfirmedOn())));
        verify(balances).save(argThat(b -> b.getAvailableDays() == 30));
    }
    @Test void automaticConfirmationDoesNotRunBeforeDueDateOrForWrongCompany() {
        covered();
        assertFalse(service.confirmIfDue(1L, 2L, due.minusDays(1)));
        assertFalse(service.confirmIfDue(99L, 2L, due));
        verifyNoInteractions(confirmations, balances, accruals);
    }
    @Test void rejectsFormerManagerOrOtherUser() {
        assignedManager();
        AccessScopeContext.set(new AccessScopeContext.ScopeData(6L, 1L, UserRole.AccessScope.SELF, List.of(1L)));
        assertThrows(AccessDeniedException.class, () -> confirm(due));
        verifyNoInteractions(confirmations, balances, accruals);
    }
    @Test void rejectsDifferentCompanyContext() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(5L, 99L, UserRole.AccessScope.SELF, List.of(99L)));
        assertThrows(AccessDeniedException.class, () -> confirm(due));
        verifyNoInteractions(reportingManagers, confirmations, balances);
    }
    @Test void confirmsOnAnniversaryAndAllocatesUpfrontOnlyOnce() {
        assignedManager(); covered(); type(false);
        assertTrue(confirm(due));
        ArgumentCaptor<ProbationConfirmation> saved = ArgumentCaptor.forClass(ProbationConfirmation.class);
        verify(confirmations).save(saved.capture());
        assertEquals(due, saved.getValue().getConfirmedOn());
        verify(balances).save(argThat(b -> b.getAvailableDays() == 30));
        verify(allocations).save(argThat(a -> a.getTotalLeaveDays() == 30));
        when(confirmations.findByEmployeeId(2L)).thenReturn(Optional.of(saved.getValue()));
        assertFalse(service.confirmIfDue(1L, 2L, due.plusDays(1)));
        verify(confirmations, times(1)).save(any());
    }
    @Test void lateAutomaticRunRecordsAnniversaryAndActualProcessingDateSeparately() {
        covered(); type(false);
        LocalDate processedOn = due.plusDays(9);
        assertTrue(service.confirmIfDue(1L, 2L, processedOn));
        verify(confirmations).save(argThat(c -> c.getConfirmedOn().equals(due) && c.getProcessedOn().equals(processedOn)));
        verify(balances).save(argThat(b -> due.equals(b.getAssignedDate())));
        verify(accruals).processProbationAccrual(2L, processedOn);
        verify(notifications).completeRelatedAction(eq(1L), eq("PROBATION_REVIEW"), eq(2L),
                eq("PROBATION_CONFIRMED"), anyString(), anyString());
    }
    @Test void monthlyPolicyDoesNotGrantWholeAnnualEntitlement() {
        assignedManager(); covered(); type(true); assertTrue(confirm(due));
        verify(balances).save(argThat(b -> b.getAvailableDays() == 0));
        verify(allocations, never()).save(any());
    }
    @Test void existingImportedBalanceIsPreserved() {
        assignedManager(); covered(); type(false);
        when(balances.findByEmployeeIdAndLeaveTypeId(2L, 3L)).thenReturn(Optional.of(new AvailableLeave()));
        assertTrue(confirm(due)); verify(balances, never()).save(any());
        verifyNoInteractions(allocations);
    }
    @Test void inactiveEmployeesAreSkipped() {
        employee.setActive(false); assertFalse(service.confirmIfDue(1L, 2L, due)); verifyNoInteractions(policies, balances);
    }
    @Test void otherCompanyLeaveTypesAreNotAllocated() {
        assignedManager(); covered(); Company other = new Company(); other.setId(99L);
        LeaveType type = new LeaveType(); type.setCompany(other);
        when(types.findAll()).thenReturn(List.of(type));
        when(eligibility.applicableLeaveType(employee, type)).thenCallRealMethod();
        assertTrue(confirm(due)); verifyNoInteractions(balances, allocations);
    }
    @Test void monthEndJoiningUsesCalendarMonthsIncludingLeapYear() {
        assignedManager(); LocalDate leapJoining = LocalDate.of(2023, 8, 31);
        when(policies.findByCompanyId(1L)).thenReturn(Optional.of(policy));
        when(eligibility.joiningDate(employee)).thenReturn(leapJoining);
        when(eligibility.applies(policy, leapJoining)).thenReturn(true);
        assertTrue(confirm(LocalDate.of(2024, 2, 29)));
        verify(confirmations).save(argThat(c -> c.getConfirmedOn().equals(LocalDate.of(2024, 2, 29))));
    }
}
