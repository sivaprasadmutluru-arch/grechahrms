package com.example.demo.performance;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@RequiredArgsConstructor
@Slf4j
class PerformanceReminderScheduler {
    private final CompanyRepository companies;
    private final PerformanceService performance;

    @Scheduled(cron = "${performance.reminders.cron:0 15 8 * * *}", zone = "Asia/Dubai")
    void run() {
        String previous = TenantContext.getTenant();
        try {
            for (Company head : companies.findAllHeadOfficesActivePublic()) {
                if (!head.isSchemaReady() || head.getSchemaName() == null || head.getStatus() != Company.CompanyStatus.ACTIVE) continue;
                try {
                    TenantContext.setTenant(head.getSchemaName());
                    remind(head);
                    companies.findByParentCompanyIdAndIsActiveTruePublic(head.getId()).forEach(this::remind);
                } catch (RuntimeException ex) {
                    log.warn("Performance reminders failed for organization {}", head.getId(), ex);
                } finally {
                    TenantContext.setTenant(previous);
                }
            }
        } finally {
            TenantContext.setTenant(previous);
        }
    }

    private void remind(Company company) {
        if (company.getStatus() == Company.CompanyStatus.ACTIVE)
            performance.reminders(company.getId(), LocalDate.now(PerformanceWorkflow.ZONE));
    }
}
