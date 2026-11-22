package com.example.demo.ess.controller;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.AttendanceActivityRepository;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.service.AttendanceService;
import com.example.demo.auth.entity.User;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ESSClockShiftTest {
    @Mock EmployeeRepository employees;
    @Mock AttendanceActivityRepository activities;
    @Mock AttendanceRepository attendances;
    @Mock AttendanceService attendance;
    @InjectMocks ESSController controller;
    private Employee employee;
    private Authentication auth;
    private LocalDate today;

    @BeforeEach void setup() {
        var user = new User();
        user.setId(1L);
        employee = new Employee();
        employee.setId(2L);
        today = LocalDate.now(ZoneId.of("Asia/Dubai"));
        auth = new UsernamePasswordAuthenticationToken(new UserPrincipal(user), null);
        when(employees.findByUserId(1L)).thenReturn(Optional.of(employee));
    }

    private ShiftSchedule shift(String start, String end) {
        var shift = new ShiftSchedule();
        shift.setName("Today's schedule");
        shift.setStartTime(LocalTime.parse(start));
        shift.setEndTime(LocalTime.parse(end));
        return shift;
    }

    @Test void showsResolvedDayTimesBeforeCheckingIn() {
        when(attendance.shiftForDate(employee, today)).thenReturn(shift("09:00", "13:00"));
        Map<String, Object> result = controller.clockStatus(auth).getBody();
        assertNotNull(result);
        assertEquals(LocalTime.of(9, 0), result.get("shiftStartTime"));
        assertEquals(LocalTime.of(13, 0), result.get("shiftEndTime"));
        assertEquals(false, result.get("shiftEndsNextDay"));
        assertEquals(today.atTime(9, 0).atZone(ZoneId.of("Asia/Dubai")).toInstant(), result.get("shiftStartsAt"));
    }

    @Test void showsNextDayIndicatorForNightShift() {
        when(attendance.shiftForDate(employee, today)).thenReturn(shift("23:00", "08:00"));
        assertEquals(true, controller.clockStatus(auth).getBody().get("shiftEndsNextDay"));
    }

    @Test void keepsTheShiftRecordedOnTheAttendanceAfterCheckIn() {
        var record = new Attendance();
        record.setCheckIn(LocalTime.of(9, 0));
        record.setShift(shift("09:00", "13:00"));
        when(attendances.findByEmployeeIdAndAttendanceDate(2L, today)).thenReturn(Optional.of(record));
        assertEquals(LocalTime.of(13, 0), controller.clockStatus(auth).getBody().get("shiftEndTime"));
        verify(attendance, never()).shiftForDate(any(), any());
    }

    @Test void weeklyScheduleIsLoadedOnlyForTheAuthenticatedEmployee() {
        var expected = new AttendanceService.WeeklyShiftSchedule("General", "Asia/Dubai", java.util.List.of());
        when(attendance.weeklyShiftSchedule(employee, today)).thenReturn(expected);
        assertSame(expected, controller.myShiftSchedule(auth).getBody());
        verify(attendance).weeklyShiftSchedule(employee, today);
    }
}
