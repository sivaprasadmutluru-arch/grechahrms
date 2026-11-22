package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.repository.CheckoutReminderRepository;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service @RequiredArgsConstructor
public class CheckoutReminderService {
    static final ZoneId ZONE = ZoneId.of("Asia/Dubai"); // Same zone as attendance and shift evaluation.
    private static final String ENTITY = "CHECKOUT_REMINDER";
    private final AttendanceRepository attendances;
    private final AttendanceService attendanceService;
    private final EmployeeAttendancePolicyService policies;
    private final CheckoutReminderRepository deliveries;
    private final NotificationService notifications;

    @Transactional
    public void remind(Long companyId, Instant instant) {
        var now = instant.atZone(ZONE).toLocalDateTime();
        for (LocalDate date : List.of(now.toLocalDate().minusDays(1), now.toLocalDate())) {
            for (var row : attendances.findByCompanyIdAndAttendanceDateAndCheckInIsNotNullAndCheckOutIsNull(companyId, date)) {
                var employee = row.getEmployee();
                if (!row.isActive() || row.getCompany() == null || !companyId.equals(row.getCompany().getId())
                        || employee == null || !employee.isActive() || employee.getCompany() == null
                        || !companyId.equals(employee.getCompany().getId()) || employee.getUser() == null
                        || !employee.getUser().isActive() || !policies.required(employee, date)) continue;
                var shift = attendanceService.shiftForAttendance(row);
                var end = scheduledEnd(date, shift);
                // Poll every minute, with a bounded recovery window after short outages.
                if (!due(row, shift, now) || deliveries.claim(row.getId()) == 0) continue;
                notifications.send(employee.getUser().getId(), "Time to check out",
                        "Your shift ended at " + end.format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH))
                                + " (Asia/Dubai). You are still checked in. Please check out if you have finished work.",
                        Notification.NotificationType.GENERAL, ENTITY, row.getId(), row.getCompany());
            }
        }
    }

    static LocalDateTime scheduledEnd(LocalDate date, ShiftSchedule shift) {
        if (date == null || shift == null || shift.getStartTime() == null || shift.getEndTime() == null
                || shift.getStartTime().equals(shift.getEndTime())) return null;
        if (shift.getWeeklyOffDays() != null && Arrays.stream(shift.getWeeklyOffDays().split(","))
                .anyMatch(day -> date.getDayOfWeek().name().equalsIgnoreCase(day.trim()))) return null;
        return date.plusDays(shift.getEndTime().isBefore(shift.getStartTime()) ? 1 : 0).atTime(shift.getEndTime());
    }

    static boolean due(Attendance row, ShiftSchedule shift, LocalDateTime now) {
        var end = scheduledEnd(row.getAttendanceDate(), shift);
        return row.getCheckIn() != null && row.getCheckOut() == null && row.getCheckOutUtc() == null
                && end != null && !now.isBefore(end) && now.isBefore(end.plusMinutes(15));
    }

    public record Alert(Long id, String title, String message) {}

    @Transactional(readOnly = true)
    public List<Alert> alerts(Long userId) {
        // Never show a stale popup after checkout, even when its bell notification is unread.
        return deliveries.findAlerts(userId, PageRequest.of(0, 20)).stream()
                .filter(n -> n.getRelatedId() != null && n.getCompany() != null)
                .filter(n -> attendances.findById(n.getRelatedId()).filter(row ->
                        row.isActive() && row.getCheckIn() != null && row.getCheckOut() == null && row.getCheckOutUtc() == null
                        && row.getEmployee() != null && row.getEmployee().isActive() && row.getEmployee().getUser() != null
                        && userId.equals(row.getEmployee().getUser().getId()) && row.getCompany() != null
                        && n.getCompany().getId().equals(row.getCompany().getId())
                        && row.getAttendanceDate() != null && !row.getAttendanceDate().isBefore(LocalDate.now(ZONE).minusDays(1)))
                        .isPresent())
                .map(n -> new Alert(n.getId(), n.getTitle(), n.getMessage())).toList();
    }
}
