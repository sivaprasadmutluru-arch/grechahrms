package com.example.demo.leave.service;

import com.example.demo.leave.entity.LeaveType;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
class ExplicitMonthlyAccrualTest {
    @InjectMocks LeaveAccrualService service;

    @Test void exactMonthlyCreditOverridesAnnualDivisionWithoutChangingAnnualAllowance() {
        LeaveType type = new LeaveType();
        type.setTotalDays(22);
        LocalDate month = LocalDate.of(2026, 11, 1);
        assertEquals(1.8, service.monthlyCredit(type, month, 1));
        assertEquals(1.83, service.monthlyCredit(type, month, 2));
        type.setMonthlyAccrualDays(new BigDecimal("1.84"));
        assertEquals(1.84, service.monthlyCredit(type, month, 2));
        assertEquals(22, type.getTotalDays());
    }
}
