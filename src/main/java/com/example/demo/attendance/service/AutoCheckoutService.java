package com.example.demo.attendance.service;

import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.repository.AutoCheckoutSettings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoCheckoutService {
    private final AutoCheckoutSettings settings;
    private final AttendanceRepository attendances;
    private final AttendanceService attendanceService;

    public void scan(Long headOfficeId, Long companyId, Instant now) {
        if (!settings.enabled(headOfficeId)) return;
        LocalDate today = now.atZone(CheckoutReminderService.ZONE).toLocalDate();
        for (Long id : attendances.findAutoCheckoutCandidates(companyId, today.minusDays(1), today)) {
            try {
                attendanceService.autoClockOut(headOfficeId, companyId, id, now);
            } catch (RuntimeException ex) {
                log.error("Automatic checkout failed for attendance {}", id, ex);
            }
        }
    }
}
