package com.example.demo.performance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Repository
@Order(5)
@RequiredArgsConstructor
class PerformanceStore implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    record Document(long revision, ObjectNode data) {}

    @Override @Transactional
    public void run(String... args) throws Exception {
        jdbc.execute(new ClassPathResource("db/migration/R__smart_hr_performance.sql")
                .getContentAsString(StandardCharsets.UTF_8));
    }

    Document get(long company, String kind, String key) {
        return jdbc.query("""
                SELECT revision, payload::text FROM public.smart_performance_documents
                WHERE company_id = ? AND kind = ? AND document_key = ?
                """, (rs, i) -> new Document(rs.getLong(1), parse(rs.getString(2))), company, kind, key)
                .stream().findFirst().orElseGet(() -> new Document(0, json.createObjectNode()));
    }

    Map<String, Document> list(long company, String kind) {
        Map<String, Document> result = new LinkedHashMap<>();
        jdbc.query("""
                SELECT document_key, revision, payload::text FROM public.smart_performance_documents
                WHERE company_id = ? AND kind = ? ORDER BY document_key
                """, row -> {
            result.put(row.getString(1), new Document(row.getLong(2), parse(row.getString(3))));
        }, company, kind);
        return result;
    }

    Document save(long company, String kind, String key, long expected, ObjectNode data) {
        int changed = expected == 0 ? jdbc.update("""
                INSERT INTO public.smart_performance_documents (company_id, kind, document_key, revision, payload)
                VALUES (?, ?, ?, 1, CAST(? AS jsonb)) ON CONFLICT DO NOTHING
                """, company, kind, key, data.toString()) : jdbc.update("""
                UPDATE public.smart_performance_documents SET payload = CAST(? AS jsonb), revision = revision + 1
                WHERE company_id = ? AND kind = ? AND document_key = ? AND revision = ?
                """, data.toString(), company, kind, key, expected);
        if (changed != 1) throw conflict();
        return new Document(expected + 1, data);
    }

    void delete(long company, String kind, String key, long expected) {
        int changed = jdbc.update("""
                DELETE FROM public.smart_performance_documents
                WHERE company_id = ? AND kind = ? AND document_key = ? AND revision = ?
                """, company, kind, key, expected);
        if (changed != 1) throw conflict();
    }

    boolean claimReminder(long company, long employee, String key) {
        return jdbc.update("""
                INSERT INTO public.smart_performance_reminders (company_id, employee_id, reminder_key)
                VALUES (?, ?, ?) ON CONFLICT DO NOTHING
                """, company, employee, key) == 1;
    }

    static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Someone updated this record. Reload it before saving.");
    }

    private ObjectNode parse(String data) {
        try {
            return (ObjectNode) json.readTree(data);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not read a performance record", ex);
        }
    }
}
