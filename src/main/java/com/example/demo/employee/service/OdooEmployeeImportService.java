package com.example.demo.employee.service;

import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.base.repository.DepartmentRepository;
import com.example.demo.base.repository.JobPositionRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.dto.EmployeeRequest;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OdooEmployeeImportService {
    private final OdooEmployeeClient client;
    private final CompanyRepository companies;
    private final DepartmentRepository departments;
    private final JobPositionRepository jobs;
    private final EmployeeRepository employees;
    private final EmployeeService employeeService;
    private final ReportingManagerService managers;
    private final TransactionTemplate transaction;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Map<UUID, Snapshot> previews = new HashMap<>();

    public record Preview(UUID token, String companyName, List<PreviewRow> rows) {}
    public record PreviewRow(long sourceId, String name, String email, String department, String job,
                             String manager, boolean ready, String note) {}
    public record ImportResult(int imported, int linkedManagers, List<String> warnings) {}
    private record Snapshot(Long userId, Long companyId, Instant expires, List<Plan> rows) {}
    private record Plan(OdooEmployeeClient.EmployeeRow row, String email, String badge, Long department,
                        Long job, Long existing, String note, boolean ready) {}
    record Target(Long userId, String companyName) {}

    public Preview preview(Long companyId, String url, String database, String apiKey, long sourceCompany) {
        Target target = target(companyId);
        var data = client.read(url, database, apiKey, sourceCompany);
        String namespace = namespace(url, database, sourceCompany);
        List<Plan> plans = transaction.execute(status -> plan(companyId, namespace, data));
        UUID token = UUID.randomUUID();
        synchronized (previews) {
            previews.values().removeIf(p -> p.expires().isBefore(Instant.now())
                    || p.userId().equals(target.userId()));
            if (previews.size() >= 32) throw new BadRequestException("Too many active previews. Try again in a few minutes.");
            previews.put(token, new Snapshot(target.userId(), companyId, Instant.now().plusSeconds(600), List.copyOf(plans)));
        }
        return new Preview(token, target.companyName(), plans.stream().map(p -> new PreviewRow(
                p.row().id(), p.row().name(), p.email(), p.row().department(), p.row().job(),
                p.row().manager(), p.ready(), p.note())).toList());
    }

    public ImportResult commit(Long companyId, UUID token) {
        Target target = target(companyId);
        Snapshot snapshot;
        synchronized (previews) {
            snapshot = previews.get(token);
            if (snapshot == null || !snapshot.userId().equals(target.userId()) || !snapshot.companyId().equals(companyId)
                    || !snapshot.expires().isAfter(Instant.now()))
                throw new BadRequestException("The preview expired or belongs to another company. Fetch a new preview.");
            previews.remove(token);
        }
        Map<Long, Long> imported = new LinkedHashMap<>();
        Map<Long, Long> managerIds = new HashMap<>();
        List<String> warnings = new ArrayList<>();
        for (Plan p : snapshot.rows()) {
            if (p.existing() != null) managerIds.put(p.row().id(), p.existing());
            if (!p.ready()) continue;
            try {
                var request = toRequest(companyId, p);
                var created = employeeService.create(request);
                imported.put(p.row().id(), created.getId());
                managerIds.put(p.row().id(), created.getId());
            } catch (BadRequestException e) {
                warnings.add("Odoo employee #" + p.row().id() + ": " + e.getMessage());
            } catch (RuntimeException e) {
                warnings.add("Odoo employee #" + p.row().id() + " could not be created. Check the employee details.");
            }
        }
        int linked = 0;
        for (Plan p : snapshot.rows()) {
            Long employeeId = imported.get(p.row().id());
            if (employeeId == null || p.row().managerId() == null) continue;
            Long managerId = managerIds.get(p.row().managerId());
            if (managerId == null) {
                warnings.add("Odoo employee #" + p.row().id() + ": reporting manager could not be matched.");
                continue;
            }
            try {
                transaction.executeWithoutResult(status -> managers.assign(
                        employees.findById(employeeId).filter(e -> companyId.equals(e.getCompany().getId())).orElseThrow(), managerId));
                linked++;
            } catch (RuntimeException e) {
                warnings.add("Odoo employee #" + p.row().id() + ": reporting manager was not assigned.");
            }
        }
        return new ImportResult(imported.size(), linked, warnings);
    }

    private List<Plan> plan(Long companyId, String namespace, List<OdooEmployeeClient.EmployeeRow> data) {
        var targetDepartments = departments.findByCompanyId(companyId);
        var targetJobs = jobs.findByCompanyId(companyId);
        Set<String> emails = new HashSet<>();
        List<Plan> result = new ArrayList<>();
        for (var row : data) {
            String email = norm(row.email());
            String badge = "ODOO-" + namespace + "-" + row.id();
            Optional<Employee> existing = employees.findFirstByNormalizedBadgeId(badge);
            if (existing.isEmpty() && !email.isEmpty()) existing = employees.findFirstByNormalizedEmail(email);
            if (existing.isPresent()) {
                Employee match = existing.get();
                Long activeMatch = companyId.equals(match.getCompany().getId()) && match.isActive() ? match.getId() : null;
                result.add(new Plan(row, email, badge, null, null, activeMatch,
                        "Skipped: employee identity already exists", false));
                continue;
            }
            if (!email.isEmpty() && (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length() > 254 || !emails.add(email))) {
                result.add(new Plan(row, email, badge, null, null, null, "Skipped: invalid or duplicate work email", false));
                continue;
            }
            if (row.name() == null || row.name().length() > 200 || row.phone() != null && row.phone().length() > 50) {
                result.add(new Plan(row, email, badge, null, null, null, "Skipped: missing name or invalid contact details", false));
                continue;
            }
            var ds = targetDepartments.stream().filter(d -> d.isActive() && matches(d.getName(), row.department())).toList();
            Long department = ds.size() == 1 ? ds.getFirst().getId() : null;
            var js = targetJobs.stream().filter(j -> j.isActive() && matches(j.getName(), row.job())
                    && j.getDepartment() != null && Objects.equals(department, j.getDepartment().getId())).toList();
            Long job = js.size() == 1 ? js.getFirst().getId() : null;
            List<String> notes = new ArrayList<>();
            if (row.department() != null && department == null) notes.add("department not matched");
            if (row.job() != null && job == null) notes.add("job position not matched");
            if (email.isEmpty()) notes.add("no work email; no login created");
            result.add(new Plan(row, email, badge, department, job, null,
                    notes.isEmpty() ? "Ready" : "Ready · " + String.join("; ", notes), true));
        }
        return result;
    }

    private EmployeeRequest toRequest(Long companyId, Plan p) {
        EmployeeRequest req = new EmployeeRequest();
        req.setCompanyId(companyId);
        String[] names = p.row().name().split("\\s+", 2);
        req.setFirstName(names[0]);
        req.setLastName(names.length == 2 ? names[1] : null);
        req.setBadgeId(p.badge());
        if (!p.email().isEmpty()) {
            req.setEmail(p.email());
            req.setWorkEmail(p.email());
            // Do not let the default phone-based initial password apply to migrated accounts.
            byte[] bytes = new byte[24];
            RANDOM.nextBytes(bytes);
            req.setPassword("Ga9!" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
        }
        req.setWorkPhone(p.row().phone());
        req.setDepartmentId(p.department());
        req.setJobPositionId(p.job());
        return req;
    }

    Target target(Long companyId) {
        var scope = AccessScopeContext.get();
        if (scope == null || scope.getUserId() == null || scope.isSelfScope()
                || scope.getScope() == com.example.demo.auth.entity.UserRole.AccessScope.DEPARTMENT
                || !Objects.equals(scope.getCompanyId(), companyId)
                || !scope.canAccess(companyId)
                || scope.getFilterCompanyId() != null && !scope.getFilterCompanyId().equals(companyId))
            throw new AccessDeniedException("Select an authorized Grecha company first.");
        var company = companies.findById(companyId).filter(c -> c.isActive()
                        && c.getStatus() == com.example.demo.base.entity.Company.CompanyStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("The selected Grecha company is unavailable."));
        var owner = company.isHeadOffice() ? company : companies.findById(company.getParentCompanyId()).orElseThrow(
                () -> new BadRequestException("The selected Grecha company has no workspace."));
        if (!owner.isSchemaReady() || owner.getSchemaName() == null || !owner.getSchemaName().equals(TenantContext.getTenant()))
            throw new AccessDeniedException("Select the target company in the Grecha company switcher before importing.");
        return new Target(scope.getUserId(), company.getName());
    }

    static String namespace(String url, String database, long sourceCompany) {
        String host = OdooEmployeeClient.cloudEndpoint(url).getHost();
        String db = database == null || database.isBlank() ? host.substring(0, host.indexOf('.')) : database.trim();
        return UUID.nameUUIDFromBytes((host + ":" + db + ":" + sourceCompany)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    private static boolean matches(String target, String source) {
        return source != null && !norm(source).isEmpty() && norm(source).equals(norm(target));
    }

    private static String norm(String text) { return text == null ? "" : text.trim().toLowerCase(Locale.ROOT); }
}
