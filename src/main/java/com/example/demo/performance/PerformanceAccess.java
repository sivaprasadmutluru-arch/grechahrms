package com.example.demo.performance;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.service.ReportingManagerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;
import java.util.Set;

@Component
@RequiredArgsConstructor
class PerformanceAccess {
    static final Set<String> HR = Set.of("ROLE_PLATFORM_SUPER_ADMIN", "ROLE_SUPER_ADMIN",
            "ROLE_ENTERPRISE_ADMIN", "ROLE_COMPANY_ADMIN", "ROLE_BRANCH_ADMIN", "ROLE_HR_MANAGER");

    private final EmployeeRepository employees;
    private final CompanyRepository companies;
    private final ReportingManagerService reporting;

    record Scope(long user, Company company, Employee self, boolean hr) {
        long companyId() { return company.getId(); }
    }

    record RecordAccess(Scope scope, Employee employee, Employee manager, boolean own, boolean manages) {
        boolean edit() { return !own && (scope.hr() || manages); }
        boolean calibrate() { return scope.hr() && !own; }
    }

    Scope scope(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) throw denied();
        var requestScope = AccessScopeContext.get();
        if (requestScope == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please select a company first, then choose an employee from the overview. Set their reporting manager on the employee profile.");
        Long id = requestScope.getFilterCompanyId() != null
                ? requestScope.getFilterCompanyId() : requestScope.getCompanyId();
        if (id == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Please select a company first, then choose an employee from the overview. Set their reporting manager on the employee profile.");
        if (!requestScope.canAccess(id)) throw denied();
        Company company = companies.findByIdPublic(id).filter(Company::isActive).orElseThrow(PerformanceAccess::denied);
        Company head = company.isHeadOffice() ? company : companies.findByIdPublic(company.getParentCompanyId()).orElseThrow(PerformanceAccess::denied);
        if (head.getSchemaName() == null || !Objects.equals(TenantContext.getTenant(), head.getSchemaName())) throw denied();
        Employee self = employees.findByUserId(principal.getId())
                .filter(employee -> employee.isActive() && employee.getCompany() != null && id.equals(employee.getCompany().getId()))
                .orElse(null);
        boolean hr = !requestScope.isSelfScope()
                && requestScope.getScope() != com.example.demo.auth.entity.UserRole.AccessScope.DEPARTMENT
                && auth.getAuthorities().stream().anyMatch(authority -> HR.contains(authority.getAuthority()));
        return new Scope(principal.getId(), company, self, hr);
    }

    RecordAccess record(Scope scope, long employeeId) {
        Employee employee = employees.findById(employeeId)
                .filter(row -> row.getCompany() != null && Long.valueOf(scope.companyId()).equals(row.getCompany().getId()))
                .orElseThrow(PerformanceAccess::denied);
        return access(scope, employee);
    }

    RecordAccess access(Scope scope, Employee employee) {
        Employee manager = reporting.resolve(employee);
        if (manager != null && (!manager.isActive() || manager.getCompany() == null
                || !Long.valueOf(scope.companyId()).equals(manager.getCompany().getId()))) manager = null;
        boolean own = scope.self() != null && scope.self().getId().equals(employee.getId());
        boolean manages = !own && manager != null && scope.self() != null && manager.getId().equals(scope.self().getId());
        if (!scope.hr() && !manages && !own) throw denied();
        return new RecordAccess(scope, employee, manager, own, manages);
    }

    List<Employee> staff(Scope scope) {
        if (scope.hr()) return employees.findByCompanyIdAndIsActiveTrue(scope.companyId());
        if (scope.self() == null) return List.of();
        var reports = new java.util.ArrayList<>(reporting.directReports(scope.self()));
        reports.addFirst(scope.self());
        return reports;
    }

    record ReminderTarget(Employee employee, Employee manager) {}

    ReminderTarget companyEmployeeForReminder(long companyId, long id) {
        var employee = employees.findById(id).filter(row -> row.isActive() && row.getCompany() != null
                && Long.valueOf(companyId).equals(row.getCompany().getId())).orElse(null);
        if (employee == null) return null;
        var manager = reporting.resolve(employee);
        if (manager == null || !manager.isActive() || manager.getCompany() == null
                || !Long.valueOf(companyId).equals(manager.getCompany().getId())) return null;
        return new ReminderTarget(employee, manager);
    }

    static ResponseStatusException denied() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "This performance action is outside your access.");
    }
}
