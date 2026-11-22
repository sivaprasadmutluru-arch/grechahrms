package com.example.demo.leave.service;

import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.entity.EmployeeWorkInformation;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.repository.EmployeeWorkInformationRepository;
import com.example.demo.leave.entity.LeaveType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeaveWeeklyOffTest {
    @Mock EmployeeRepository employees;
    @Mock EmployeeWorkInformationRepository workInfo;
    @InjectMocks LeaveService service;
    final LocalDate saturday = LocalDate.of(2026, 11, 14);

    private LeaveType policy() {
        LeaveType type = new LeaveType();
        type.setExcludeWeekend(true);
        type.setExcludeHoliday(false);
        type.setExcludeCompanyLeave(false);
        return type;
    }

    @Test void countsSaturdayButNotSundayOnSundayOnlyShift() {
        Employee employee = new Employee();
        ShiftSchedule shift = new ShiftSchedule();
        shift.setWeeklyOffDays("SUNDAY");
        employee.setShift(shift);
        when(employees.findById(13L)).thenReturn(Optional.of(employee));
        assertEquals(1, service.calculateWorkingDays(saturday, saturday, 10L, policy(), 13L));
        assertEquals(List.of(saturday), service.eligibleLeaveDates(saturday, saturday.plusDays(1), 10L, policy(), 13L));
        verifyNoInteractions(workInfo);
    }

    @Test void fallsBackToWorkInformationShiftWhenNoDirectAssignment() {
        Employee employee = new Employee();
        employee.setId(13L);
        when(employees.findById(13L)).thenReturn(Optional.of(employee));
        EmployeeWorkInformation info = new EmployeeWorkInformation();
        ShiftSchedule shift = new ShiftSchedule();
        shift.setWeeklyOffDays("FRIDAY");
        info.setShift(shift);
        when(workInfo.findByEmployeeId(13L)).thenReturn(Optional.of(info));
        assertEquals(List.of(saturday, saturday.plusDays(1)),
                service.eligibleLeaveDates(saturday.minusDays(1), saturday.plusDays(1), 10L, policy(), 13L));
    }

    @Test void keepsWeekendFallbackWhenThereIsNoShift() {
        assertEquals(0, service.calculateWorkingDays(saturday, saturday.plusDays(1), 10L, policy()));
    }
}
