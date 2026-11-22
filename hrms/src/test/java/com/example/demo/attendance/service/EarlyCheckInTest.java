package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.repository.AttendanceActivityRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.geofencing.service.GeoFencingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EarlyCheckInTest {
    @Mock AttendanceRepository attendance;
    @Mock AttendanceActivityRepository activities;
    @Mock EmployeeRepository employees;
    @Mock CompanyRepository companies;
    @Mock EmployeeAttendancePolicyService policies;
    @Mock GeoFencingService geofence;
    @InjectMocks AttendanceService service;

    @Test void canCheckInBeforeTodaysScheduledStart() {
        var company = new Company(); company.setId(7L);
        var shift = new ShiftSchedule();
        shift.setName("Late shift"); shift.setStartTime(LocalTime.MAX); shift.setEndTime(LocalTime.of(8, 0));
        shift.setMinimumWorkingHour(8);
        var employee = new Employee(); employee.setId(10L); employee.setCompany(company); employee.setShift(shift);
        when(employees.findById(10L)).thenReturn(Optional.of(employee));
        when(companies.findById(7L)).thenReturn(Optional.of(company));
        when(policies.required(eq(employee), any())).thenReturn(true);
        when(attendance.save(any())).thenAnswer(call -> {
            Attendance saved = call.getArgument(0);
            saved.setId(12L);
            return saved;
        });

        var result = assertDoesNotThrow(() -> service.clockIn(10L, 7L, null, null, null, "manual"));
        assertNotNull(result.getCheckIn());
        assertTrue(result.getCheckIn().isBefore(shift.getStartTime()));
        assertEquals(12L, result.getId());
        verify(activities).save(any());
        verify(geofence).evaluateLocation(7L, null, null);
    }

    @Test void earlyArrivalDoesNotMakeACompleteDayIrregular() {
        var shift = new ShiftSchedule();
        shift.setStartTime(LocalTime.of(9, 0)); shift.setEndTime(LocalTime.of(18, 0));
        var record = new Attendance();
        record.setEmployee(new Employee()); record.setAttendanceDate(LocalDate.of(2026, 11, 18));
        record.setShift(shift); record.setCheckIn(LocalTime.of(8, 0)); record.setCheckOut(LocalTime.of(18, 0));
        record.setWorkedHour(10.0); record.setMinimumHour(8.0);
        when(policies.required(record.getEmployee(), record.getAttendanceDate())).thenReturn(true);
        service.evaluateAttendanceStatus(record, 0);
        assertEquals(Attendance.AttendanceQualityStatus.REGULAR, record.getAttendanceStatus());
        assertEquals(0, record.getDeductionMinutes());
    }
}
