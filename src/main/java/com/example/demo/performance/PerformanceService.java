package com.example.demo.performance;

import com.example.demo.auth.entity.UserRole;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.base.entity.Department;
import com.example.demo.base.entity.JobPosition;
import com.example.demo.base.repository.DepartmentRepository;
import com.example.demo.base.repository.JobPositionRepository;
import com.example.demo.base.repository.JobRoleRepository;
import com.example.demo.base.service.EmailService;
import com.example.demo.carr.repository.CarrKpiRepository;
import com.example.demo.carr.repository.CarrRecordRepository;
import com.example.demo.carr.repository.CarrResponsibilityRepository;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.service.ReportingManagerService;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import jakarta.mail.internet.InternetAddress;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.example.demo.performance.PerformanceWorkflow.*;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class PerformanceService {
    private final PerformanceStore store;
    private final PerformanceAccess access;
    private final JobRoleRepository roles;
    private final JobPositionRepository positions;
    private final DepartmentRepository departments;
    private final NotificationService notifications;
    private final EmailService emailService;
    private final UserRoleRepository assignments;
    private final CarrRecordRepository legacy;
    private final CarrKpiRepository legacyKpis;
    private final CarrResponsibilityRepository legacyResponsibilities;
    private final ReportingManagerService reportingManagers;
    private final EmployeeRepository employees;

    record RoleOption(String id, String name, String department, String kind) {}

    ObjectNode overview(Authentication auth) {
        var scope = access.scope(auth);
        var records = store.list(scope.companyId(), "employee");
        var settings = currentSettings(scope.companyId());
        ObjectNode result = object().put("company", scope.company().getName()).put("hr", scope.hr());
        if (scope.self() != null) result.put("selfId", scope.self().getId());
        result.set("settings", settings);
        ArrayNode employees = result.putArray("employees");
        boolean editor = scope.hr();
        for (Employee employee : access.staff(scope)) {
            var rights = access.access(scope, employee);
            editor |= rights.edit();
            var saved = records.get(employee.getId().toString());
            var data = saved == null ? object() : saved.data();
            var cycle = data.path("cycles").path(settings.path("id").asText());
            var approved = latest(cycle.path("approved"));
            ObjectNode row = identity(rights);
            row.put("jdStatus", jdStatus(data.path("jd"), rights.own()));
            row.put("kpiStatus", kpiStatus(cycle, rights.own()));
            var review = cycle.path("review");
            if (!rights.own() || released(review)) row.put("reviewStatus", review.path("status").asText("NOT_STARTED"));
            else row.put("reviewStatus", "NOT_RELEASED");
            if (released(review)) {
                row.set("finalRating", review.path("finalRating"));
                row.set("score", review.path("score"));
            }
            if (!approved.isMissingNode()) {
                LocalDate due = monitoringDue(settings, cycle);
                if (due != null) row.put("nextUpdate", due.toString());
                row.put("overdue", due != null && LocalDate.now(ZONE).isAfter(due) && !released(review));
                row.put("reviewDue", settings.path("reviewDate").asText());
            }
            employees.add(row);
        }
        return result.put("editor", editor);
    }

    @Transactional
    ObjectNode assignManager(Authentication auth, long employeeId, Long managerId) {
        var scope = access.scope(auth);
        var right = access.record(scope, employeeId);
        if (!scope.hr()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Only HR can update an employee’s reporting manager here.");
        reportingManagers.assign(right.employee(), managerId);
        Employee manager = right.employee().getReportingManager();
        ObjectNode result = object().put("manager", name(manager));
        if (manager != null) result.put("managerId", manager.getId());
        else result.putNull("managerId");
        return result;
    }

    ObjectNode record(Authentication auth, long employee, String requestedCycle) {
        var rights = access.record(access.scope(auth), employee);
        var saved = store.get(rights.scope().companyId(), "employee", Long.toString(employee));
        return view(rights, saved, requestedCycle);
    }

    @Transactional
    ObjectNode emailJobDescription(Authentication auth, long employeeId, String recipient, String note, String recipientName) {
        var scope = access.scope(auth);
        var right = access.record(scope, employeeId);
        require(right.edit() || right.own());
        var saved = store.get(scope.companyId(), "employee", Long.toString(employeeId));
        JsonNode version = latest(saved.data().path("jd"));
        if (version.isMissingNode()) throw invalid("Publish a job description before emailing it.");
        Employee employee = right.employee();
        String employeeName = (recipientName != null && !recipientName.isBlank()) ? recipientName.strip()
                : (Objects.toString(employee.getFirstName(), "") + " " + Objects.toString(employee.getLastName(), "")).strip();
        String to = (recipient != null && !recipient.isBlank()) ? recipient : employee.getEmail();
        if (to == null || to.isBlank()) throw invalid("Enter at least one recipient email address.");
        String title = role(employee) == null ? "Job Description" : role(employee).name();
        return sendJobDescriptionEmail(scope, employee, employeeName, title,
                employee.getDepartment() == null ? "" : employee.getDepartment().getName(), version, to, note);
    }

    @Transactional
    ObjectNode emailMasterJobDescription(Authentication auth, String roleId, String recipient, String note, String recipientName) {
        var scope = access.scope(auth);
        require(scope.hr() || hasReports(scope));
        RoleOption option = roleOptions(scope).stream().filter(row -> row.id().equals(roleId)).findFirst()
                .orElseThrow(PerformanceAccess::denied);
        JsonNode version = latest(store.get(scope.companyId(), "library", roleId).data());
        if (version.isMissingNode()) throw invalid("Publish this master job description before emailing it.");
        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName.strip() : "";
        return sendJobDescriptionEmail(scope, null, displayName, option.name(), option.department(), version, recipient, note);
    }

    @Transactional
    ObjectNode assignMasterJobDescription(Authentication auth, String roleId, List<Long> employeeIds,
                                          boolean publish, boolean sendEmail, String note) {
        var scope = access.scope(auth);
        require(scope.hr() || hasReports(scope));
        if (employeeIds == null || employeeIds.isEmpty()) {
            throw invalid("Select at least one employee to assign.");
        }
        RoleOption option = roleOptions(scope).stream().filter(row -> row.id().equals(roleId)).findFirst()
                .orElseThrow(PerformanceAccess::denied);
        JsonNode master = latest(store.get(scope.companyId(), "library", roleId).data());
        if (master.isMissingNode()) throw invalid("Publish this master job description before assigning it.");

        var settings = currentSettings(scope.companyId());
        String currentCycleId = settings.path("id").asText();
        int assignedCount = 0;
        int publishedCount = 0;
        int emailedCount = 0;
        List<String> errors = new ArrayList<>();

        for (Long employeeId : employeeIds) {
            try {
                var right = access.record(scope, employeeId);
                require(right.edit());
                String key = Long.toString(employeeId);
                var stored = store.get(scope.companyId(), "employee", key);
                ObjectNode document = stored.data();
                ObjectNode jd = child(document, "jd");
                ObjectNode cycles = child(document, "cycles");
                ObjectNode cycle = child(cycles, currentCycleId);
                cycle.set("settings", settings.deepCopy());

                if (publish) {
                    publishJd(jd, cleanJd(master.path("fields"), true), scope.user());
                    ObjectNode version = (ObjectNode) latest(jd);
                    if (version != null) {
                        version.put("masterRole", roleId).put("masterVersion", master.path("version").asInt());
                    }
                    jd.put("masterRole", roleId).put("masterVersion", master.path("version").asInt());
                    notify(right.employee(), scope, "Job description published", "Review and acknowledge your job description.", employeeId);
                    publishedCount++;
                } else {
                    jd.set("draft", cleanJd(master.path("fields"), true));
                    jd.put("masterRole", roleId).put("masterVersion", master.path("version").asInt());
                }

                store.save(scope.companyId(), "employee", key, stored.revision(), document);
                assignedCount++;

                try {
                    if (roleId.startsWith("position-")) {
                        long posId = Long.parseLong(roleId.substring("position-".length()));
                        positions.findById(posId).ifPresent(p -> {
                            right.employee().setJobPosition(p);
                            if (p.getDepartment() != null && right.employee().getDepartment() == null) {
                                right.employee().setDepartment(p.getDepartment());
                            }
                            employees.save(right.employee());
                        });
                    }
                } catch (Exception ex) {
                    log.warn("Could not set position on employee {}: {}", employeeId, ex.getMessage());
                }
                syncReportingManagerFromJd(right.employee(), master.path("fields"), scope.companyId());

                if (sendEmail && right.employee().getEmail() != null && !right.employee().getEmail().isBlank()) {
                    try {
                        sendJobDescriptionEmail(scope, right.employee(), name(right.employee()), option.name(),
                                right.employee().getDepartment() == null ? "" : right.employee().getDepartment().getName(),
                                master, right.employee().getEmail(), note);
                        emailedCount++;
                    } catch (Exception ex) {
                        log.warn("Could not email JD to {}: {}", right.employee().getEmail(), ex.getMessage());
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not assign JD to employee {}: {}", employeeId, ex.getMessage());
                errors.add("Employee #" + employeeId + ": " + ex.getMessage());
            }
        }

        ObjectNode response = object()
                .put("assigned", assignedCount)
                .put("published", publishedCount)
                .put("emailed", emailedCount)
                .put("roleName", option.name())
                .put("message", "Assigned " + option.name() + " to " + assignedCount + " employee(s)."
                        + (publish ? " Published successfully." : " Saved as draft.")
                        + (sendEmail ? " Emailed to " + emailedCount + " employee(s)." : ""));
        if (!errors.isEmpty()) {
            ArrayNode errorArray = response.putArray("errors");
            errors.forEach(errorArray::add);
        }
        return response;
    }

    private ObjectNode sendJobDescriptionEmail(PerformanceAccess.Scope scope, Employee employee, String employeeName,
                                               String title, String department, JsonNode version,
                                               String recipient, String note) {
        String to = recipient == null ? "" : recipient.strip();
        if (to.isBlank()) throw invalid("Enter at least one recipient email address.");
        String[] addresses = to.split("[,;\\s]+");
        List<String> validRecipients = new ArrayList<>();
        for (String addr : addresses) {
            String clean = addr.strip();
            if (clean.isEmpty()) continue;
            try {
                InternetAddress parsed = new InternetAddress(clean, true);
                parsed.validate();
                validRecipients.add(parsed.getAddress());
            } catch (Exception exception) {
                throw invalid("Invalid email address: " + clean);
            }
        }
        if (validRecipients.isEmpty()) throw invalid("Enter at least one valid recipient email address.");
        if (note != null && note.length() > 2000) throw invalid("The email note is limited to 2,000 characters.");

        String company = scope.company().getName();
        String subject = "Job Description – " + title + " – " + company;
        String html = PerformanceDocuments.jobDescriptionEmail(company, employeeName, title, department, version,
                note == null ? "" : note.strip());
        int sentCount = 0;
        List<String> failed = new ArrayList<>();
        for (String email : validRecipients) {
            boolean sent = emailService.sendEmail(scope.companyId(), email, subject, html, employee);
            if (sent) {
                sentCount++;
            } else {
                failed.add(email);
            }
        }
        if (sentCount == 0 && !emailService.hasActiveSmtpConfig(scope.companyId())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Company email settings are not configured or failed to deliver. Ask an administrator to configure SMTP.");
        }
        if (sentCount == 0) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "The JD email could not be delivered to " + String.join(", ", failed) + ". Please verify the email address and SMTP configuration.");
        }
        return object().put("message", "Job description emailed to " + String.join(", ", validRecipients) + ".");
    }

    private ObjectNode view(PerformanceAccess.RecordAccess right, PerformanceStore.Document saved, String requestedCycle) {
        ObjectNode settings = currentSettings(right.scope().companyId());
        String currentId = settings.path("id").asText();
        String requested = requestedCycle == null ? currentId : requestedCycle;
        JsonNode cycles = saved.data().path("cycles");
        JsonNode selected = cycles.path(requested);
        if (!requested.equals(currentId) && selected.isMissingNode()) throw invalid("This performance cycle is unavailable.");

        ObjectNode result = identity(right).put("revision", saved.revision()).put("currentCycle", requested.equals(currentId));
        result.set("settings", requested.equals(currentId) ? settings : selected.path("settings"));
        ObjectNode jd = object();
        JsonNode storedJd = saved.data().path("jd");
        if (right.edit()) jd = storedJd.isObject() ? (ObjectNode) storedJd.deepCopy() : object();
        else if (storedJd.has("versions")) jd.set("versions", storedJd.path("versions"));
        result.set("jd", jd);

        ObjectNode cycle = selected.isObject() ? (ObjectNode) selected.deepCopy() : object();
        ArrayNode periods = result.putArray("cycles");
        periods.add(settings);
        cycles.properties().stream().filter(entry -> !entry.getKey().equals(currentId))
                .map(entry -> entry.getValue().path("settings")).forEach(periods::add);
        if (right.own()) {
            cycle.remove(List.of("draft", "approvalEvents", "submittedBy", "submittedRole", "changeComment", "lastEditedBy", "lastEditedRole"));
            if (!released(cycle.path("review"))) cycle.remove("review");
        }
        JsonNode review = cycle.path("review");
        result.put("reviewOpen", !LocalDate.now(ZONE).isBefore(date(result.path("settings"), "reviewDate"))
                && (review.isMissingNode() || "DRAFT".equals(review.path("status").asText())));
        result.put("canDecide", canDecide(right, cycle));
        result.put("canRelease", right.calibrate() && "SUBMITTED".equals(review.path("status").asText())
                && review.path("submittedBy").asLong(-1) != right.scope().user());
        result.set("cycle", cycle);
        ArrayNode mgrs = result.putArray("managers");
        try {
            employees.findByCompanyIdAndIsActiveTrue(right.scope().companyId()).stream()
                    .filter(emp -> !emp.getId().equals(right.employee().getId()))
                    .sorted(Comparator.comparing(Employee::getFirstName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .forEach(emp -> {
                        String fullName = Stream.of(emp.getFirstName(), emp.getLastName())
                                .filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(" "));
                        String designation = emp.getJobPosition() != null ? emp.getJobPosition().getName() : "";
                        String department = emp.getDepartment() != null ? emp.getDepartment().getName() : "";
                        mgrs.add(object()
                                .put("id", emp.getId())
                                .put("name", fullName)
                                .put("designation", designation)
                                .put("department", department));
                    });
        } catch (Exception ignored) {}
        return result;
    }

    @Transactional
    ObjectNode act(Authentication auth, long employeeId, String action, long revision, JsonNode payload) {
        var right = access.record(access.scope(auth), employeeId);
        var scope = right.scope();
        String key = Long.toString(employeeId);
        var stored = store.get(scope.companyId(), "employee", key);
        if (revision != stored.revision()) throw PerformanceStore.conflict();
        ObjectNode document = stored.data();
        var settings = currentSettings(scope.companyId());
        String current = settings.path("id").asText();
        String requested = text(payload, "cycleId", 80, false);
        if (requested.isEmpty()) requested = current;
        boolean currentCycle = current.equals(requested);
        ObjectNode cycles = child(document, "cycles");
        if (!currentCycle && !cycles.has(requested)) throw invalid("This performance cycle is unavailable.");
        ObjectNode jd = child(document, "jd");
        ObjectNode cycle = child(cycles, requested);
        if (currentCycle) cycle.set("settings", settings.deepCopy());

        if (!right.employee().isActive() && !action.endsWith("acknowledge"))
            throw invalid("This inactive employee’s record is kept for reference.");
        switch (action) {
            case "jd-save" -> {
                require(right.edit());
                jd.set("draft", cleanJd(payload, false));
            }
            case "jd-assign" -> {
                require(right.edit());
                String role = text(payload, "roleId", 80, true);
                RoleOption option = roleOptions(scope).stream().filter(item -> item.id().equals(role)).findFirst()
                        .orElseThrow(PerformanceAccess::denied);
                JsonNode master = latest(store.get(scope.companyId(), "library", role).data());
                if (master.isMissingNode()) throw invalid("Publish this master job description before assigning it.");
                boolean publish = payload.path("publish").asBoolean(false);
                if (publish) {
                    publishJd(jd, cleanJd(master.path("fields"), true), scope.user());
                    ObjectNode version = (ObjectNode) latest(jd);
                    if (version != null) {
                        version.put("masterRole", role).put("masterVersion", master.path("version").asInt());
                    }
                    jd.put("masterRole", role).put("masterVersion", master.path("version").asInt());
                    notify(right.employee(), scope, "Job description published", "Review and acknowledge your job description.", employeeId);
                } else {
                    jd.set("draft", cleanJd(master.path("fields"), true));
                    jd.put("masterRole", role).put("masterVersion", master.path("version").asInt());
                }
                if (role.startsWith("position-")) {
                    try {
                        long posId = Long.parseLong(role.substring("position-".length()));
                        positions.findById(posId).ifPresent(p -> {
                            right.employee().setJobPosition(p);
                            if (p.getDepartment() != null && right.employee().getDepartment() == null) {
                                right.employee().setDepartment(p.getDepartment());
                            }
                            employees.save(right.employee());
                        });
                    } catch (Exception ex) {
                        log.warn("Could not set position on employee {}: {}", employeeId, ex.getMessage());
                    }
                }
                syncReportingManagerFromJd(right.employee(), master.path("fields"), scope.companyId());

                if (payload.path("sendEmail").asBoolean(false) && right.employee().getEmail() != null && !right.employee().getEmail().isBlank()) {
                    try {
                        sendJobDescriptionEmail(scope, right.employee(), name(right.employee()), option.name(),
                                right.employee().getDepartment() == null ? "" : right.employee().getDepartment().getName(),
                                master, right.employee().getEmail(), payload.path("note").asText(""));
                    } catch (Exception ex) {
                        log.warn("Could not email JD during assignment to {}: {}", right.employee().getEmail(), ex.getMessage());
                    }
                }
            }
            case "jd-publish" -> {
                require(right.edit());
                publishJd(jd, cleanJd(payload, true), scope.user());
                ObjectNode version = (ObjectNode) latest(jd);
                if (jd.has("masterRole")) {
                    version.set("masterRole", jd.path("masterRole"));
                    version.set("masterVersion", jd.path("masterVersion"));
                }
                syncReportingManagerFromJd(right.employee(), payload, scope.companyId());
                notify(right.employee(), scope, "Job description published", "Review and acknowledge your job description.", employeeId);
            }
            case "jd-acknowledge" -> {
                require(right.own());
                acknowledge(version(jd, payload), scope.user(), "");
            }
            case "kpi-save", "kpi-submit" -> {
                require(right.edit());
                boolean submit = "kpi-submit".equals(action);
                if (!currentCycle || !approved(cycle).isMissingNode() || "SUBMITTED".equals(cycle.path("status").asText()))
                    throw invalid("This KPI set is no longer editable as a draft.");
                if (submit && right.manager() == null)
                    throw invalid("Assign a reporting manager before submitting KPIs for approval.");
                if (latest(jd).isMissingNode()) throw invalid("Publish the employee job description first.");
                boolean custom = payload.path("custom").asBoolean();
                ObjectNode draft = object().put("custom", custom);
                draft.set("items", items(payload, custom, submit, cycle.path("draft").path("items")));
                cycle.set("draft", draft);
                cycle.put("status", submit ? "SUBMITTED" : "DRAFT");
                if (submit) {
                    String role = right.manages() ? "MANAGER" : "HR";
                    cycle.put("submittedBy", scope.user()).put("submittedRole", role);
                    array(cycle, "approvalEvents").add(event(scope.user()).put("action", "SUBMITTED").put("role", role));
                    String message = name(right.employee()) + "’s proposed KPIs are ready to review.";
                    if ("HR".equals(role)) notify(right.manager(), scope, "KPIs ready for approval", message, employeeId);
                    else notifyHr(scope, "KPIs ready for approval", message, employeeId);
                }
            }
            case "kpi-approve", "kpi-request-changes" -> {
                require(canDecide(right, cycle));
                boolean approve = "kpi-approve".equals(action);
                var approval = event(scope.user()).put("action", approve ? "APPROVED" : "CHANGES_REQUESTED");
                if (approve) {
                    publishKpis(cycle, (ObjectNode) cycle.path("draft").deepCopy(), scope.user());
                    cycle.remove(List.of("draft", "changeComment"));
                    cycle.put("status", "APPROVED");
                    notify(right.employee(), scope, "KPIs approved", "Review and acknowledge your approved KPIs.", employeeId);
                } else {
                    String comment = text(payload, "comment", 3000, true);
                    approval.put("comment", comment);
                    cycle.put("status", "CHANGES_REQUESTED").put("changeComment", comment);
                    notifyUser(cycle.path("submittedBy").asLong(), scope, "KPI changes requested", name(right.employee()) + "’s KPI draft needs changes.", employeeId);
                }
                array(cycle, "approvalEvents").add(approval);
            }
            case "kpi-acknowledge" -> {
                require(right.own());
                acknowledge(version(child(cycle, "approved"), payload), scope.user(), "");
            }
            case "kpi-amend" -> {
                require(right.manages());
                if (!currentCycle || approved(cycle).isMissingNode())
                    throw invalid("Only the current approved KPI set can be amended.");
                boolean custom = payload.path("custom").asBoolean();
                ObjectNode replacement = object().put("custom", custom);
                replacement.set("items", items(payload, custom, true, approved(cycle).path("items")));
                publishKpis(cycle, replacement, scope.user());
                notify(right.employee(), scope, "KPI targets updated", "Your manager updated your KPI targets. Review and acknowledge the new version.", employeeId);
            }
            case "progress" -> {
                require(right.manages());
                if (!currentCycle || released(cycle.path("review"))) throw invalid("This cycle is closed for progress updates.");
                addProgress(cycle, payload, scope.user());
            }
            case "review-save", "review-submit" -> {
                require(right.manages());
                boolean submit = "review-submit".equals(action);
                saveReview(cycle, payload, currentCycle ? settings : cycle.path("settings"), scope.user(), submit);
                if (submit) notifyHr(scope, "Performance review ready for HR",
                        name(right.employee()) + "’s formal review is ready for calibration.", employeeId);
            }
            case "review-release" -> {
                require(right.calibrate());
                ObjectNode review = child(cycle, "review");
                if (!"SUBMITTED".equals(review.path("status").asText()) || review.path("submittedBy").asLong(-1) == scope.user())
                    throw invalid("A different HR reviewer must finalise the submitted review.");
                int finalRating = rating(payload, "finalRating", true);
                int recommendation = review.path("recommendation").asInt();
                review.put("status", "RELEASED").put("finalRating", finalRating)
                        .put("calibrationReason", text(payload, "reason", 3000, recommendation > 0 && recommendation != finalRating));
                review.set("release", event(scope.user()));
                notify(right.employee(), scope, "Performance review available", "Read your final review and acknowledge the discussion.", employeeId);
            }
            case "review-acknowledge" -> {
                require(right.own());
                ObjectNode review = child(cycle, "review");
                if (!released(review)) throw invalid("Wait for HR to release the review.");
                acknowledge(review, scope.user(), text(payload, "comment", 3000, false));
            }
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (cycle.size() == 1) cycles.remove(requested);
        return view(right, store.save(scope.companyId(), "employee", key, revision, document), requested);
    }

    private static ObjectNode version(ObjectNode track, JsonNode payload) {
        if (!(latest(track) instanceof ObjectNode v) || v.path("version").asInt() != payload.path("version").asInt(-1))
            throw invalid("Open the latest published version before acknowledging it.");
        return v;
    }

    private static boolean canDecide(PerformanceAccess.RecordAccess right, JsonNode cycle) {
        if (!"SUBMITTED".equals(cycle.path("status").asText()) || right.scope().user() == cycle.path("submittedBy").asLong(-1))
            return false;
        return switch (cycle.path("submittedRole").asText()) {
            case "HR" -> right.manages();
            case "MANAGER" -> right.calibrate();
            default -> false;
        };
    }

    private static void publishKpis(ObjectNode cycle, ObjectNode content, long actor) {
        ObjectNode track = child(cycle, "approved");
        ArrayNode history = array(track, "versions");
        ObjectNode version = event(actor).put("version", history.size() + 1);
        version.set("items", content.path("items").deepCopy());
        version.put("custom", content.path("custom").asBoolean());
        history.add(version);
    }

    private static void saveReview(ObjectNode cycle, JsonNode payload, JsonNode settings, long actor, boolean submit) {
        if (approved(cycle).isMissingNode()) throw invalid("Approve the KPI set before reviewing it.");
        if (LocalDate.now(ZONE).isBefore(date(settings, "reviewDate"))) throw invalid("The formal review has not opened.");
        ObjectNode review = child(cycle, "review");
        if (review.has("status") && !"DRAFT".equals(review.path("status").asText())) throw invalid("This review is already submitted.");
        if (!review.has("snapshot")) {
            review.set("snapshot", approved(cycle).deepCopy());
            review.set("scale", settings.path("scale").deepCopy());
            review.set("created", event(actor));
        }
        JsonNode snapshot = review.path("snapshot");
        ObjectNode results = ratings(payload.path("ratings"), snapshot, submit);
        review.set("ratings", results);
        BigDecimal calculated = score(snapshot.path("items"), results, snapshot.path("custom").asBoolean());
        if (calculated != null) review.put("score", calculated); else review.remove("score");
        int recommendation = rating(payload, "recommendation", false);
        if (recommendation > 0) review.put("recommendation", recommendation); else review.remove("recommendation");
        review.put("status", submit ? "SUBMITTED" : "DRAFT");
        if (submit) {
            review.put("submittedBy", actor);
            review.set("submission", event(actor));
        }
    }

    private static int rating(JsonNode body, String key, boolean required) {
        JsonNode value = body.path(key);
        if (!required && (value.isMissingNode() || value.isNull())) return 0;
        if (!value.isIntegralNumber() || value.intValue() < 1 || value.intValue() > 3)
            throw invalid("Select a rating from 1 to 3.");
        return value.intValue();
    }

    ObjectNode library(Authentication auth) {
        var scope = access.scope(auth);
        var options = roleOptions(scope);
        if (options.isEmpty() && !scope.hr() && !hasReports(scope)) throw PerformanceAccess.denied();
        var templates = store.list(scope.companyId(), "library");
        ObjectNode result = object();
        ArrayNode entries = result.putArray("roles");
        for (RoleOption option : options) {
            ObjectNode row = object().put("id", option.id()).put("name", option.name())
                    .put("department", option.department()).put("kind", option.kind());
            var saved = templates.get(option.id());
            row.put("revision", saved == null ? 0 : saved.revision());
            if (saved != null) row.set("document", saved.data());
            entries.add(row);
        }
        ArrayNode depts = result.putArray("departments");
        try {
            departments.findByCompanyIdAndIsActiveTrue(scope.companyId()).forEach(d ->
                    depts.add(object().put("id", d.getId()).put("name", d.getName())));
        } catch (Exception ignored) {}
        ArrayNode mgrs = result.putArray("managers");
        try {
            employees.findByCompanyIdAndIsActiveTrue(scope.companyId()).stream()
                    .sorted(Comparator.comparing(Employee::getFirstName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .forEach(emp -> {
                        String fullName = Stream.of(emp.getFirstName(), emp.getLastName())
                                .filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(" "));
                        String designation = emp.getJobPosition() != null ? emp.getJobPosition().getName() : "";
                        String department = emp.getDepartment() != null ? emp.getDepartment().getName() : "";
                        mgrs.add(object()
                                .put("id", emp.getId())
                                .put("name", fullName)
                                .put("designation", designation)
                                .put("department", department));
                    });
        } catch (Exception ignored) {}
        return result;
    }

    @Transactional
    ObjectNode createRoleAndJobDescription(Authentication auth, JsonNode payload) {
        var scope = access.scope(auth);
        require(scope.hr());
        String title = text(payload, "title", 180, true);
        Long departmentId = payload.hasNonNull("departmentId") && !payload.path("departmentId").asText().isBlank()
                ? payload.path("departmentId").asLong() : null;
        Department dept = null;
        if (departmentId != null && departmentId > 0) {
            dept = departments.findById(departmentId).orElse(null);
        }
        if (dept == null) {
            var activeDepts = departments.findByCompanyIdAndIsActiveTrue(scope.companyId());
            if (!activeDepts.isEmpty()) {
                dept = activeDepts.get(0);
            } else {
                var allDepts = departments.findByCompanyId(scope.companyId());
                if (!allDepts.isEmpty()) dept = allDepts.get(0);
                else throw invalid("Please create at least one department first before creating a job position.");
            }
        }
        JobPosition position = new JobPosition();
        position.setName(title);
        position.setDepartment(dept);
        position.setCompany(scope.company());
        position.setActive(true);
        position = positions.save(position);

        String roleKey = "position-" + position.getId();
        boolean publish = payload.path("publish").asBoolean(false);
        JsonNode fields = payload.path("fields");
        if (fields.isObject() && !fields.isEmpty()) {
            ObjectNode document = object();
            if (publish) {
                publishJd(document, cleanJd(fields, true), scope.user());
            } else {
                document.set("draft", cleanJd(fields, false));
            }
            store.save(scope.companyId(), "library", roleKey, 0L, document);
        }
        ObjectNode res = library(auth);
        res.put("createdRoleId", roleKey);
        return res;
    }

    @Transactional
    ObjectNode updateLibrary(Authentication auth, String role, long revision, boolean publish, JsonNode fields) {
        var scope = access.scope(auth);
        require(roleOptions(scope).stream().anyMatch(option -> option.id().equals(role)));
        var existing = store.get(scope.companyId(), "library", role);
        if (revision != existing.revision()) throw PerformanceStore.conflict();
        var document = existing.data();
        if (publish) publishJd(document, cleanJd(fields, true), scope.user());
        else document.set("draft", cleanJd(fields, false));
        store.save(scope.companyId(), "library", role, revision, document);
        return library(auth);
    }

    @Transactional
    ObjectNode deleteLibrary(Authentication auth, String role, long revision) {
        var scope = access.scope(auth);
        require(scope.hr());
        require(roleOptions(scope).stream().anyMatch(option -> option.id().equals(role)));
        var existing = store.get(scope.companyId(), "library", role);
        if (revision != existing.revision()) throw PerformanceStore.conflict();
        if (revision == 0 || (!existing.data().has("draft") && existing.data().path("versions").isEmpty()))
            throw invalid("There is no saved master job description to delete.");
        store.delete(scope.companyId(), "library", role, revision);
        return library(auth);
    }

    private List<RoleOption> roleOptions(PerformanceAccess.Scope scope) {
        Map<String, RoleOption> result = new TreeMap<>();
        if (scope.hr()) {
            positions.findByCompanyId(scope.companyId()).stream().filter(p -> p.isActive())
                    .forEach(p -> result.put("position-" + p.getId(), new RoleOption("position-" + p.getId(), p.getName(),
                            p.getDepartment() == null ? "" : p.getDepartment().getName(), "POSITION")));
            // Keep already-published JobRole templates accessible for history; new JDs are position-based.
            var savedTemplates = store.list(scope.companyId(), "library");
            roles.findByCompanyId(scope.companyId()).stream().filter(r -> r.isActive())
                    .filter(r -> savedTemplates.containsKey("role-" + r.getId()))
                    .forEach(r -> result.put("role-" + r.getId(), new RoleOption("role-" + r.getId(), r.getName(),
                            r.getJobPosition() == null || r.getJobPosition().getDepartment() == null ? "" : r.getJobPosition().getDepartment().getName(), "LEGACY_ROLE")));
        }
        access.staff(scope).stream().filter(e -> scope.hr() || access.access(scope, e).manages())
                .map(PerformanceService::role).filter(Objects::nonNull).forEach(r -> result.put(r.id(), r));
        return result.values().stream().sorted(Comparator.comparing(RoleOption::name, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    private boolean hasReports(PerformanceAccess.Scope scope) {
        return access.staff(scope).stream().anyMatch(e -> access.access(scope, e).manages());
    }

    ObjectNode settings(Authentication auth) {
        var scope = access.scope(auth);
        require(scope.hr());
        var doc = store.get(scope.companyId(), "settings", "company");
        ObjectNode response = object().put("revision", doc.revision());
        response.set("settings", currentSettings(scope.companyId()));
        response.set("history", doc.data().path("history"));
        return response;
    }

    @Transactional
    ObjectNode updateSettings(Authentication auth, long revision, JsonNode body) {
        var scope = access.scope(auth);
        require(scope.hr());
        var existing = store.get(scope.companyId(), "settings", "company");
        if (existing.revision() != revision) throw PerformanceStore.conflict();
        ObjectNode previous = currentSettings(scope.companyId());
        String monitoring = text(body, "monitoring", 15, true);
        String review = text(body, "frequency", 15, true);
        if (!Set.of("MONTHLY", "QUARTERLY").contains(monitoring)
                || !Set.of("QUARTERLY", "HALF_YEARLY", "ANNUAL").contains(review)) throw invalid("Select supported frequencies.");
        LocalDate start = date(body, "start");
        LocalDate end = date(body, "end");
        LocalDate reviewDate = date(body, "reviewDate");
        if (end.isBefore(start) || reviewDate.isBefore(start) || reviewDate.isAfter(end.plusMonths(6)))
            throw invalid("Set valid cycle and formal review dates.");
        boolean datesChanged = !start.equals(date(previous, "start")) || !end.equals(date(previous, "end"));
        if (datesChanged && existing.revision() > 0 && start.isBefore(LocalDate.now(ZONE)))
            throw invalid("A new cycle must start today or later.");
        ObjectNode next = object().put("id", datesChanged ? uid() : previous.path("id").asText())
                .put("monitoring", monitoring).put("frequency", review).put("start", start.toString())
                .put("end", end.toString()).put("reviewDate", reviewDate.toString());
        ArrayNode scale = next.putArray("scale");
        JsonNode proposed = body.path("scale");
        if (!proposed.isArray() || proposed.size() != 3) throw invalid("Provide labels and definitions for the three fixed ratings.");
        for (int i = 0; i < 3; i++) scale.add(object().put("value", i + 1)
                .put("label", text(proposed.get(i), "label", 60, true))
                .put("definition", text(proposed.get(i), "definition", 700, true)));
        ObjectNode document = existing.data();
        array(document, "history").add(event(scope.user()).set("settings", previous));
        document.set("current", next);
        store.save(scope.companyId(), "settings", "company", revision, document);
        return settings(auth);
    }

    ObjectNode currentSettings(long company) {
        var existing = store.get(company, "settings", "company").data().path("current");
        if (existing instanceof ObjectNode node) return node;
        LocalDate today = LocalDate.now(ZONE);
        LocalDate start = today.withMonth(((today.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1);
        LocalDate end = start.plusMonths(3).minusDays(1);
        ObjectNode defaults = object().put("id", start.toString()).put("monitoring", "MONTHLY")
                .put("frequency", "QUARTERLY").put("start", start.toString()).put("end", end.toString())
                .put("reviewDate", end.toString());
        defaults.putArray("scale")
                .add(object().put("value", 1).put("label", "Developing").put("definition", "Below agreed expectations; improvement required."))
                .add(object().put("value", 2).put("label", "Dependable").put("definition", "Consistently meets agreed expectations."))
                .add(object().put("value", 3).put("label", "High Impact").put("definition", "Exceeds expectations and creates measurable additional value."));
        return defaults;
    }

    @Transactional
    public void reminders(long companyId, LocalDate today) {
        var settings = currentSettings(companyId);
        var candidates = store.list(companyId, "employee");
        if (candidates.isEmpty()) return;
        for (var row : candidates.entrySet()) {
            JsonNode cycle = row.getValue().data().path("cycles").path(settings.path("id").asText());
            if (approved(cycle).isMissingNode() || released(cycle.path("review"))) continue;
            long employeeId = Long.parseLong(row.getKey());
            var target = access.companyEmployeeForReminder(companyId, employeeId);
            if (target == null || target.manager() == null || target.manager().getUser() == null) continue;
            LocalDate due = monitoringDue(settings, cycle);
            if (due != null && !today.isBefore(due)) {
                String key = settings.path("id").asText() + ":update:" + due + (today.isAfter(due) ? ":overdue" : ":due");
                if (store.claimReminder(companyId, employeeId, key)) notifications.send(target.manager().getUser().getId(),
                        today.isAfter(due) ? "KPI progress update overdue" : "KPI progress update due",
                        "Update KPI progress for " + name(target.employee()) + ".", Notification.NotificationType.GENERAL,
                        "SMART_PERFORMANCE", employeeId, target.employee().getCompany());
            }
            LocalDate reviewDate = date(settings, "reviewDate");
            if (!today.isBefore(reviewDate) && !"SUBMITTED".equals(cycle.path("review").path("status").asText())
                    && store.claimReminder(companyId, employeeId, settings.path("id").asText() + ":review:" + reviewDate)) {
                notifications.send(target.manager().getUser().getId(), "Performance review due",
                        "Complete the formal review for " + name(target.employee()) + ".", Notification.NotificationType.GENERAL,
                        "SMART_PERFORMANCE", employeeId, target.employee().getCompany());
            }
        }
    }

    static LocalDate monitoringDue(JsonNode settings, JsonNode cycle) {
        LocalDate start = date(settings, "start");
        LocalDate end = date(settings, "end");
        int months = "QUARTERLY".equals(settings.path("monitoring").asText()) ? 3 : 1;
        LocalDate period = start;
        var currentKpis = approved(cycle);
        int version = currentKpis.path("version").asInt();
        Map<String, String> latest = new HashMap<>();
        cycle.path("progress").forEach(entry -> {
            if (entry.path("version").asInt() == version)
                latest.put(entry.path("id").asText(), entry.path("date").asText());
        });
        while (!period.isAfter(end)) {
            String periodStart = period.toString();
            boolean updated = StreamSupport.stream(currentKpis.path("items").spliterator(), false)
                    .allMatch(item -> latest.getOrDefault(item.path("id").asText(), "").compareTo(periodStart) >= 0);
            LocalDate next = period.plusMonths(months);
            if (!updated) {
                LocalDate deadline = next.minusDays(1);
                return deadline.isAfter(end) ? end : deadline;
            }
            period = next;
        }
        return null;
    }

    Object archive(Authentication auth, Long id, Long employeeId) {
        var scope = access.scope(auth);
        if (id != null) {
            var row = legacy.findByIdAndCompanyId(id, scope.companyId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            var rights = access.record(scope, row.getEmployee().getId());
            if (rights.own() && row.getPublishedAt() == null) throw PerformanceAccess.denied();
            ObjectNode result = legacyRow(row);
            result.put("purpose", row.getPurpose()).put("reportingTo", row.getReportsToTitle())
                    .put("responsibleFor", row.getResponsibleFor());
            legacyResponsibilities.findByCarrIdOrderById(row.getId()).forEach(item ->
                    array(result, "responsibilities").add(item.getStatement()));
            legacyKpis.findByCarrIdOrderById(row.getId()).forEach(item -> array(result, "measures")
                    .add(object().put("description", item.getName()).put("measure", item.getMetricDefinition())
                            .put("target", item.getTargetValue()).put("actual", item.getActualValue())));
            return result;
        }
        if (employeeId != null) {
            var rights = access.record(scope, employeeId);
            return legacy.findByCompanyIdAndEmployeeIdOrderByUpdatedAtDesc(scope.companyId(), employeeId).stream()
                    .filter(row -> !rights.own() || row.getPublishedAt() != null).map(PerformanceService::legacyRow).toList();
        }
        require(scope.hr());
        return legacy.findByCompanyIdOrderByUpdatedAtDesc(scope.companyId()).stream()
                .map(PerformanceService::legacyRow).toList();
    }

    private static ObjectNode legacyRow(com.example.demo.carr.entity.CarrRecord record) {
        return object().put("id", record.getId()).put("employee", name(record.getEmployee()))
                .put("title", record.getTitle()).put("status", record.getStatus().name()).put("version", record.getVersion())
                .put("date", Objects.toString(record.getEffectiveFrom(), ""));
    }

    PerformanceAccess.RecordAccess generationAccess(Authentication auth, Long employee, String role) {
        var scope = access.scope(auth);
        if (employee == null) {
            if (scope.hr()) return new PerformanceAccess.RecordAccess(scope, null, null, false, false);
            require(roleOptions(scope).stream().anyMatch(option -> option.id().equals(role)));
            return new PerformanceAccess.RecordAccess(scope, null, null, false, false);
        }
        var right = access.record(scope, employee);
        require(right.edit());
        return right;
    }

    ObjectNode generationContext(Authentication auth, Long employeeId, String roleId, boolean kpi) {
        var right = generationAccess(auth, employeeId, roleId);
        var employee = right.employee();
        ObjectNode result = object().put("company", right.scope().company().getName());
        if (employee == null) {
            String roleName = roleOptions(right.scope()).stream()
                    .filter(r -> r.id().equals(roleId))
                    .map(RoleOption::name)
                    .findFirst()
                    .orElse(roleId != null && !roleId.isBlank() && !roleId.startsWith("position-") && !roleId.startsWith("role-") ? roleId : "New Role");
            result.put("role", roleName);
            return result;
        }
        var designation = role(employee);
        result.put("role", designation != null ? designation.name() : "Employee");
        if (employee.getDepartment() != null) result.put("department", employee.getDepartment().getName());
        if (right.manager() != null && role(right.manager()) != null) result.put("reportingLine", role(right.manager()).name());
        if (kpi) {
            var document = store.get(right.scope().companyId(), "employee", employeeId.toString()).data();
            var published = latest(document.path("jd"));
            if (published.isMissingNode()) throw invalid("Publish the employee job description before generating KPIs.");
            // Do not send personal names or additional employee records to the generation provider.
            var roleJd = (ObjectNode) published.path("fields").deepCopy();
            roleJd.put("reportingTo", result.path("reportingLine").asText());
            result.set("publishedJobDescription", roleJd);
            if (employee.getDepartment() != null) {
                Employee head = employee.getDepartment().getManager();
                if (head != null && head.getCompany() != null && head.getCompany().getId().equals(right.scope().company().getId())) {
                    String current = currentSettings(right.scope().companyId()).path("id").asText();
                    JsonNode items = approved(store.get(right.scope().companyId(), "employee", head.getId().toString()).data()
                            .path("cycles").path(current)).path("items");
                    ArrayNode headMeasures = result.putArray("departmentMeasures");
                    items.forEach(item -> headMeasures.add(object().put("description", item.path("description").asText())));
                }
            }
        }
        return result;
    }

    private static RoleOption role(Employee employee) {
        if (employee.getJobPosition() != null)
            return new RoleOption("position-" + employee.getJobPosition().getId(), employee.getJobPosition().getName(),
                    employee.getJobPosition().getDepartment() == null ? "" : employee.getJobPosition().getDepartment().getName(), "POSITION");
        if (employee.getJobRole() != null) return new RoleOption("role-" + employee.getJobRole().getId(), employee.getJobRole().getName(),
                employee.getJobRole().getJobPosition() == null || employee.getJobRole().getJobPosition().getDepartment() == null ? "" : employee.getJobRole().getJobPosition().getDepartment().getName(), "LEGACY_ROLE");
        return null;
    }

    private static ObjectNode identity(PerformanceAccess.RecordAccess right) {
        Employee employee = right.employee();
        RoleOption role = role(employee);
        return object().put("id", employee.getId()).put("name", name(employee))
                .put("employeeCode", Objects.toString(employee.getBadgeId(), ""))
                .put("email", Objects.toString(employee.getEmail(), ""))
                .put("company", right.scope().company().getName())
                .put("joined", Objects.toString(employee.getDateJoining(), ""))
                .put("department", employee.getDepartment() != null ? employee.getDepartment().getName() : "")
                .put("designation", role == null ? "" : role.name()).put("roleId", role == null ? "" : role.id())
                .put("manager", name(right.manager())).put("managerId", right.manager() == null ? null : right.manager().getId())
                .put("own", right.own()).put("editor", right.edit())
                .put("managerEdit", right.manages()).put("hr", right.calibrate());
    }

    private static String name(Employee employee) {
        if (employee == null) return "";
        return (Objects.toString(employee.getFirstName(), "") + " " + Objects.toString(employee.getLastName(), "")).strip();
    }

    private static JsonNode approved(JsonNode cycle) { return latest(cycle.path("approved")); }
    private static boolean released(JsonNode review) { return "RELEASED".equals(review.path("status").asText()); }

    private static String jdStatus(JsonNode jd, boolean own) {
        var version = latest(jd);
        if (!version.isMissingNode()) return version.has("acknowledgement") ? "ACKNOWLEDGED" : "PUBLISHED";
        return !own && jd.has("draft") ? "DRAFT" : "NOT_ASSIGNED";
    }

    private static String kpiStatus(JsonNode cycle, boolean own) {
        var version = approved(cycle);
        if (!version.isMissingNode()) return version.has("acknowledgement") ? "ACKNOWLEDGED" : "APPROVED";
        return own ? "NOT_ASSIGNED" : cycle.path("status").asText("NOT_ASSIGNED");
    }

    private static LocalDate date(JsonNode node, String field) {
        try { return LocalDate.parse(node.path(field).asText()); }
        catch (DateTimeParseException e) { throw invalid("Choose a valid " + field + "."); }
    }

    private void syncReportingManagerFromJd(Employee employee, JsonNode fields, Long companyId) {
        if (employee == null || fields == null) return;
        Long managerId = null;
        if (fields.hasNonNull("reportingManagerId") && fields.path("reportingManagerId").asLong() > 0) {
            managerId = fields.path("reportingManagerId").asLong();
        } else if (fields.hasNonNull("reportingTo")) {
            String reportingTo = fields.path("reportingTo").asText("").trim();
            managerId = resolveManagerId(companyId, reportingTo);
        }
        if (managerId != null && !managerId.equals(employee.getId())) {
            try {
                reportingManagers.assign(employee, managerId);
                log.info("Synced reporting manager of employee {} to {} based on assigned/published JD", employee.getId(), managerId);
            } catch (Exception ex) {
                log.warn("Could not sync reporting manager for employee {}: {}", employee.getId(), ex.getMessage());
            }
        }
    }

    private Long resolveManagerId(Long companyId, String reportingTo) {
        if (reportingTo == null || reportingTo.isBlank()) return null;
        String clean = reportingTo.trim().toLowerCase();
        try {
            long id = Long.parseLong(clean);
            if (employees.findById(id).filter(e -> e.isActive() && Objects.equals(e.getCompany().getId(), companyId)).isPresent()) {
                return id;
            }
        } catch (NumberFormatException ignored) {}

        List<Employee> companyStaff = employees.findByCompanyIdAndIsActiveTrue(companyId);
        for (Employee emp : companyStaff) {
            String fullName = java.util.stream.Stream.of(emp.getFirstName(), emp.getLastName())
                    .filter(s -> s != null && !s.isBlank()).collect(java.util.stream.Collectors.joining(" ")).toLowerCase();
            if (!fullName.isBlank() && (clean.equals(fullName) || clean.startsWith(fullName) || fullName.startsWith(clean))) {
                return emp.getId();
            }
            if (emp.getEmail() != null && clean.equalsIgnoreCase(emp.getEmail().trim())) {
                return emp.getId();
            }
        }
        for (Employee emp : companyStaff) {
            if (emp.getJobPosition() != null) {
                String posName = emp.getJobPosition().getName().trim().toLowerCase();
                if (!posName.isBlank() && (clean.contains(posName) || posName.contains(clean))) {
                    return emp.getId();
                }
            }
        }
        return null;
    }

    private static void require(boolean allowed) { if (!allowed) throw PerformanceAccess.denied(); }

    private void notifyHr(PerformanceAccess.Scope scope, String title, String message, long employeeId) {
        LocalDate today = LocalDate.now(ZONE);
        Long parent = scope.company().getParentCompanyId();
        var companyIds = parent == null ? List.of(scope.companyId()) : List.of(scope.companyId(), parent);
        assignments.findByCompanyIdIn(companyIds).stream()
                .filter(role -> role.isEffectiveOn(today) && role.getUser() != null && role.getUser().isActive()
                        && role.getRole() != null && PerformanceAccess.HR.contains("ROLE_" + role.getRole().getName())
                        && role.getAccessScope() != UserRole.AccessScope.SELF
                        && role.getAccessScope() != UserRole.AccessScope.DEPARTMENT
                        && (role.getCompany() != null && (role.getCompany().getId().equals(scope.companyId())
                            || role.getAccessScope() == UserRole.AccessScope.ENTERPRISE
                            || role.getAccessScope() == UserRole.AccessScope.HEAD_OFFICE)))
                .map(role -> role.getUser().getId()).filter(user -> user != scope.user()).distinct()
                .forEach(user -> notifyUser(user, scope, title, message, employeeId));
    }

    private void notify(Employee recipient, PerformanceAccess.Scope scope, String title, String message, long id) {
        if (recipient != null && recipient.getUser() != null) notifyUser(recipient.getUser().getId(), scope, title, message, id);
    }

    private void notifyUser(long userId, PerformanceAccess.Scope scope, String title, String message, long id) {
        if (userId > 0) notifications.send(userId, title, message, Notification.NotificationType.GENERAL,
                "SMART_PERFORMANCE", id, scope.company());
    }
}
