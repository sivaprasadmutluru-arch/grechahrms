package com.example.demo.performance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/smart-performance")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class PerformanceController {
    private final PerformanceService service;
    private final PerformanceDrafts drafts;

    record Change(long revision, JsonNode values) {}
    record LibraryChange(long revision, boolean publish, JsonNode fields) {}
    record DeleteLibrary(long revision) {}
    record EmailJd(String to, String note, String recipientName) {}
    record AssignJd(java.util.List<Long> employeeIds, Boolean publish, Boolean sendEmail, String note) {}

    @PutMapping("/employees/{employeeId}/manager") public Object assignManager(Authentication authentication,
            @PathVariable long employeeId, @RequestBody JsonNode request) {
        Long managerId = request.hasNonNull("managerId") ? request.path("managerId").asLong() : null;
        return service.assignManager(authentication, employeeId, managerId);
    }

    @GetMapping("/overview") public Object overview(Authentication authentication) {
        return service.overview(authentication);
    }

    @GetMapping("/employees/{employeeId}") public Object record(Authentication authentication,
            @PathVariable long employeeId, @RequestParam(required = false) String cycleId) {
        return service.record(authentication, employeeId, cycleId);
    }

    @PostMapping("/employees/{employeeId}/jd-email") public Object emailJobDescription(Authentication authentication,
            @PathVariable long employeeId, @RequestBody EmailJd request) {
        return service.emailJobDescription(authentication, employeeId, request.to(), request.note(), request.recipientName());
    }

    @PostMapping("/employees/{employeeId}/{action}") public Object action(Authentication authentication,
            @PathVariable long employeeId, @PathVariable String action, @RequestBody Change change) {
        ObjectNode result = service.act(authentication, employeeId, action, change.revision(), required(change.values()));
        boolean isPublished = "jd-publish".equals(action) || ("jd-assign".equals(action) && change.values().path("publish").asBoolean(false));
        if (!isPublished) return result;

        JsonNode cycle = result.path("cycle");
        if (!result.path("currentCycle").asBoolean())
            return result.put("kpiAutoGeneration", "SKIPPED")
                    .put("kpiAutoMessage", "The JD was published. KPI drafts are generated for the current cycle only.");
        if (cycle.path("draft").isObject() || !PerformanceWorkflow.latest(cycle.path("approved")).isMissingNode()
                || "SUBMITTED".equals(cycle.path("status").asText()))
            return result.put("kpiAutoGeneration", "SKIPPED")
                    .put("kpiAutoMessage", "The JD was published. An existing KPI draft or approved set was kept unchanged.");

        try {
            ObjectNode kpiDraft = (ObjectNode) drafts.generate(authentication, employeeId, null, "kpi",
                    PerformanceWorkflow.object());
            kpiDraft.put("custom", false);
            ObjectNode saved = service.act(authentication, employeeId, "kpi-save",
                    result.path("revision").asLong(), kpiDraft);
            return saved.put("kpiAutoGeneration", "GENERATED")
                    .put("kpiAutoMessage", "A KPI draft was generated for this cycle. Review the measures and confirm targets before submitting it.");
        } catch (org.springframework.web.server.ResponseStatusException exception) {
            String reason = exception.getReason() == null ? "AI KPI generation is unavailable." : exception.getReason();
            return result.put("kpiAutoGeneration", "FAILED")
                    .put("kpiAutoMessage", "The JD was published, but KPI generation failed: " + reason);
        }
    }

    @GetMapping("/library") public Object library(Authentication authentication) {
        return service.library(authentication);
    }

    @PutMapping("/library/{roleId}") public Object library(Authentication authentication,
            @PathVariable String roleId, @RequestBody LibraryChange change) {
        return service.updateLibrary(authentication, roleId, change.revision(), change.publish(), required(change.fields()));
    }

    @PostMapping("/library/{roleId}/email") public Object emailMasterJobDescription(Authentication authentication,
            @PathVariable String roleId, @RequestBody EmailJd request) {
        return service.emailMasterJobDescription(authentication, roleId, request.to(), request.note(), request.recipientName());
    }

    @PostMapping("/library/create-role") public Object createRole(Authentication authentication,
            @RequestBody JsonNode request) {
        return service.createRoleAndJobDescription(authentication, required(request));
    }

    @PostMapping("/library/{roleId}/assign") public Object assignMasterJobDescription(Authentication authentication,
            @PathVariable String roleId, @RequestBody AssignJd request) {
        return service.assignMasterJobDescription(authentication, roleId, request.employeeIds(),
                Boolean.TRUE.equals(request.publish()), Boolean.TRUE.equals(request.sendEmail()), request.note());
    }

    @DeleteMapping("/library/{roleId}") public Object deleteLibrary(Authentication authentication,
            @PathVariable String roleId, @RequestBody DeleteLibrary request) {
        return service.deleteLibrary(authentication, roleId, request.revision());
    }

    @GetMapping("/settings") public Object settings(Authentication authentication) {
        return service.settings(authentication);
    }

    @PutMapping("/settings") public Object settings(Authentication authentication, @RequestBody Change change) {
        return service.updateSettings(authentication, change.revision(), required(change.values()));
    }

    @GetMapping("/archive") public Object archive(Authentication authentication,
            @RequestParam(required = false) Long id, @RequestParam(required = false) Long employeeId) {
        return service.archive(authentication, id, employeeId);
    }

    @PostMapping("/draft/{type}") public Object generate(Authentication authentication, @PathVariable String type,
            @RequestParam(required = false) Long employeeId, @RequestParam(required = false) String roleId,
            @RequestBody JsonNode body) {
        return drafts.generate(authentication, employeeId, roleId, type, required(body));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(Authentication authentication, @RequestPart MultipartFile file,
                                      @RequestParam(required = false) Long employeeId,
                                      @RequestParam(required = false) String roleId) {
        return Map.of("text", drafts.extract(authentication, employeeId, roleId, file));
    }

    @GetMapping("/report.csv") public ResponseEntity<byte[]> report(Authentication authentication) {
        JsonNode data = service.overview(authentication);
        StringBuilder csv = new StringBuilder("Employee,Department,JD status,KPI status,Next update,Overdue,Review status,Final rating\r\n");
        for (JsonNode row : data.path("employees")) {
            csv.append(String.join(",", List.of("name", "department", "jdStatus", "kpiStatus", "nextUpdate",
                    "overdue", "reviewStatus", "finalRating").stream().map(k -> csv(row.path(k).asText())).toList()));
            csv.append("\r\n");
        }
        return file("performance-overview.csv", MediaType.parseMediaType("text/csv;charset=UTF-8"), csv.toString());
    }

    @GetMapping("/employees/{employeeId}/document") public ResponseEntity<byte[]> document(
            Authentication authentication, @PathVariable long employeeId, @RequestParam(required = false) String cycleId) {
        JsonNode record = service.record(authentication, employeeId, cycleId);
        var jd = PerformanceWorkflow.latest(record.path("jd")).path("fields");
        var kpis = PerformanceWorkflow.latest(record.path("cycle").path("approved"));
        var period = record.path("settings");
        StringBuilder html = new StringBuilder("<!doctype html><html lang='en'><meta charset='UTF-8'><title>Performance record</title>"
                + "<style>body{font:16px system-ui;max-width:850px;margin:3rem auto;padding:0 1rem}"
                + "td,th{padding:.6rem;border:1px solid #ccc;text-align:left}table{width:100%;border-collapse:collapse}"
                + "p,td{white-space:pre-wrap}</style><h1>");
        html.append(escaped(record, "name")).append("</h1><p>").append(escaped(record, "designation"))
                .append(" · ").append(escaped(record, "department")).append("</p><p>")
                .append(escaped(period, "start")).append(" to ").append(escaped(period, "end")).append("</p>");
        html.append("<h2>Published job description</h2>");
        Map<String, String> titles = Map.ofEntries(
                Map.entry("purpose", "Role Purpose"), Map.entry("reportingTo", "Reporting To"),
                Map.entry("responsibleFor", "Responsible For"), Map.entry("responsibilities", "Roles & Responsibilities"),
                Map.entry("qualifications", "Qualifications & Education"), Map.entry("experience", "Experience"),
                Map.entry("skills", "Skills & Competencies"), Map.entry("workConditions", "Work Conditions"),
                Map.entry("successMeasures", "Role Outcomes & Success Measures"));
        for (String field : PerformanceWorkflow.JD_FIELDS) html.append("<h3>").append(titles.get(field))
                .append("</h3><p>").append(escaped(jd, field)).append("</p>");
        html.append("<h2>Approved KPIs</h2><table><thead><tr><th>KPI Description</th><th>Agreed Target / Measure</th>");
        boolean weights = kpis.path("custom").asBoolean();
        if (weights) html.append("<th>Weightage</th>");
        html.append("</tr></thead><tbody>");
        for (JsonNode item : kpis.path("items")) {
            html.append("<tr><td>").append(escaped(item, "description")).append("</td><td>")
                    .append(escaped(item, "target")).append("</td>");
            if (weights) html.append("<td>").append(escaped(item, "weight")).append("%</td>");
            html.append("</tr>");
        }
        html.append("</tbody></table>");
        var review = record.path("cycle").path("review");
        if ("RELEASED".equals(review.path("status").asText())) html.append("<h2>Final review</h2><p>Overall rating ")
                .append(escaped(review, "finalRating")).append(" · Computed score ").append(escaped(review, "score")).append("</p>");
        html.append("</html>");
        return file("performance-" + employeeId + ".html", MediaType.TEXT_HTML, html.toString());
    }

    private static String escaped(JsonNode node, String name) { return HtmlUtils.htmlEscape(node.path(name).asText()); }

    private static JsonNode required(JsonNode node) {
        if (node == null || !node.isObject()) throw PerformanceWorkflow.invalid("A request object is required.");
        return node;
    }

    private static String csv(String input) {
        String safe = input;
        String leading = input.stripLeading();
        if (!leading.isEmpty() && "=+-@".indexOf(leading.charAt(0)) >= 0) safe = "'" + safe;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private static ResponseEntity<byte[]> file(String name, MediaType type, String value) {
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(value.getBytes(StandardCharsets.UTF_8));
    }
}
