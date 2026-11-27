package com.example.demo.performance;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

final class PerformanceDocuments {
    private PerformanceDocuments() {}

    static String jobDescriptionEmail(String company, String employee, String role, String department,
                                      JsonNode version, String note) {
        JsonNode fields = version.path("fields");
        StringBuilder html = new StringBuilder("<!doctype html><html><body style='margin:0;background:#f4f5f9;font-family:Arial,sans-serif;color:#202536'>")
                .append("<div style='max-width:760px;margin:24px auto;padding:0 16px'>")
                .append("<p style='font-size:12px;font-weight:700;letter-spacing:1px;color:#6854e8'>GRECHA HRMS</p>")
                .append("<div style='background:#fff;border:1px solid #e3e6ee;border-radius:12px;overflow:hidden'>")
                .append("<div style='padding:28px 32px;background:#f7f6ff;border-bottom:1px solid #e3e6ee'>")
                .append("<p style='margin:0 0 8px;color:#6854e8;font-size:12px;font-weight:700;letter-spacing:1px'>POSITION DESCRIPTION</p>")
                .append("<h1 style='margin:0;font-size:26px;line-height:1.25'>").append(escape(role)).append("</h1>")
                .append("<p style='margin:8px 0 0;color:#5b6475'>").append(escape(company)).append("</p></div>")
                .append("<div style='padding:24px 32px'>");
        if (!note.isBlank()) html.append("<p style='margin:0 0 20px;color:#4b5563'>").append(escape(note)).append("</p>");
        html.append("<table role='presentation' style='width:100%;border-collapse:collapse;margin-bottom:22px'><tbody>");
        if (!employee.isBlank()) row(html, "Employee", employee);
        if (!department.isBlank()) row(html, "Department", department);
        row(html, "Document version", "Version " + version.path("version").asText("1"));
        row(html, "Published", publishedDate(version.path("at").asText("")));
        html.append("</tbody></table>");
        Map<String, String> titles = Map.ofEntries(
                Map.entry("purpose", "Role purpose"), Map.entry("reportingTo", "Reporting relationship"),
                Map.entry("responsibleFor", "Key areas of ownership"), Map.entry("responsibilities", "Roles and responsibilities"),
                Map.entry("qualifications", "Qualifications and education"), Map.entry("experience", "Experience"),
                Map.entry("skills", "Skills and competencies"), Map.entry("workConditions", "Work conditions"),
                Map.entry("successMeasures", "Role outcomes and success measures"));
        for (String field : PerformanceWorkflow.JD_FIELDS)
            section(html, titles.get(field), fields.path(field).asText());
        html.append("</div></div><p style='padding:0 8px;color:#687184;font-size:12px'>This job description was shared from ")
                .append(escape(company)).append(" in GrechaHR.</p></div></body></html>");
        return html.toString();
    }

    private static void row(StringBuilder html, String label, String value) {
        html.append("<tr><td style='width:150px;padding:7px 10px 7px 0;color:#687184;font-size:12px;vertical-align:top'>")
                .append(escape(label)).append("</td><td style='padding:7px 0;color:#202536;font-size:13px;font-weight:600'>")
                .append(escape(value.isBlank() ? "—" : value)).append("</td></tr>");
    }

    private static void section(StringBuilder html, String title, String body) {
        html.append("<section style='margin-top:22px'><h2 style='margin:0 0 8px;font-size:15px;color:#202536'>")
                .append(escape(title)).append("</h2>");
        List<String> lines = body.lines().map(String::strip).filter(line -> !line.isBlank()).toList();
        boolean list = lines.size() > 1 && lines.stream().allMatch(PerformanceDocuments::isListItem);
        if (list) {
            html.append("<ul style='margin:0;padding-left:20px;color:#3f4757;font-size:14px;line-height:1.7'>");
            for (String line : lines) html.append("<li style='padding:2px 0'>").append(escape(trimListMarker(line))).append("</li>");
            html.append("</ul>");
        } else {
            html.append("<p style='margin:0;color:#3f4757;font-size:14px;line-height:1.7;white-space:pre-wrap'>")
                    .append(escape(body.isBlank() ? "—" : body)).append("</p>");
        }
        html.append("</section>");
    }

    private static boolean isListItem(String line) { return line.matches("^(?:[-*•]|\\d+[.)])\\s+.+"); }
    private static String trimListMarker(String line) { return line.replaceFirst("^(?:[-*•]|\\d+[.)])\\s+", ""); }
    private static String publishedDate(String value) {
        try {
            return DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)
                    .withZone(ZoneId.of("Asia/Dubai")).format(Instant.parse(value));
        } catch (RuntimeException exception) {
            return value;
        }
    }
    private static String escape(String value) { return HtmlUtils.htmlEscape(value == null ? "" : value); }
}
