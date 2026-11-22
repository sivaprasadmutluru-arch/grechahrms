package com.example.demo.attendance.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component @RequiredArgsConstructor @Slf4j
public class CheckoutReminderScheduler {
    private final CompanyRepository companies;
    private final CheckoutReminderService reminders;
    private volatile boolean ready;
    @EventListener(ApplicationReadyEvent.class) public void ready() { ready = true; }

    @Scheduled(initialDelayString = "${attendance.checkout-reminder.scan-ms:60000}",
            fixedDelayString = "${attendance.checkout-reminder.scan-ms:60000}")
    public synchronized void process() {
        if (!ready) return;
        var previous = TenantContext.getTenant();
        var now = Instant.now();
        try {
            for (var tenant : companies.findAllHeadOfficesActivePublic()) {
                if (!tenant.isSchemaReady() || tenant.getSchemaName() == null || tenant.getStatus() != Company.CompanyStatus.ACTIVE) continue;
                try {
                    TenantContext.setTenant(tenant.getSchemaName());
                    reminders.remind(tenant.getId(), now);
                    for (var branch : companies.findByParentCompanyIdAndIsActiveTruePublic(tenant.getId())) {
                        if (branch.getStatus() == Company.CompanyStatus.ACTIVE) reminders.remind(branch.getId(), now);
                    }
                } catch (Exception ex) {
                    log.error("Checkout reminder scan failed tenant={}", tenant.getSchemaName(), ex);
                } finally { TenantContext.setTenant(previous); }
            }
        } finally { TenantContext.setTenant(previous); }
    }
}
