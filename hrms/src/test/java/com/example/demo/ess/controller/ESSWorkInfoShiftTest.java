package com.example.demo.ess.controller;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.entity.EmployeeWorkInformation;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.employee.repository.EmployeeWorkInformationRepository;
import com.example.demo.payroll.repository.ContractRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ESSWorkInfoShiftTest {
    @Mock EmployeeRepository employees;
    @Mock EmployeeWorkInformationRepository workInformation;
    @Mock ContractRepository contracts;
    @InjectMocks ESSController controller;

    private final Employee employee = new Employee();
    private final EmployeeWorkInformation workInfo = new EmployeeWorkInformation();
    private Authentication auth;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(1L);
        auth = new UsernamePasswordAuthenticationToken(new UserPrincipal(user), null);
        employee.setId(2L);
        when(employees.findByUserId(1L)).thenReturn(Optional.of(employee));
        when(workInformation.findByEmployeeId(2L)).thenReturn(Optional.of(workInfo));
    }

    @Test
    void assignedGeneralShiftOverridesStaleHalfDayWorkInformation() {
        employee.setShift(shift(11L, "General Shift"));
        workInfo.setShift(shift(12L, "Half Day Shift"));

        var response = controller.myWorkInfo(auth).getBody();

        assertThat(response.getShiftId()).isEqualTo(11L);
        assertThat(response.getShiftName()).isEqualTo("General Shift");
        assertThat(workInfo.getShift().getId()).isEqualTo(12L);
    }

    @Test
    void fallsBackToWorkInformationWhenNoDirectShiftIsAssigned() {
        workInfo.setShift(shift(12L, "Half Day Shift"));

        var response = controller.myWorkInfo(auth).getBody();

        assertThat(response.getShiftId()).isEqualTo(12L);
        assertThat(response.getShiftName()).isEqualTo("Half Day Shift");
    }

    private static ShiftSchedule shift(long id, String name) {
        ShiftSchedule shift = new ShiftSchedule();
        shift.setId(id);
        shift.setName(name);
        return shift;
    }
}
