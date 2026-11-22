package com.example.demo.helpdesk.service;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.common.context.AccessScopeContext;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service("faqManagementPolicy")
@RequiredArgsConstructor
public class FaqManagementPolicy {
    private final JdbcTemplate jdbc;

    public boolean canManage() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal user)) return false;
        // Verify employment and the actual effective role, not an alias or a profile flag.
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM greater_change.employees e
                    JOIN public.users u ON u.id = e.user_id AND u.is_active
                    JOIN public.companies c ON c.id = e.company_id AND c.is_active AND c.schema_name = 'greater_change'
                    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.company_id = c.id
                    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
                    WHERE e.user_id = ? AND e.is_active AND ur.is_active
                      AND ur.assignment_status = 'ACTIVE'
                      AND (ur.effective_from IS NULL OR ur.effective_from <= (now() AT TIME ZONE 'Asia/Dubai')::date)
                      AND (ur.expires_on IS NULL OR ur.expires_on >= (now() AT TIME ZONE 'Asia/Dubai')::date)
                      AND r.name IN ('PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN')
                )
                """, Boolean.class, user.getId()));
    }

    public Long requireCompany() {
        if (!canManage()) throw new AccessDeniedException("Only Greater Change Platform Admins and Super Admins can manage FAQs");
        var scope = AccessScopeContext.get();
        Long companyId = scope == null ? null : scope.getFilterCompanyId() != null
                ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (companyId == null || !scope.canAccess(companyId)) {
            throw new AccessDeniedException("Select an authorised company to manage its FAQs");
        }
        return companyId;
    }
}
