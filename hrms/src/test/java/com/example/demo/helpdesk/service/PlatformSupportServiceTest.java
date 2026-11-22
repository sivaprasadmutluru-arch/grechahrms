package com.example.demo.helpdesk.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.entity.UserRole.AccessScope;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.common.context.AccessScopeContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlatformSupportServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformSupportService service = new PlatformSupportService(jdbc);

    private UserPrincipal authenticate(String authority) {
        var user = new User();
        user.setId(7L);
        var principal = new UserPrincipal(user);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority(authority))));
        return principal;
    }

    @AfterEach
    void clear() {
        AccessScopeContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void employeeCannotOpenEscalationQueueOrCreateEscalation() {
        var user = authenticate("ROLE_EMPLOYEE");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(7L, 11L, AccessScope.SELF, List.of(11L)));
        assertThrows(AccessDeniedException.class, () -> service.list(user, 0));
        assertThrows(AccessDeniedException.class, () -> service.create(user, "Issue", "Description"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void authorisedAdminEscalatesForSelectedBranch() {
        var user = authenticate("ROLE_COMPANY_ADMIN");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(7L, 11L, AccessScope.ENTERPRISE,
                List.of(11L, 12L), null, 12L));
        assertEquals(12L, PlatformSupportService.requireOrganisationCompany(user));
    }

    @Test
    void rejectsCompanyOutsideAssignedScopeAndPreventsClientResponses() {
        var user = authenticate("ROLE_COMPANY_ADMIN");
        AccessScopeContext.set(new AccessScopeContext.ScopeData(7L, 11L, AccessScope.ENTERPRISE,
                List.of(11L), null, 12L));
        assertThrows(AccessDeniedException.class, () -> service.list(user, 0));
        assertThrows(AccessDeniedException.class, () -> service.respond(user, 5, PlatformSupportService.Status.RESOLVED, "Done"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void platformSupportCanOpenInboxWithoutSelectingCompany() {
        var user = authenticate("ROLE_PLATFORM_SUPER_ADMIN");
        assertTrue(service.list(user, 0).management());
    }
}
