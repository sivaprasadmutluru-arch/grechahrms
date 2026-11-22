package com.example.demo.auth.service;

import com.example.demo.audit.AuditService;
import com.example.demo.auth.entity.Role;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.repository.RoleRepository;
import com.example.demo.auth.repository.UserRepository;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.base.repository.DepartmentRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.employee.repository.EmployeeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserRoleEmploymentVisibilityTest {
    private final UserRoleRepository assignments = mock(UserRoleRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final EmployeeCompanyGuard guard = mock(EmployeeCompanyGuard.class);
    private final UserRoleService service = new UserRoleService(assignments, users, mock(RoleRepository.class),
            mock(CompanyRepository.class), guard, mock(AuditService.class),
            mock(DepartmentRepository.class), mock(EmployeeRepository.class));

    @AfterEach
    void clearScope() {
        AccessScopeContext.clear();
    }

    @Test
    void keepsInactiveEmploymentReviewableAndDoesNotFlagOtherCompanies() {
        when(guard.employmentByUserAndCompany(null))
                .thenReturn(Map.of(1L, Map.of(10L, false, 20L, true)));
        when(assignments.findAll()).thenReturn(List.of(
                assignment(user(1), 10, Role.RoleName.EMPLOYEE),
                assignment(user(1), 20, Role.RoleName.EMPLOYEE),
                assignment(user(2), 10, Role.RoleName.ENTERPRISE_ADMIN)));

        assertThat(service.getAllAssignments()).extracting(dto -> dto.isInactiveEmployment())
                .containsExactly(true, false, false);
    }

    @Test
    void removesOnlyUsersWithNoRemainingEmploymentOrAdminAccessFromPicker() {
        User departed = user(1);
        User transferred = user(2);
        User standaloneAdmin = user(3);
        User multiCompanyAdmin = user(4);
        when(users.findAll()).thenReturn(List.of(departed, transferred, standaloneAdmin, multiCompanyAdmin));
        when(guard.employmentByUserAndCompany(null)).thenReturn(Map.of(
                1L, Map.of(10L, false), 2L, Map.of(10L, false, 20L, true), 4L, Map.of(10L, false)));
        when(assignments.findAll()).thenReturn(List.of(
                assignment(departed, 10, Role.RoleName.EMPLOYEE),
                assignment(transferred, 10, Role.RoleName.EMPLOYEE),
                assignment(transferred, 20, Role.RoleName.EMPLOYEE),
                assignment(standaloneAdmin, 10, Role.RoleName.ENTERPRISE_ADMIN),
                assignment(multiCompanyAdmin, 20, Role.RoleName.ACCOUNT_MANAGER)));

        var result = service.getAllUsers();
        assertThat(result).extracting(row -> row.get("id")).containsExactly(2L, 3L, 4L);
        assertThat(result.getFirst().get("companyId")).isEqualTo(20L);
    }

    @Test
    void scopedAdminDoesNotSeeDepartedEmployeeViaAnOutsideCompany() {
        User departed = user(1);
        List<Long> scope = List.of(10L);
        AccessScopeContext.set(new AccessScopeContext.ScopeData(99L, 10L, UserRole.AccessScope.BRANCH, scope));
        when(guard.employmentByUserAndCompany(scope)).thenReturn(Map.of(1L, Map.of(10L, false)));
        when(assignments.findByCompanyIdIn(scope)).thenReturn(List.of(assignment(departed, 10, Role.RoleName.EMPLOYEE)));

        assertThat(service.getAllUsers()).isEmpty();
    }

    private User user(long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private UserRole assignment(User user, long companyId, Role.RoleName name) {
        Company company = new Company();
        company.setId(companyId);
        Role role = new Role();
        role.setName(name);
        UserRole assignment = new UserRole();
        assignment.setUser(user);
        assignment.setCompany(company);
        assignment.setRole(role);
        return assignment;
    }
}
