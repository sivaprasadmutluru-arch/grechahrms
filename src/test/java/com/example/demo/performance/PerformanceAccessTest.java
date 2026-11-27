package com.example.demo.performance;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.service.ReportingManagerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PerformanceAccessTest {
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final CompanyRepository companies = mock(CompanyRepository.class);
    private final ReportingManagerService reporting = mock(ReportingManagerService.class);
    private final PerformanceAccess access = new PerformanceAccess(employees, companies, reporting);

    @AfterEach void clearScope() {
        AccessScopeContext.clear();
        TenantContext.clear();
    }

    @Test
    void missingCompanyContextReturnsActionableClientError() {
        var error = assertThrows(ResponseStatusException.class,
                () -> access.scope(auth(12L, "ROLE_PLATFORM_SUPER_ADMIN")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("Please select a company first, then choose an employee from the overview. Set their reporting manager on the employee profile.",
                error.getReason());
    }

    @Test
    void managerCanAccessDirectReportsButNotUnrelatedEmployeesOrAnotherCompany() {
        Company company = company(1L, "tenant_a");
        var manager = employee(2L, company);
        var report = employee(3L, company);
        var unrelated = employee(4L, company);
        var otherCompany = employee(5L, company(99L, "tenant_b"));
        when(employees.findByUserId(12L)).thenReturn(Optional.of(manager));
        when(employees.findById(3L)).thenReturn(Optional.of(report));
        when(employees.findById(4L)).thenReturn(Optional.of(unrelated));
        when(employees.findById(5L)).thenReturn(Optional.of(otherCompany));
        when(reporting.resolve(report)).thenReturn(manager);

        AccessScopeContext.set(new AccessScopeContext.ScopeData(12L, 1L, UserRole.AccessScope.DEPARTMENT, List.of(1L)));
        TenantContext.setTenant("tenant_a");
        var scope = access.scope(auth(12L, "ROLE_DEPARTMENT_MANAGER"));

        assertTrue(access.record(scope, 3L).manages());
        assertThrows(ResponseStatusException.class, () -> access.record(scope, 4L));
        assertThrows(ResponseStatusException.class, () -> access.record(scope, 5L));
        TenantContext.setTenant("tenant_b");
        assertThrows(ResponseStatusException.class, () -> access.scope(auth(12L, "ROLE_DEPARTMENT_MANAGER")));
    }

    @Test
    void ownRecordIsReadOnlyEvenWhenTheEmployeeAlsoHasAnHrRole() {
        Company company = company(1L, "tenant_a");
        Employee employee = employee(3L, company);
        when(employees.findByUserId(12L)).thenReturn(Optional.of(employee));
        when(employees.findById(3L)).thenReturn(Optional.of(employee));
        AccessScopeContext.set(new AccessScopeContext.ScopeData(12L, 1L, UserRole.AccessScope.BRANCH, List.of(1L)));
        TenantContext.setTenant("tenant_a");
        var scope = access.scope(auth(12L, "ROLE_HR_MANAGER"));
        assertTrue(scope.hr());
        var record = access.record(scope, 3L);
        assertTrue(record.own());
        assertFalse(record.edit());
        assertFalse(record.calibrate());
    }

    private Company company(Long id, String schema) {
        var company = new Company();
        company.setId(id);
        company.setCompanyType(Company.CompanyType.HEAD_OFFICE);
        company.setSchemaName(schema);
        when(companies.findByIdPublic(id)).thenReturn(Optional.of(company));
        return company;
    }

    private static Employee employee(Long id, Company company) {
        var employee = new Employee();
        employee.setId(id);
        employee.setCompany(company);
        return employee;
    }

    private static UsernamePasswordAuthenticationToken auth(long id, String role) {
        var user = new User();
        user.setId(id);
        return new UsernamePasswordAuthenticationToken(new UserPrincipal(user), null,
                List.of(new SimpleGrantedAuthority(role)));
    }
}
