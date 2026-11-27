package com.example.demo.attendance.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CheckoutReminderSchedulerTest {
    @Test void scansReadyTenantsAndBranchesAndAlwaysRestoresTenant() {
        var companies = mock(CompanyRepository.class);
        var reminders = mock(CheckoutReminderService.class);
        var auto = mock(AutoCheckoutService.class);
        var scheduler = new CheckoutReminderScheduler(companies, reminders, auto);
        var company = new Company(); company.setId(65L); company.setSchemaName("pioneer");
        var branch = new Company(); branch.setId(66L);
        var other = new Company(); other.setId(70L); other.setSchemaName("other");
        var pending = new Company(); pending.setId(80L); pending.setSchemaName("pending"); pending.setSchemaReady(false);
        when(companies.findAllHeadOfficesActivePublic()).thenReturn(List.of(company,other,pending));
        when(companies.findByParentCompanyIdAndIsActiveTruePublic(65L)).thenReturn(List.of(branch));
        doAnswer(call -> { assertEquals("pioneer",TenantContext.getTenant()); return null; }).when(reminders).remind(eq(65L),any());
        doThrow(new IllegalStateException("test tenant failure")).when(reminders).remind(eq(70L),any());
        TenantContext.setTenant("original");
        try {
            scheduler.process(); verifyNoInteractions(reminders, auto);
            scheduler.ready(); scheduler.process();
            verify(reminders).remind(eq(65L),any()); verify(reminders).remind(eq(66L),any());
            verify(reminders).remind(eq(70L),any()); verify(reminders,never()).remind(eq(80L),any());
            verify(auto).scan(eq(65L), eq(66L), any());
            verify(auto).scan(eq(70L), eq(70L), any());
            assertEquals("original",TenantContext.getTenant());
        } finally { TenantContext.clear(); }
    }
}
