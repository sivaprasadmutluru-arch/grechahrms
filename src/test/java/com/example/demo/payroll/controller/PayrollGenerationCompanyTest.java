package com.example.demo.payroll.controller;

import com.example.demo.auth.entity.UserRole;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.payroll.service.PayrollService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayrollGenerationCompanyTest {
    @Mock PayrollService payrollService;
    @InjectMocks PayrollController controller;
    final LocalDate start = LocalDate.of(2026, 10, 1);
    final LocalDate end = LocalDate.of(2026, 10, 31);

    @AfterEach void clear() { AccessScopeContext.clear(); }

    @Test void generatesOnlyForSelectedBranchNotEveryAccessibleCompany() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L, 66L), null, 66L));
        when(payrollService.generateBulkPayslips(66L, start, end, false, true, true, 0.5)).thenReturn(List.of());
        controller.generateBulkPayslips(66L, start, end, true, true, 0.5);
        verify(payrollService).generateBulkPayslips(66L, start, end, false, true, true, 0.5);
        verifyNoMoreInteractions(payrollService);
    }

    @Test void mismatchedOrUnauthorizedCompanyCannotGenerateAnything() {
        AccessScopeContext.set(new AccessScopeContext.ScopeData(168L, 64L, UserRole.AccessScope.ENTERPRISE, List.of(64L, 66L), null, 66L));
        assertThatThrownBy(() -> controller.generateBulkPayslips(64L, start, end, true, true, 0.5)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.generateBulkPayslips(65L, start, end, true, true, 0.5)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payrollService);
    }
}
