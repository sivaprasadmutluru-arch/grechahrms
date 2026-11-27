package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.entity.AttendanceActivity;
import com.example.demo.attendance.repository.AttendanceActivityRepository;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.repository.AutoCheckoutSettings;
import com.example.demo.attendance.repository.GraceTimeRepository;
import com.example.demo.attendance.repository.WorkRecordRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.employee.entity.Employee;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutoCheckoutServiceTest {
    @Mock AutoCheckoutSettings settings;
    @Mock AttendanceRepository attendances;
    @Mock AttendanceActivityRepository activities;
    @Mock EmployeeAttendancePolicyService policies;
    @Mock WorkRecordRepository workRecords;
    @Mock GraceTimeRepository graceTimes;
    @InjectMocks AttendanceService service;

    private final LocalDate day = LocalDate.of(2026, 11, 24);
    private final Instant end = day.plusDays(1).atTime(6, 0).atZone(CheckoutReminderService.ZONE).toInstant();

    @Test
    void skipsDisabledOrganizationsAndStopsScanningBeforeQueryingRows() {
        var scanner = new AutoCheckoutService(settings, attendances, service);
        scanner.scan(65L, 66L, end);
        service.autoClockOut(65L, 66L, 10L, end);
        verifyNoInteractions(attendances, activities, workRecords);
    }

    @Test
    void waitsThirtyMinutesAndNeverBackfillsBeforeTheSwitchWasEnabled() {
        var shiftEnd = end.atZone(CheckoutReminderService.ZONE);
        assertFalse(AttendanceService.automaticCheckoutDue(shiftEnd, end.minusSeconds(60), end.plusSeconds(1799)));
        assertTrue(AttendanceService.automaticCheckoutDue(shiftEnd, end.minusSeconds(60), end.plusSeconds(1800)));
        assertFalse(AttendanceService.automaticCheckoutDue(shiftEnd, end.plusSeconds(1), end.plusSeconds(1800)));
        assertFalse(AttendanceService.automaticCheckoutDue(shiftEnd, end.minusSeconds(60), end.plusSeconds(86400)));
    }

    @Test
    void closesAnOvernightSecondSessionAtShiftEndWithoutPayingOvertimeOrCountingBreaks() {
        var company = new Company();
        company.setId(66L);
        var employee = new Employee();
        employee.setId(12L);
        employee.setCompany(company);
        var shift = new ShiftSchedule();
        shift.setStartTime(LocalTime.of(22, 0));
        shift.setEndTime(LocalTime.of(6, 0));
        shift.setMinimumWorkingHour(6);

        var row = new Attendance();
        row.setId(10L);
        row.setCompany(company);
        row.setEmployee(employee);
        row.setAttendanceDate(day);
        row.setShift(shift);
        row.setCheckInDate(day);
        row.setCheckIn(shift.getStartTime());
        row.setCheckOutDate(day.plusDays(1));
        row.setCheckOut(LocalTime.MIDNIGHT);
        row.setCheckOutUtc(end.minusSeconds(6 * 3600));

        var first = session(day.atTime(22, 0));
        first.setClockOut(LocalTime.MIDNIGHT);
        first.setClockOutDate(day.plusDays(1));
        first.setOutDatetime(day.plusDays(1).atStartOfDay());
        var open = session(day.plusDays(1).atTime(1, 0));

        when(settings.lockEnabledSince(65L)).thenReturn(end.minusSeconds(36000));
        when(attendances.findByIdForUpdate(10L)).thenReturn(Optional.of(row));
        when(attendances.findById(10L)).thenReturn(Optional.of(row));
        when(policies.required(employee, day)).thenReturn(true);
        when(activities.findByEmployeeIdAndAttendanceDate(12L, day)).thenReturn(List.of(first, open));

        service.autoClockOut(65L, 66L, 10L, end.plusSeconds(1800));
        service.autoClockOut(65L, 66L, 10L, end.plusSeconds(1860));

        assertEquals(day.plusDays(1), row.getCheckOutDate());
        assertEquals(end, row.getCheckOutUtc());
        assertEquals(Attendance.AUTO_CHECKOUT_SOURCE, row.getClockOutSource());
        assertEquals(7 * 3600, row.getAtWorkSecond());
        assertEquals(0, row.getOvertimeSecond());
        assertTrue(row.getCheckoutNeedsReview());
        assertEquals(AttendanceActivity.ClockType.AUTO, open.getClockType());
        verify(activities, times(1)).save(open);
        assertSame(open, AttendanceService.automaticActivityForReplacement(row, List.of(first, open),
                day.plusDays(1).atTime(5, 45)).orElseThrow());
    }

    private AttendanceActivity session(LocalDateTime start) {
        var activity = new AttendanceActivity();
        activity.setAttendanceDate(day);
        activity.setClockInDate(start.toLocalDate());
        activity.setClockIn(start.toLocalTime());
        activity.setInDatetime(start);
        return activity;
    }
}
