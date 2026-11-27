package com.example.demo.performance;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static com.example.demo.performance.PerformanceWorkflow.*;
import static org.junit.jupiter.api.Assertions.*;

class PerformanceWorkflowTest {
    @Test
    void calculatesEqualAndCustomScoresUsingOnlyRatedItems() {
        var items = object().putArray("items");
        var ratings = object();
        int[] values = {2, 2, 3, 2};
        for (int i = 0; i < values.length; i++) {
            items.add(object().put("id", "measure-" + i).put("weight", i == 2 ? 40 : 20));
            ratings.putObject("measure-" + i).put("rating", values[i]);
        }
        assertEquals(new BigDecimal("2.25"), score(items, ratings, false));
        assertEquals(new BigDecimal("2.4"), score(items, ratings, true));
        ratings.remove("measure-3");
        assertEquals(new BigDecimal("2.5"), score(items, ratings, true));
        assertNull(score(items, object(), false));
    }

    @Test
    void validatesTargetsWeightsAndAcknowledgementAgainstEachPublishedVersion() {
        var draft = object();
        var entries = draft.putArray("items");
        entries.add(object().put("description", "Invoices").put("target", "Approved invoices issued by monthly deadline")
                .put("weight", 60).put("confirmationRequired", true));
        entries.add(object().put("description", "Reconciliation").put("target", "Monthly sign-off recorded").put("weight", 35));
        assertThrows(ResponseStatusException.class, () -> items(draft, true, true, object()));
        ((com.fasterxml.jackson.databind.node.ObjectNode) entries.get(0)).put("confirmationRequired", false);
        assertThrows(ResponseStatusException.class, () -> items(draft, true, true, object()));
        ((com.fasterxml.jackson.databind.node.ObjectNode) entries.get(1)).put("weight", 40);
        assertEquals(2, items(draft, true, true, object()).size());

        var track = object();
        publishJd(track, object().put("purpose", "Original"), 1L);
        acknowledge((com.fasterxml.jackson.databind.node.ObjectNode) latest(track), 2L, "");
        publishJd(track, object().put("purpose", "Revised"), 1L);
        assertTrue(track.path("versions").get(0).has("acknowledgement"));
        assertFalse(latest(track).has("acknowledgement"));
    }
}
