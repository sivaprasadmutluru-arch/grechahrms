package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.entity.AttendanceValidationCondition;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static java.time.temporal.ChronoUnit.SECONDS;

public final class OvertimeReview {
    private OvertimeReview() {}

    public static boolean applies(Attendance attendance, AttendanceValidationCondition policy) {
        return policy != null && policy.getOvertimeReviewFrom() != null && attendance.getAttendanceDate() != null
                && !attendance.getAttendanceDate().isBefore(policy.getOvertimeReviewFrom());
    }

    public static boolean lateCheckIn(Attendance attendance) {
        var shift = attendance.getShift();
        return shift != null && shift.getStartTime() != null && attendance.getCheckIn() != null
                && attendance.getCheckIn().isAfter(shift.getStartTime());
    }

    public static int lateCheckoutSeconds(Attendance attendance) {
        var shift = attendance.getShift();
        LocalDate date = attendance.getAttendanceDate();
        if (date == null || shift == null || shift.getEndTime() == null || attendance.getCheckOut() == null) return 0;
        boolean overnight = shift.getStartTime() != null && shift.getEndTime().isBefore(shift.getStartTime());
        LocalDate endDate = overnight ? date.plusDays(1) : date;
        LocalDate outDate = attendance.getCheckOutDate();
        if (outDate == null) outDate = overnight && attendance.getCheckOut().isBefore(shift.getStartTime()) ? endDate : date;
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0, SECONDS.between(
                LocalDateTime.of(endDate, shift.getEndTime()), LocalDateTime.of(outDate, attendance.getCheckOut()))));
    }

    public static boolean missingCheckout(Attendance attendance, LocalDate today) {
        var date = attendance.getAttendanceDate();
        if (date == null || attendance.getCheckIn() == null || attendance.getCheckOut() != null) return false;
        var shift = attendance.getShift();
        if (shift != null && shift.getStartTime() != null && shift.getEndTime() != null
                && shift.getEndTime().isBefore(shift.getStartTime())) date = date.plusDays(1);
        return date.isBefore(today);
    }
}
