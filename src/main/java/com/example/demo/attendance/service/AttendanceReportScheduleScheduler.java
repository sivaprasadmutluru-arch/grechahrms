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
import java.time.ZoneId;
import java.util.ArrayList;

@Component
@RequiredArgsConstructor
@Slf4j
public class AttendanceReportScheduleScheduler {
    private final CompanyRepository companies;
    private final AttendanceReportScheduleService schedules;
    private volatile boolean ready;

    @EventListener(ApplicationReadyEvent.class)
    public void ready() { ready = true; }

    @Scheduled(initialDelayString = "${attendance.report-schedule.scan-ms:60000}",
            fixedDelayString = "${attendance.report-schedule.scan-ms:60000}")
    public synchronized void process() {
        if (!ready) return;
        String previous = TenantContext.getTenant();
        Instant now = Instant.now();
        try {
            for (Company headOffice : companies.findAllHeadOfficesActivePublic()) {
                if (!headOffice.isSchemaReady() || headOffice.getSchemaName() == null || headOffice.getStatus() != Company.CompanyStatus.ACTIVE) continue;
                try {
                    TenantContext.setTenant(headOffice.getSchemaName());
                    ArrayList<Long> companyIds = new ArrayList<>();
                    companyIds.add(headOffice.getId());
                    for (Company branch : companies.findByParentCompanyIdAndIsActiveTruePublic(headOffice.getId())) {
                        if (branch.getStatus() == Company.CompanyStatus.ACTIVE) companyIds.add(branch.getId());
                    }
                    for (long[] row : schedules.enabledScheduleIds(companyIds)) {
                        try {
                            schedules.deliver(row[0], row[1], now.atZone(ZoneId.of("UTC")));
                        } catch (Exception ex) {
                            log.error("Scheduled attendance report failed schedule={} company={}", row[0], row[1], ex);
                        }
                    }
                } catch (Exception ex) {
                    log.error("Attendance report schedule scan failed tenant={}", headOffice.getSchemaName(), ex);
                } finally {
                    TenantContext.setTenant(previous);
                }
            }
        } finally {
            TenantContext.setTenant(previous);
        }
    }
}
