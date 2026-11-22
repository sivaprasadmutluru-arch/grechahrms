package com.example.demo.payroll.service;

import com.example.demo.auth.entity.Role;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.common.context.AccessScopeContext;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class PayrollCapabilitiesTest {
    private AccessScopeContext.ScopeData scope(UserRole.AccessScope level) {
        return new AccessScopeContext.ScopeData(168L, 64L, level, List.of(64L));
    }

    private Authentication auth(String... names) {
        return new UsernamePasswordAuthenticationToken("global-principal-not-used", null,
                Arrays.stream(names).map(SimpleGrantedAuthority::new).toList());
    }

    private Authentication roleAuth(Role.RoleName... names) {
        var assignments = Arrays.stream(names).map(name -> {
            var role = new Role(); role.setName(name);
            var assignment = new UserRole(); assignment.setRole(role);
            return assignment;
        }).toList();
        return new UsernamePasswordAuthenticationToken("user", null, UserPrincipal.authoritiesForAssignments(assignments));
    }

    @Test void companyAdminPlusEmployeeDefaultsToManagementWithoutRemovingOwnAccess() {
        var access = PayrollCapabilities.resolve(roleAuth(Role.RoleName.COMPANY_ADMIN, Role.RoleName.EMPLOYEE),
                scope(UserRole.AccessScope.ENTERPRISE), 18L);
        assertThat(access.canViewCompanyPayslips()).isTrue();
        assertThat(access.canGeneratePayslips()).isTrue();
        assertThat(access.canSubmitPayslips()).isTrue();
        assertThat(access.canApprovePayslips()).isTrue();
        assertThat(access.canViewOwnPayslips()).isTrue();
    }

    @Test void employeeOnlyStaysPersonalEvenWhenPrincipalDescribesAnotherCompanyAdmin() {
        var access = PayrollCapabilities.resolve(auth("ROLE_EMPLOYEE", "payroll:view"), scope(UserRole.AccessScope.SELF), 18L);
        assertThat(access.canViewOwnPayslips()).isTrue();
        assertThat(access.canViewCompanyPayslips()).isFalse();
        assertThat(access.canGeneratePayslips()).isFalse();
        assertThat(access.canApprovePayslips()).isFalse();
    }

    @Test void branchManagerCannotApproveWithoutTheExistingApprovalAuthority() {
        var access = PayrollCapabilities.resolve(roleAuth(Role.RoleName.COMPANY_MANAGER, Role.RoleName.EMPLOYEE), scope(UserRole.AccessScope.BRANCH), 18L);
        assertThat(access.canGeneratePayslips()).isTrue();
        assertThat(access.canSubmitPayslips()).isTrue();
        assertThat(access.canApprovePayslips()).isFalse();
    }

    @Test void accountantCanApproveButCannotGenerateThroughAnEndpointThatExcludesAccountants() {
        var access = PayrollCapabilities.resolve(roleAuth(Role.RoleName.ACCOUNTS_MANAGER), scope(UserRole.AccessScope.BRANCH), null);
        assertThat(access.canViewCompanyPayslips()).isTrue();
        assertThat(access.canSubmitPayslips()).isTrue();
        assertThat(access.canApprovePayslips()).isTrue();
        assertThat(access.canGeneratePayslips()).isFalse();
        assertThat(access.canImportPayslips()).isFalse();
        assertThat(access.canViewOwnPayslips()).isFalse();
    }

    @Test void hrPreparerDoesNotAutomaticallyBecomePayrollApprover() {
        var access = PayrollCapabilities.resolve(auth("ROLE_HR_MANAGER", "payroll:view", "payroll:create", "payroll:edit"), scope(UserRole.AccessScope.BRANCH), 18L);
        assertThat(access.canGeneratePayslips()).isTrue();
        assertThat(access.canSubmitPayslips()).isTrue();
        assertThat(access.canApprovePayslips()).isFalse();
    }

    @Test void departmentScopeCannotBecomeCompanyWideEvenWithWriteAuthority() {
        var access = PayrollCapabilities.resolve(auth("ROLE_HR_MANAGER", "payroll:view", "payroll:edit"), scope(UserRole.AccessScope.DEPARTMENT), 18L);
        assertThat(access.canViewCompanyPayslips()).isFalse();
        assertThat(access.canGeneratePayslips()).isFalse();
        assertThat(access.canViewOwnPayslips()).isTrue();
    }

    @Test void readOnlyAccessDoesNotExposeMutationButtons() {
        var access = PayrollCapabilities.resolve(auth("payroll:view"), scope(UserRole.AccessScope.ENTERPRISE), null);
        assertThat(access.canViewCompanyPayslips()).isTrue();
        assertThat(access.canGeneratePayslips()).isFalse();
        assertThat(access.canSubmitPayslips()).isFalse();
        assertThat(access.canApprovePayslips()).isFalse();
    }

    @Test void partialAccountManagerWithoutPayrollPermissionGetsNoCapabilities() {
        var access = PayrollCapabilities.resolve(auth("ROLE_ACCOUNT_MANAGER", "ROLE_ENTERPRISE_ADMIN"), scope(UserRole.AccessScope.ENTERPRISE), 18L);
        assertThat(access.canViewCompanyPayslips()).isFalse();
        assertThat(access.canViewOwnPayslips()).isFalse();
        assertThat(access.canGeneratePayslips()).isFalse();
    }

    @Test void platformAdminMustChooseACompanyBeforeSeeingPayrollData() {
        var access = PayrollCapabilities.resolve(auth("ROLE_PLATFORM_SUPER_ADMIN", "payroll:view", "payroll:approve"),
                new AccessScopeContext.ScopeData(1L, null, null, List.of()), null);
        assertThat(access.requiresCompanySelection()).isTrue();
        assertThat(access.canViewCompanyPayslips()).isFalse();
        assertThat(access.canGeneratePayslips()).isFalse();
    }

    @Test void unauthorizedCompanyFilterAndMissingContextFailClosed() {
        var bad = new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L), null, 65L);
        assertThatThrownBy(() -> PayrollCapabilities.resolve(auth("payroll:view"), bad, 18L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> PayrollCapabilities.resolve(auth("payroll:view"), null, 18L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> PayrollCapabilities.resolve(null, scope(UserRole.AccessScope.SELF), 18L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void unrestrictedContextCannotBeUsedByNonPlatformUser() {
        var unrestricted = new AccessScopeContext.ScopeData(168L, 64L, null, List.of());
        assertThatThrownBy(() -> PayrollCapabilities.resolve(auth("ROLE_EMPLOYEE", "payroll:view"), unrestricted, 18L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test void generationUsesSelectedCompanyNotEveryAccessibleBranch() {
        var scoped = new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L, 66L), null, 66L);
        assertThat(PayrollCapabilities.generationCompany(scoped, 66L)).isEqualTo(66L);
        assertThatThrownBy(() -> PayrollCapabilities.generationCompany(scoped, 64L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> PayrollCapabilities.generationCompany(scoped, 65L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> PayrollCapabilities.generationCompany(null, 64L)).isInstanceOf(AccessDeniedException.class);
    }
}
