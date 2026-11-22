package com.example.demo.offboarding.service;

import com.example.demo.audit.AuditService;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.offboarding.entity.EmployeeOffboarding;
import com.example.demo.offboarding.repository.EmployeeOffboardingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OffboardingCompletionTest {
    @Mock EmployeeOffboardingRepository cases;
    @Mock EmployeeRepository employees;
    @Mock AuditService audit;
    @InjectMocks OffboardingService service;

    @Test void completionDeactivatesAnEmployeeEvenIfExitDateHadNotArrived() {
        var employee = new Employee();
        var exit = new EmployeeOffboarding();
        exit.setEmployee(employee);
        exit.setExitDate(LocalDate.now().plusDays(2));
        when(cases.findOne(any(Specification.class))).thenReturn(Optional.of(exit));
        when(cases.save(exit)).thenReturn(exit);

        assertSame(exit, service.complete(5L));
        assertEquals(EmployeeOffboarding.OffboardingStatus.COMPLETED, exit.getStatus());
        assertNotNull(exit.getEmployeeDeactivatedAt());
        assertFalse(employee.isActive());
        verify(employees).save(employee);
    }

    @Test void repeatedCompletionPreservesPriorCompletionAndDeactivationDates() {
        var exit = new EmployeeOffboarding();
        var completed = LocalDate.now().minusDays(1);
        var deactivated = LocalDateTime.now().minusDays(1);
        exit.setCompletedDate(completed);
        exit.setEmployeeDeactivatedAt(deactivated);
        when(cases.findOne(any(Specification.class))).thenReturn(Optional.of(exit));
        when(cases.save(exit)).thenReturn(exit);

        service.complete(5L);
        assertEquals(completed, exit.getCompletedDate());
        assertEquals(deactivated, exit.getEmployeeDeactivatedAt());
        verifyNoInteractions(employees);
    }
}
