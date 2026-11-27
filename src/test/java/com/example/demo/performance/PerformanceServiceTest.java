package com.example.demo.performance;

import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static com.example.demo.performance.PerformanceWorkflow.object;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PerformanceServiceTest {
    @Mock PerformanceStore store;
    @Mock PerformanceAccess access;
    @Mock Authentication hr;
    @Mock Authentication manager;
    @Mock Authentication employee;
    @Mock com.example.demo.notification.service.NotificationService notifications;
    @Mock com.example.demo.auth.repository.UserRoleRepository assignments;
    @Mock com.example.demo.base.service.EmailService emailService;
    @Mock com.example.demo.base.repository.JobPositionRepository positions;
    @Mock com.example.demo.base.repository.JobRoleRepository roles;
    @Mock com.example.demo.base.repository.DepartmentRepository departments;
    @Mock com.example.demo.employee.repository.EmployeeRepository employees;
    @InjectMocks PerformanceService service;

    private final Company company = new Company();
    private final Employee worker = new Employee();
    private final Employee lead = new Employee();
    private final String cycle = "2026-test";
    private long revision;
    private PerformanceStore.Document saved = new PerformanceStore.Document(0, object());

    @BeforeEach
    void fixture() {
        company.setId(1L);
        worker.setId(20L);
        lead.setId(30L);
        var now = LocalDate.now(PerformanceWorkflow.ZONE);
        var current = object().put("id", cycle).put("start", now.minusMonths(1).toString())
                .put("end", now.plusDays(1).toString()).put("reviewDate", now.toString()).put("monitoring", "MONTHLY");
        current.putArray("scale").add(object().put("value", 1).put("label", "Developing"))
                .add(object().put("value", 2).put("label", "Dependable"))
                .add(object().put("value", 3).put("label", "High Impact"));
        var settings = object();
        settings.set("current", current);
        when(store.get(1L, "settings", "company")).thenReturn(new PerformanceStore.Document(1, settings));
        when(store.get(1L, "employee", "20")).thenAnswer(call ->
                new PerformanceStore.Document(saved.revision(), saved.data().deepCopy()));
        when(store.save(eq(1L), eq("employee"), eq("20"), anyLong(), any())).thenAnswer(call -> {
            saved = new PerformanceStore.Document(call.<Long>getArgument(3) + 1,
                    call.<com.fasterxml.jackson.databind.node.ObjectNode>getArgument(4).deepCopy());
            return saved;
        });
        grant(hr, new PerformanceAccess.Scope(1L, company, null, true), false, false);
        grant(manager, new PerformanceAccess.Scope(2L, company, lead, false), false, true);
        grant(employee, new PerformanceAccess.Scope(3L, company, worker, false), true, false);
    }

    private void grant(Authentication auth, PerformanceAccess.Scope scope, boolean own, boolean manages) {
        when(access.scope(auth)).thenReturn(scope);
        when(access.record(scope, 20L)).thenReturn(new PerformanceAccess.RecordAccess(scope, worker, lead, own, manages));
    }

    private JsonNode action(Authentication auth, String action, JsonNode values) {
        var result = service.act(auth, 20L, action, revision, values);
        revision = result.path("revision").asLong();
        return result;
    }

    @Test
    void requiresCrossRoleApprovalKeepsDraftsPrivateAndPreservesAReleasedReviewSnapshot() {
        action(hr, "jd-publish", object().put("purpose", "Financial reporting")
                .put("reportingTo", "Finance manager").put("responsibleFor", "Monthly accounts")
                .put("responsibilities", "Reconcile bank statements")
                .put("qualifications", "Accounting qualification or equivalent experience")
                .put("experience", "Relevant accounting experience")
                .put("skills", "Reconciliation and financial reporting")
                .put("workConditions", "Office-based with month-end deadlines")
                .put("successMeasures", "Accurate reconciliations completed by agreed deadlines"));
        var proposal = object();
        proposal.putArray("items").add(object().put("description", "Close accounts").put("target", "Sign-off by agreed deadline"));
        action(hr, "kpi-submit", proposal);
        assertThrows(ResponseStatusException.class, () -> action(hr, "kpi-approve", object()));
        assertThrows(ResponseStatusException.class, () -> action(employee, "kpi-approve", object()));
        assertFalse(service.record(employee, 20L, cycle).path("cycle").has("draft"));
        action(manager, "kpi-request-changes", object().put("comment", "Add the evidence source"));
        action(hr, "kpi-submit", proposal);
        var approved = action(manager, "kpi-approve", object());
        String id = PerformanceWorkflow.latest(approved.path("cycle").path("approved")).path("items").get(0).path("id").asText();
        action(employee, "kpi-acknowledge", object().put("version", 1));
        action(manager, "progress", object().put("id", id).put("status", "ON_TRACK"));
        assertEquals("ON_TRACK", service.record(employee, 20L, cycle).path("cycle").path("progress").get(0).path("status").asText());

        var ratings = object();
        ratings.putObject("ratings").putObject(id).put("rating", 2);
        ratings.put("recommendation", 2);
        action(manager, "review-save", ratings);
        assertFalse(service.record(employee, 20L, cycle).path("cycle").has("review"));
        action(manager, "review-submit", ratings);
        assertThrows(ResponseStatusException.class, () -> action(hr, "review-release", object().put("finalRating", 3)));
        action(hr, "review-release", object().put("finalRating", 3).put("reason", "Reviewed additional outcomes"));
        var amend = object();
        amend.putArray("items").add(object().put("id", id).put("description", "Close accounts").put("target", "Use the new deadline"));
        action(manager, "kpi-amend", amend);

        var visible = service.record(employee, 20L, cycle).path("cycle");
        assertEquals(3, visible.path("review").path("finalRating").asInt());
        assertEquals(2, visible.path("review").path("score").asInt());
        assertEquals("Sign-off by agreed deadline", visible.path("review").path("snapshot").path("items").get(0).path("target").asText());
        assertEquals("Use the new deadline", PerformanceWorkflow.latest(visible.path("approved")).path("items").get(0).path("target").asText());
        assertFalse(PerformanceWorkflow.latest(visible.path("approved")).has("acknowledgement"));
        action(employee, "review-acknowledge", object());
        assertTrue(service.record(employee, 20L, cycle).path("cycle").path("review").has("acknowledgement"));
    }

    @Test
    void assignMasterJobDescriptionAssignsAndPublishesToEmployees() {
        var pos = new com.example.demo.base.entity.JobPosition();
        pos.setId(5L);
        pos.setName("Backend Engineer");
        pos.setActive(true);
        when(positions.findByCompanyId(1L)).thenReturn(java.util.List.of(pos));

        var master = object();
        var versions = master.putArray("versions");
        var version = object().put("version", 1);
        version.putObject("fields")
                .put("purpose", "Develop backend services")
                .put("reportingTo", "Engineering Lead")
                .put("responsibleFor", "Backend systems")
                .put("responsibilities", "Write clean Java code");
        versions.add(version);
        when(store.get(1L, "library", "position-5")).thenReturn(new PerformanceStore.Document(1, master));

        var response = service.assignMasterJobDescription(hr, "position-5", java.util.List.of(20L), true, false, null);
        assertEquals(1, response.path("assigned").asInt());
        assertEquals(1, response.path("published").asInt());
        assertEquals("Backend Engineer", response.path("roleName").asText());

        var record = service.record(hr, 20L, cycle);
        assertEquals("position-5", record.path("jd").path("masterRole").asText());
        assertEquals(1, record.path("jd").path("masterVersion").asInt());
    }

    @Test
    void emailMasterJobDescriptionSupportsOutsideCandidatesAndMultipleRecipients() {
        company.setName("Grecha Technologies");
        var pos = new com.example.demo.base.entity.JobPosition();
        pos.setId(8L);
        pos.setName("QA Engineer");
        pos.setActive(true);
        when(positions.findByCompanyId(1L)).thenReturn(java.util.List.of(pos));

        var master = object();
        var versions = master.putArray("versions");
        var version = object().put("version", 1);
        version.putObject("fields")
                .put("purpose", "Ensure software quality")
                .put("reportingTo", "QA Lead")
                .put("responsibleFor", "Test quality")
                .put("responsibilities", "Execute automated test suites");
        versions.add(version);
        when(store.get(1L, "library", "position-8")).thenReturn(new PerformanceStore.Document(1, master));

        when(emailService.sendEmail(eq(1L), anyString(), anyString(), anyString(), isNull())).thenReturn(true);

        var result = service.emailMasterJobDescription(hr, "position-8", "candidate@external.com, recruiter@external.com",
                "Please review the attached JD.", "Alex Candidate");

        assertTrue(result.path("message").asText().contains("candidate@external.com"));
        assertTrue(result.path("message").asText().contains("recruiter@external.com"));
        verify(emailService, times(2)).sendEmail(eq(1L), anyString(), contains("QA Engineer"), anyString(), isNull());
    }
}
