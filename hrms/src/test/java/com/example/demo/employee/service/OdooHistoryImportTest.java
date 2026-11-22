package com.example.demo.employee.service;

import com.example.demo.leave.entity.LeaveRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class OdooHistoryImportTest {
    private final ObjectMapper json = new ObjectMapper();
    private final LocalDate day = LocalDate.of(2026, 10, 1);

    @Test void parsesOdooTimestampAsUtcWithoutLosingTheInstant() throws Exception {
        assertEquals(Instant.parse("2026-10-01T05:00:00Z"), OdooHistoryImportService.timestamp(
                json.readTree("{\"check_in\":\"2026-10-01 05:00:00\"}"), "check_in"));
    }

    @Test void preservesAfternoonHalfDayAndRejectsHourlyLeave() throws Exception {
        var half = json.readTree("""
                {"request_unit_half":true,"request_date_from_period":"pm","request_date_to_period":"pm"}
                """);
        assertEquals(LeaveRequest.LeaveDuration.SECOND_HALF, OdooHistoryImportService.duration(half, day, day, .5));
        assertNull(OdooHistoryImportService.duration(half, day, day.plusDays(1), 1.5));
        assertNull(OdooHistoryImportService.duration(json.readTree("{\"request_unit_hours\":true}"), day, day, .25));
    }
}
