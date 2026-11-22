package com.example.demo.payroll.controller;

import com.example.demo.auth.entity.UserRole;
import com.example.demo.base.entity.Company;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PayrollAccessControllerTest {
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final PayrollAccessController controller = new PayrollAccessController(employees);
    private final Authentication auth = new UsernamePasswordAuthenticationToken("user", null,
            List.of(new SimpleGrantedAuthority("ROLE_ENTERPRISE_ADMIN"), new SimpleGrantedAuthority("payroll:view")));

    @AfterEach void clear() { AccessScopeContext.clear(); }

    @Test void ownEmployeeIdIsResolvedInsideSelectedTenant() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L)));
        var company = new Company(); company.setId(64L);
        var employee = new Employee(); employee.setId(18L); employee.setCompany(company);
        when(employees.findByUserId(168L)).thenReturn(Optional.of(employee));
        var result = controller.access(auth);
        assertThat(result.employeeId()).isEqualTo(18L);
        assertThat(result.canViewOwnPayslips()).isTrue();
        verify(employees).findByUserId(168L);
        verifyNoMoreInteractions(employees);
    }

    @Test void homeCompanyEmployeeIdIsNotReusedInAnotherSelectedCompany() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L, 66L), null, 66L));
        var home = new Company(); home.setId(64L);
        var employee = new Employee(); employee.setId(18L); employee.setCompany(home);
        when(employees.findByUserId(168L)).thenReturn(Optional.of(employee));
        var result = controller.access(auth);
        assertThat(result.companyId()).isEqualTo(66L);
        assertThat(result.employeeId()).isNull();
        assertThat(result.canViewOwnPayslips()).isFalse();
        assertThat(result.canViewCompanyPayslips()).isTrue();
    }

    @Test void adminWithoutEmployeeProfileStillHasManagementAccess() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L)));
        when(employees.findByUserId(168L)).thenReturn(Optional.empty());
        assertThat(controller.access(auth).canViewCompanyPayslips()).isTrue();
    }

    @Test void missingContextFailsBeforeAnyTenantLookup() {
        assertThatThrownBy(() -> controller.access(auth)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(employees);
    }
}
