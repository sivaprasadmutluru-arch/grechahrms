package com.example.demo.payroll.service;

import com.example.demo.auth.entity.UserRole;
import com.example.demo.common.context.AccessScopeContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.util.Set;
import java.util.stream.Collectors;

/** Read-only description of existing, request-scoped payroll access; grants nothing. */
public record PayrollCapabilities(
        Long companyId, Long employeeId, boolean requiresCompanySelection,
        boolean canViewOwnPayslips, boolean canViewCompanyPayslips,
        boolean canGeneratePayslips, boolean canSubmitPayslips, boolean canApprovePayslips,
        boolean canExportPayslips, boolean canImportPayslips) {

    public static PayrollCapabilities resolve(Authentication authentication,
                                               AccessScopeContext.ScopeData scope, Long employeeId) {
        if (authentication == null || !authentication.isAuthenticated() || scope == null) {
            throw new AccessDeniedException("Payroll access context is unavailable");
        }
        Long companyId = scope.getFilterCompanyId() != null ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (companyId != null && !scope.canAccess(companyId)) {
            throw new AccessDeniedException("Company is outside your access scope");
        }
        // Authentication is already narrowed by AccessScopeInterceptor. Do not
        // read UserPrincipal.getAuthorities(): that principal spans all companies.
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(a -> a.getAuthority()).collect(Collectors.toSet());
        if (scope.hasUnrestrictedAccess() && !authorities.contains("ROLE_PLATFORM_SUPER_ADMIN")) {
            throw new AccessDeniedException("Unrestricted payroll access requires platform administration");
        }
        boolean view = companyId != null && authorities.contains("payroll:view");
        boolean companyScope = scope.hasUnrestrictedAccess()
                || scope.getScope() == UserRole.AccessScope.BRANCH
                || scope.getScope() == UserRole.AccessScope.HEAD_OFFICE
                || scope.getScope() == UserRole.AccessScope.ENTERPRISE;
        boolean companyView = view && companyScope;
        boolean preparer = hasAny(authorities, "ROLE_PLATFORM_SUPER_ADMIN", "ROLE_ENTERPRISE_ADMIN",
                "ROLE_BRANCH_ADMIN", "ROLE_HR_MANAGER", "ROLE_COMPANY_ADMIN", "ROLE_COMPANY_MANAGER",
                "ROLE_SUPER_ADMIN", "ROLE_CEO");
        boolean submitter = preparer || authorities.contains("ROLE_ACCOUNTANT") || authorities.contains("ROLE_ACCOUNTS_MANAGER");
        return new PayrollCapabilities(companyId, view ? employeeId : null, companyId == null,
                view && employeeId != null, companyView,
                companyView && preparer,
                companyView && submitter,
                companyView && authorities.contains("payroll:approve"),
                companyView,
                companyView && preparer && authorities.contains("payroll:edit"));
    }

    private static boolean hasAny(Set<String> authorities, String... names) {
        for (String name : names) if (authorities.contains(name)) return true;
        return false;
    }

    /** Bulk generation must target the explicitly selected company, not every accessible branch. */
    public static Long generationCompany(AccessScopeContext.ScopeData scope, Long requestedCompanyId) {
        if (scope == null || requestedCompanyId == null || !scope.canAccess(requestedCompanyId)) {
            throw new AccessDeniedException("Company is outside your payroll access scope");
        }
        Long selected = scope.getFilterCompanyId() != null ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (selected != null && !selected.equals(requestedCompanyId)) {
            throw new AccessDeniedException("Generation company must match the selected company");
        }
        return requestedCompanyId;
    }
}
