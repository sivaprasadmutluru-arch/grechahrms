package com.example.demo.helpdesk.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.common.context.AccessScopeContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FaqManagementPolicyTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final FaqManagementPolicy policy = new FaqManagementPolicy(jdbc);

    private void signIn() {
        var user = new User();
        user.setId(83L);
        var principal = new UserPrincipal(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @AfterEach void clear() {
        SecurityContextHolder.clearContext();
        AccessScopeContext.clear();
    }

    @Test void anonymousUsersCannotManageAndDoNotTriggerADatabaseRead() {
        assertFalse(policy.canManage());
        verifyNoInteractions(jdbc);
    }

    @Test void ordinaryEmployeesAndClientAdminsAreDeniedByTheMembershipCheck() {
        signIn();
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(83L))).thenReturn(false);
        assertFalse(policy.canManage());
        assertThrows(AccessDeniedException.class, policy::requireCompany);
        verify(jdbc, atLeastOnce()).queryForObject(argThat(sql ->
                        sql.contains("greater_change.employees") && sql.contains("e.is_active")
                        && sql.contains("'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'")
                        && sql.contains("ur.expires_on")),
                eq(Boolean.class), eq(83L));
    }

    @Test void verifiedTgcAdminCanManageOnlyAnAccessibleSelectedCompany() {
        signIn();
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(83L))).thenReturn(true);
        AccessScopeContext.set(new AccessScopeContext.ScopeData(83L, 7L, UserRole.AccessScope.ENTERPRISE,
                List.of(7L, 10L), null, 10L));
        assertEquals(10L, policy.requireCompany());
        AccessScopeContext.set(new AccessScopeContext.ScopeData(83L, 7L, UserRole.AccessScope.ENTERPRISE,
                List.of(7L), null, 99L));
        assertThrows(AccessDeniedException.class, policy::requireCompany);
    }
}
