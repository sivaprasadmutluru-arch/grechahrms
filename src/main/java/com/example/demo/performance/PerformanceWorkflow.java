package com.example.demo.performance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

final class PerformanceWorkflow {
    static final ZoneId ZONE = ZoneId.of("Asia/Dubai");
    static final List<String> JD_FIELDS = List.of("purpose", "reportingTo", "responsibleFor", "responsibilities",
            "qualifications", "experience", "skills", "workConditions", "successMeasures");
    static final List<String> REQUIRED_JD_FIELDS = List.of("purpose", "reportingTo", "responsibleFor", "responsibilities");
    private static final Set<String> PROGRESS = Set.of("ON_TRACK", "AT_RISK", "OFF_TRACK");
    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private PerformanceWorkflow() {}

    static ObjectNode object() { return JSON.objectNode(); }

    static ArrayNode array(ObjectNode parent, String key) {
        if (parent.get(key) instanceof ArrayNode array) return array;
        return parent.putArray(key);
    }

    static ObjectNode child(ObjectNode parent, String key) {
        if (parent.get(key) instanceof ObjectNode object) return object;
        return parent.putObject(key);
    }

    static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    static String text(JsonNode node, String key, int limit, boolean required) {
        JsonNode field = node.path(key);
        String value = field.isTextual() ? field.asText().strip() : "";
        if (value.length() > limit) throw invalid(key + " is limited to " + limit + " characters.");
        if (required && value.isBlank()) throw invalid("Complete " + key + ".");
        return value;
    }

    static String uid() { return UUID.randomUUID().toString(); }

    static ObjectNode event(long actor) {
        return object().put("actor", actor).put("at", Instant.now().toString());
    }

    static void acknowledge(ObjectNode published, long actor, String comment) {
        if (!published.has("acknowledgement"))
            published.set("acknowledgement", event(actor).put("comment", comment));
    }

    static ObjectNode cleanJd(JsonNode input, boolean publish) {
        ObjectNode jd = object();
        for (String field : JD_FIELDS) {
            boolean required = publish && REQUIRED_JD_FIELDS.contains(field);
            jd.put(field, text(input, field, 6000, required));
        }
        if (input != null && input.hasNonNull("reportingManagerId") && input.path("reportingManagerId").asLong() > 0) {
            jd.put("reportingManagerId", input.path("reportingManagerId").asLong());
        }
        return jd;
    }

    static void publishJd(ObjectNode track, ObjectNode fields, long actor) {
        ArrayNode history = array(track, "versions");
        ObjectNode version = event(actor).put("version", history.size() + 1);
        version.set("fields", fields.deepCopy());
        history.add(version);
        track.remove("draft");
    }

    static JsonNode latest(JsonNode track) {
        JsonNode history = track.path("versions");
        return history.isEmpty() ? MissingNode.getInstance() : history.get(history.size() - 1);
    }

    static ArrayNode items(JsonNode input, boolean custom, boolean complete, JsonNode existing) {
        JsonNode supplied = input.path("items");
        if (!supplied.isArray() || supplied.size() > 30 || complete && supplied.isEmpty())
            throw invalid("Provide between 1 and 30 KPIs.");
        Set<String> prior = new HashSet<>();
        existing.forEach(item -> prior.add(item.path("id").asText()));
        Set<String> unique = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        ArrayNode result = JSON.arrayNode();
        for (JsonNode row : supplied) {
            String id = row.path("id").asText();
            if (!prior.contains(id)) id = uid();
            if (!unique.add(id)) throw invalid("A KPI cannot be included twice.");
            boolean confirm = row.path("confirmationRequired").asBoolean(false);
            if (complete && confirm) throw invalid("Confirm each suggested measure before submitting.");
            ObjectNode item = object().put("id", id)
                    .put("description", text(row, "description", 280, complete))
                    .put("target", text(row, "target", 3000, complete))
                    .put("confirmationRequired", confirm);
            if (custom) {
                JsonNode number = row.path("weight");
                if (!number.isNumber() || number.decimalValue().signum() <= 0
                        || number.decimalValue().compareTo(BigDecimal.valueOf(100)) > 0)
                    throw invalid("Enter a positive weight of up to 100% for every KPI.");
                total = total.add(number.decimalValue());
                item.put("weight", number.decimalValue());
            }
            result.add(item);
        }
        if (complete && custom && total.compareTo(BigDecimal.valueOf(100)) != 0)
            throw invalid("Custom KPI weights must total 100%.");
        return result;
    }

    static ObjectNode ratings(JsonNode supplied, JsonNode snapshot, boolean complete) {
        if (!supplied.isObject()) throw invalid("Enter ratings for this review.");
        ObjectNode result = object();
        for (JsonNode item : snapshot.path("items")) {
            String id = item.path("id").asText();
            JsonNode row = supplied.path(id);
            JsonNode rating = row.path("rating");
            if (rating.isMissingNode() || rating.isNull()) {
                if (complete) throw invalid("Rate every KPI before submitting the review.");
            } else if (!rating.isIntegralNumber() || rating.intValue() < 1 || rating.intValue() > 3) {
                throw invalid("Ratings must be 1, 2, or 3.");
            }
            ObjectNode clean = object().put("comment", text(row, "comment", 3000, false));
            if (rating.isIntegralNumber()) clean.put("rating", rating.intValue());
            result.set(id, clean);
        }
        return result;
    }

    static BigDecimal score(JsonNode items, JsonNode ratings, boolean custom) {
        BigDecimal numerator = BigDecimal.ZERO;
        BigDecimal denominator = BigDecimal.ZERO;
        for (JsonNode item : items) {
            JsonNode rating = ratings.path(item.path("id").asText()).path("rating");
            if (!rating.isIntegralNumber()) continue;
            BigDecimal weight = custom ? item.path("weight").decimalValue() : BigDecimal.ONE;
            numerator = numerator.add(weight.multiply(rating.decimalValue()));
            denominator = denominator.add(weight);
        }
        return denominator.signum() == 0 ? null : numerator.divide(denominator, MathContext.DECIMAL128);
    }

    static void addProgress(ObjectNode cycle, JsonNode payload, long actor) {
        JsonNode approved = latest(cycle.path("approved"));
        String id = text(payload, "id", 80, true);
        boolean found = false;
        for (JsonNode item : approved.path("items")) if (id.equals(item.path("id").asText())) found = true;
        if (!found) throw invalid("This KPI is no longer active.");
        String status = text(payload, "status", 30, true);
        if (!PROGRESS.contains(status)) throw invalid("Select On Track, At Risk, or Off Track.");
        ObjectNode entry = event(actor).put("id", id).put("status", status)
                .put("version", approved.path("version").asInt()).put("comment", text(payload, "comment", 3000, false))
                .put("date", LocalDate.now(ZONE).toString());
        array(cycle, "progress").add(entry);
    }
}
