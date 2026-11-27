package com.example.demo.attendance.controller;

import com.example.demo.attendance.dto.AttendanceReportScheduleRequest;
import com.example.demo.attendance.service.AttendanceReportScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance/report-schedules")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'ENTERPRISE_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER')")
public class AttendanceReportScheduleController {
    private final AttendanceReportScheduleService schedules;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam Long companyId) {
        return ResponseEntity.ok(schedules.list(companyId));
    }

    @GetMapping("/employees")
    public ResponseEntity<List<Map<String, Object>>> employees(@RequestParam Long companyId) {
        return ResponseEntity.ok(schedules.employees(companyId));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestParam Long companyId,
                                                       @Valid @RequestBody AttendanceReportScheduleRequest request) {
        return ResponseEntity.ok(schedules.create(companyId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(@RequestParam Long companyId, @PathVariable Long id,
                                                       @Valid @RequestBody AttendanceReportScheduleRequest request) {
        return ResponseEntity.ok(schedules.update(companyId, id, request));
    }

    @PatchMapping("/{id}/enabled")
    public ResponseEntity<Void> setEnabled(@RequestParam Long companyId, @PathVariable Long id,
                                           @RequestBody Map<String, Boolean> body) {
        schedules.setEnabled(companyId, id, Boolean.TRUE.equals(body.get("enabled")));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestParam Long companyId, @PathVariable Long id) {
        schedules.delete(companyId, id);
        return ResponseEntity.noContent().build();
    }
}
