package com.example.demo.helpdesk.service;

import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PlatformSupportService {
    private static final String ADMIN = "ROLE_PLATFORM_SUPER_ADMIN";
    private static final Set<String> ORGANISATION_ROLES = Set.of("ROLE_SUPER_ADMIN", "ROLE_ENTERPRISE_ADMIN",
            "ROLE_ACCOUNT_MANAGER", "ROLE_COMPANY_ADMIN", "ROLE_BRANCH_ADMIN", "ROLE_COMPANY_MANAGER", "ROLE_HR_MANAGER");
    private static final int PAGE_SIZE = 20;
    private static final String SELECT = """
            SELECT r.id, c.id AS company_id, c.name AS company_name, r.subject, r.description,
                   r.status, r.response, r.created_at, r.updated_at
              FROM public.platform_support_requests r JOIN public.companies c ON c.id = r.company_id
            """;
    private static final RowMapper<Request> ROW = (rs, index) -> new Request(rs.getLong("id"),
            rs.getLong("company_id"), rs.getString("company_name"), rs.getString("subject"),
            rs.getString("description"), Status.valueOf(rs.getString("status")), rs.getString("response"),
            rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public Inbox list(UserPrincipal user, int page) {
        if (page < 0) throw new BadRequestException("Page cannot be negative");
        boolean management = hasAuthority(user, ADMIN);
        Long companyId = management ? null : requireOrganisationCompany(user);
        String company = management ? null : companyName(companyId);
        long offset = (long) page * PAGE_SIZE;
        String order = " ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?";
        var requests = management ? jdbc.query(SELECT + order, ROW, PAGE_SIZE + 1, offset)
                : jdbc.query(SELECT + " WHERE r.company_id = ?" + order, ROW, companyId, PAGE_SIZE + 1, offset);
        boolean more = requests.size() > PAGE_SIZE;
        return new Inbox(management, company, more ? requests.subList(0, PAGE_SIZE) : requests, more);
    }

    @Transactional
    public Request create(UserPrincipal user, String subject, String description) {
        Long companyId = requireOrganisationCompany(user);
        companyName(companyId);
        Long id = jdbc.queryForObject("""
                INSERT INTO public.platform_support_requests (company_id, raised_by_user_id, subject, description)
                VALUES (?, ?, ?, ?) RETURNING id
                """, Long.class, companyId, user.getId(), subject.strip(), description.strip());
        return find(id, companyId);
    }

    @Transactional
    public Request respond(UserPrincipal user, long id, Status status, String response) {
        if (!hasAuthority(user, ADMIN)) throw new AccessDeniedException("Only platform support can respond");
        int changed = jdbc.update("""
                UPDATE public.platform_support_requests SET status = ?, response = ?, responded_by_user_id = ?, updated_at = now()
                WHERE id = ?
                """, status.name(), response.strip(), user.getId(), id);
        if (changed == 0) throw new ResourceNotFoundException("Support request", id);
        return find(id, null);
    }

    private Request find(Long id, Long companyId) {
        var rows = companyId == null ? jdbc.query(SELECT + " WHERE r.id = ?", ROW, id)
                : jdbc.query(SELECT + " WHERE r.id = ? AND r.company_id = ?", ROW, id, companyId);
        return rows.stream().findFirst().orElseThrow(() -> new ResourceNotFoundException("Support request", id));
    }

    private String companyName(Long id) {
        return jdbc.query("SELECT name FROM public.companies WHERE id = ? AND is_active = true",
                        (rs, index) -> rs.getString("name"), id)
                .stream().findFirst().orElseThrow(() -> new AccessDeniedException("Select an active company"));
    }

    static Long requireOrganisationCompany(UserPrincipal user) {
        var scope = AccessScopeContext.get();
        if (user == null || scope == null || !Objects.equals(scope.getUserId(), user.getId())
                || !Set.of(UserRole.AccessScope.ENTERPRISE, UserRole.AccessScope.HEAD_OFFICE, UserRole.AccessScope.BRANCH)
                        .contains(scope.getScope() == null ? UserRole.AccessScope.SELF : scope.getScope())
                || ORGANISATION_ROLES.stream().noneMatch(role -> hasAuthority(user, role))) {
            throw new AccessDeniedException("Only an authorised organisation administrator can contact platform support");
        }
        Long companyId = scope.getFilterCompanyId() != null ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (companyId == null || !scope.canAccess(companyId)) throw new AccessDeniedException("Select an authorised company");
        return companyId;
    }

    private static boolean hasAuthority(UserPrincipal user, String authority) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return user != null && authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal principal
                && Objects.equals(principal.getId(), user.getId())
                && authentication.getAuthorities().stream().anyMatch(a -> authority.equals(a.getAuthority()));
    }

    public enum Status { OPEN, IN_PROGRESS, RESOLVED }
    public record Request(long id, long companyId, String companyName, String subject, String description,
                          Status status, String response, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    public record Inbox(boolean management, String companyName, List<Request> requests, boolean hasMore) {}
}
