package com.example.demo.onboarding.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.entity.Employee;
import com.example.demo.leave.service.LeaveAccrualService;
import com.example.demo.onboarding.entity.ProbationPolicy;
import com.example.demo.onboarding.repository.ProbationPolicyRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ProbationSchedulerTest {
    @Mock CompanyRepository companies;
    @Mock EmployeeRepository employees;
    @Mock ProbationPolicyRepository policies;
    @Mock ProbationConfirmationService confirmations;
    @Mock LeaveAccrualService accruals;
    @InjectMocks ProbationScheduler scheduler;
    @AfterEach void clear() { TenantContext.clear(); }

    @Test void confirmsEmployeesInTheirTenantAndDoesNotPostAccrualTwice() {
        Company tenant = new Company(); tenant.setSchemaName("first");
        ProbationPolicy policy = new ProbationPolicy(); policy.setCompanyId(1L);
        Employee employee = new Employee(); employee.setId(2L);
        when(companies.findAllHeadOfficesActivePublic()).thenReturn(List.of(tenant));
        when(policies.findByEnabledTrue()).thenReturn(List.of(policy));
        when(employees.findByCompanyIdAndIsActiveTrue(1L)).thenReturn(List.of(employee));
        when(confirmations.confirmIfDue(eq(1L), eq(2L), any())).thenAnswer(call -> {
            assertEquals("first", TenantContext.getTenant());
            return true;
        });

        scheduler.ready();

        verify(confirmations).confirmIfDue(eq(1L), eq(2L), any());
        verifyNoInteractions(accruals);
    }

    @Test void isolatesTenantFailureAndRestoresPreviousTenant() {
        Company first = new Company(); first.setSchemaName("first");
        Company second = new Company(); second.setSchemaName("second");
        when(companies.findAllHeadOfficesActivePublic()).thenReturn(List.of(first, second));
        when(policies.findByEnabledTrue()).thenAnswer(i -> {
            if (TenantContext.getTenant().equals("first")) throw new IllegalStateException("Unavailable tenant");
            assertEquals("second", TenantContext.getTenant());
            return List.of();
        });
        TenantContext.setTenant("previous");
        scheduler.ready();
        verify(policies, times(2)).findByEnabledTrue();
        assertEquals("previous", TenantContext.getTenant());
    }
}
