package com.example.demo.employee.service;

import com.example.demo.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Flow;

@Component
public class OdooEmployeeClient {
    static final int MAX_EMPLOYEES = 500;
    private static final int PAGE = 100;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper json;

    public OdooEmployeeClient(ObjectMapper json) { this.json = json; }

    public record EmployeeRow(long id, String name, String email, String phone,
                              String department, String job, Long managerId, String manager) {}

    public List<EmployeeRow> read(String url, String database, String key, long sourceCompany) {
        URI base = cloudEndpoint(url);
        List<EmployeeRow> rows = new ArrayList<>();
        long after = 0;
        while (true) {
            JsonNode page = readPage(base, database, key, "hr.employee",
                    List.of(List.of("company_id", "=", sourceCompany), List.of("active", "=", true)), after,
                    List.of("id", "name", "work_email", "work_phone", "mobile_phone", "department_id", "job_id", "parent_id", "company_id"));
            if (page.isEmpty()) return rows;
            for (JsonNode row : page) {
                long id = row.path("id").asLong();
                if (id <= after || relationId(row, "company_id") == null || relationId(row, "company_id") != sourceCompany)
                    throw new BadRequestException("Odoo returned unexpected employee IDs or company data. Import stopped.");
                after = id;
                String mobile = field(row, "mobile_phone");
                rows.add(new EmployeeRow(id, field(row, "name"), field(row, "work_email"),
                        mobile == null ? field(row, "work_phone") : mobile, relationName(row, "department_id"),
                        relationName(row, "job_id"), relationId(row, "parent_id"), relationName(row, "parent_id")));
                if (rows.size() > MAX_EMPLOYEES)
                    throw new BadRequestException("This company exceeds the 500-employee API preview limit. Use the employee file import.");
            }
            if (page.size() < PAGE) return rows;
        }
    }

    JsonNode historyPage(String url, String database, String key, boolean leave, long company,
                         String from, String toExclusive, long after) {
        return readPage(cloudEndpoint(url), database, key, leave ? "hr.leave" : "hr.attendance",
                leave ? List.of(List.of("employee_id.company_id", "=", company), List.of("state", "=", "validate"),
                        List.of("request_date_from", ">=", from), List.of("request_date_from", "<", toExclusive))
                     : List.of(List.of("employee_id.company_id", "=", company),
                        List.of("check_in", ">=", from), List.of("check_in", "<", toExclusive)),
                after, leave ? List.of("id", "employee_id", "holiday_status_id", "request_date_from", "request_date_to",
                        "number_of_days", "request_unit_half", "request_unit_hours", "request_date_from_period", "request_date_to_period")
                        : List.of("id", "employee_id", "check_in", "check_out", "worked_hours"));
    }

    static URI cloudEndpoint(String input) {
        try {
            URI uri = URI.create(input.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                    || !host.toLowerCase(Locale.ROOT).matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.odoo\\.com")
                    || uri.getUserInfo() != null || uri.getPort() != -1 || uri.getQuery() != null || uri.getFragment() != null
                    || !Set.of("", "/").contains(uri.getPath())) throw new IllegalArgumentException();
            return URI.create("https://" + host.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Enter an Odoo Online URL, for example https://your-company.odoo.com.");
        }
    }

    private JsonNode readPage(URI base, String database, String key, String model,
                              List<List<?>> filters, long after, List<String> fields) {
        try {
            List<List<?>> domain = new ArrayList<>(filters);
            domain.add(List.of("id", ">", after));
            String body = json.writeValueAsString(Map.of(
                    "domain", domain, "fields", fields,
                    "order", "id asc", "limit", PAGE));
            var builder = HttpRequest.newBuilder(base.resolve("/json/2/" + model + "/search_read")).timeout(Duration.ofSeconds(12))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json");
            if (database != null && !database.isBlank()) builder.header("X-Odoo-Database", database.trim());
            var response = http.sendAsync(builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                    info -> new BoundedBody()).orTimeout(15, java.util.concurrent.TimeUnit.SECONDS).join();
            if (response.statusCode() != 200)
                throw new BadRequestException("Odoo returned HTTP " + response.statusCode()
                        + ". Check that JSON-2 is available and the API key can read the selected module.");
            JsonNode result = json.readTree(response.body());
            if (result == null || !result.isArray() || result.size() > PAGE)
                throw new BadRequestException("Odoo returned an unexpected employee response.");
            return result;
        } catch (IOException | IllegalArgumentException | java.util.concurrent.CompletionException e) {
            throw new BadRequestException("Could not read Odoo data. Check the URL, API key, and API permissions.");
        }
    }

    private static class BoundedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final java.util.concurrent.CompletableFuture<byte[]> result = new java.util.concurrent.CompletableFuture<>();
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public java.util.concurrent.CompletionStage<byte[]> getBody() { return result; }
        public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
        public void onNext(List<java.nio.ByteBuffer> items) {
            for (var item : items) {
                if (item.remaining() > 1024 * 1024 - buffer.size()) {
                    subscription.cancel();
                    result.completeExceptionally(new IOException("Odoo response too large"));
                    return;
                }
                byte[] bytes = new byte[item.remaining()];
                item.get(bytes);
                buffer.writeBytes(bytes);
            }
            subscription.request(1);
        }
        public void onError(Throwable error) { result.completeExceptionally(error); }
        public void onComplete() { result.complete(buffer.toByteArray()); }
    }

    private static String field(JsonNode row, String name) {
        JsonNode node = row.path(name);
        return node.isTextual() && !node.asText().isBlank() ? node.asText().trim() : null;
    }

    static Long relationId(JsonNode row, String name) {
        JsonNode id = row.path(name).path(0);
        return id.isIntegralNumber() && id.asLong() > 0 ? id.asLong() : null;
    }

    static String relationName(JsonNode row, String name) {
        JsonNode value = row.path(name).path(1);
        return value.isTextual() ? value.asText() : null;
    }
}
