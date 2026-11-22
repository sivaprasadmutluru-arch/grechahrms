package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.*;
import com.example.demo.auth.entity.User;
import com.example.demo.base.entity.*;
import com.example.demo.employee.entity.Employee;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CheckoutReminderServiceTest {
    final LocalDate day = LocalDate.of(2026,11,18);
    ShiftSchedule shift(String start, String end) {
        var shift = new ShiftSchedule(); shift.setStartTime(LocalTime.parse(start)); shift.setEndTime(LocalTime.parse(end)); return shift;
    }
    Attendance row() {
        var row = new Attendance(); row.setId(10L); row.setAttendanceDate(day); row.setCheckIn(LocalTime.of(9,0)); return row;
    }
    @Test void onlyRemindsAtShiftEndAndWithinRecoveryWindow() {
        var row = row(); var shift = shift("09:00","18:00");
        assertFalse(CheckoutReminderService.due(row,shift,day.atTime(17,59)));
        assertTrue(CheckoutReminderService.due(row,shift,day.atTime(18,0)));
        assertTrue(CheckoutReminderService.due(row,shift,day.atTime(18,14,59)));
        assertFalse(CheckoutReminderService.due(row,shift,day.atTime(18,15)));
        row.setCheckOut(LocalTime.of(18,0));
        assertFalse(CheckoutReminderService.due(row,shift,day.atTime(18,1)));
    }
    @Test void supportsOvernightAndCustomHalfDayAndSkipsWeekOff() {
        assertEquals(day.plusDays(1).atTime(8,0),CheckoutReminderService.scheduledEnd(day,shift("23:00","08:00")));
        assertEquals(day.atTime(13,0),CheckoutReminderService.scheduledEnd(day,shift("09:00","13:00")));
        var off = shift("09:00","18:00"); off.setWeeklyOffDays("WEDNESDAY, SUNDAY");
        assertNull(CheckoutReminderService.scheduledEnd(day,off));
        assertNull(CheckoutReminderService.scheduledEnd(day,shift("09:00","09:00")));
        assertNull(CheckoutReminderService.scheduledEnd(day,null));
    }
    @Test void noReminderWithoutCheckInOrWhenUtcCheckoutPresent() {
        var row = row(); row.setCheckIn(null);
        assertFalse(CheckoutReminderService.due(row,shift("09:00","18:00"),day.atTime(18,0)));
        row.setCheckIn(LocalTime.NOON); row.setCheckOutUtc(Instant.now());
        assertFalse(CheckoutReminderService.due(row,shift("09:00","18:00"),day.atTime(18,0)));
    }
    @Test void sendsOnceToEmployeeNotManagerAndSkipsExemptOrInactive() {
        var repository = mock(AttendanceRepository.class); var attendanceService = mock(AttendanceService.class);
        var policies = mock(EmployeeAttendancePolicyService.class); var deliveries = mock(CheckoutReminderRepository.class);
        var notifications = mock(NotificationService.class);
        var service = new CheckoutReminderService(repository,attendanceService,policies,deliveries,notifications);
        var company = new Company(); company.setId(65L);
        var user = new User(); user.setId(210L);
        var employee = new Employee(); employee.setId(108L); employee.setUser(user); employee.setCompany(company);
        var row = row(); row.setEmployee(employee); row.setCompany(company); row.setShift(shift("09:00","18:00"));
        when(attendanceService.shiftForAttendance(row)).thenReturn(row.getShift());
        when(repository.findByCompanyIdAndAttendanceDateAndCheckInIsNotNullAndCheckOutIsNull(65L,day)).thenReturn(List.of(row));
        when(policies.required(employee,day)).thenReturn(true);
        when(deliveries.claim(10L)).thenReturn(1,0);
        var instant = day.atTime(18,0).atZone(CheckoutReminderService.ZONE).toInstant();
        service.remind(65L,instant); service.remind(65L,instant);
        verify(notifications,times(1)).send(eq(210L),eq("Time to check out"),contains("6:00 PM"),eq(Notification.NotificationType.GENERAL),eq("CHECKOUT_REMINDER"),eq(10L),same(company));
        when(policies.required(employee,day)).thenReturn(false); service.remind(65L,instant);
        employee.setActive(false); service.remind(65L,instant);
        verify(deliveries,times(2)).claim(10L);
    }

    @Test void popupSuppressesCompletedAndOtherEmployeesAttendance() {
        var repository = mock(AttendanceRepository.class);
        var deliveries = mock(CheckoutReminderRepository.class);
        var service = new CheckoutReminderService(repository,mock(AttendanceService.class),mock(EmployeeAttendancePolicyService.class),
                deliveries,mock(NotificationService.class));
        var company = new Company(); company.setId(65L);
        var user = new User(); user.setId(210L);
        var employee = new Employee(); employee.setUser(user);
        var row = row(); row.setEmployee(employee); row.setCompany(company); row.setAttendanceDate(LocalDate.now(CheckoutReminderService.ZONE));
        var notification = new Notification(); notification.setId(100L); notification.setCompany(company); notification.setRelatedId(10L);
        when(deliveries.findAlerts(eq(210L),any()))
                .thenReturn(List.of(notification));
        when(repository.findById(10L)).thenReturn(Optional.of(row));
        assertEquals(1,service.alerts(210L).size());
        row.setCheckOut(LocalTime.of(18,0)); assertTrue(service.alerts(210L).isEmpty());
        row.setCheckOut(null); user.setId(999L); assertTrue(service.alerts(210L).isEmpty());
        user.setId(210L); company.setId(66L);
        var unrelated = new Company(); unrelated.setId(65L); notification.setCompany(unrelated);
        assertTrue(service.alerts(210L).isEmpty());
    }
}
