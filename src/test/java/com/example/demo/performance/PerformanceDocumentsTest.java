package com.example.demo.performance;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PerformanceDocumentsTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void emailDocumentHasProfessionalSectionsAndEscapesRecipientNoteAndJdText() throws Exception {
        var version = mapper.readTree("""
                {"version":2,"at":"2026-11-24T12:00:00Z","fields":{
                  "purpose":"Support <client> teams",
                  "reportingTo":"HR Operations Manager",
                  "responsibleFor":"Employee services",
                  "responsibilities":"1. Coordinate onboarding\\n2. Maintain accurate records"
                }}
                """);

        String html = PerformanceDocuments.jobDescriptionEmail("Grecha & Co", "Asha Rao", "HR Manager",
                "People Operations", version, "Please review <this> JD.");

        assertTrue(html.contains("POSITION DESCRIPTION"));
        assertTrue(html.contains("HR Manager"));
        assertTrue(html.contains("Reporting relationship"));
        assertTrue(html.contains("Roles and responsibilities"));
        assertTrue(html.contains("24 Nov 2026"));
        assertTrue(html.contains("&lt;client&gt;"));
        assertTrue(html.contains("Please review &lt;this&gt; JD."));
        assertTrue(html.contains(">Coordinate onboarding</li>"));
        assertFalse(html.contains("<client>"));
    }

    @Test
    void masterRoleEmailOmitsEmployeeMetadataWhenItDoesNotApply() throws Exception {
        var version = mapper.readTree("""
                {"version":1,"at":"2026-11-24T12:00:00Z","fields":{
                  "purpose":"Support clients", "reportingTo":"HR Director",
                  "responsibleFor":"HR operations", "responsibilities":"Support HR processes"
                }}
                """);

        String html = PerformanceDocuments.jobDescriptionEmail("Grecha & Co", "", "Client HR Manager", "", version, "");

        assertFalse(html.contains("Employee</td>"));
        assertTrue(html.contains("Client HR Manager"));
    }
}
