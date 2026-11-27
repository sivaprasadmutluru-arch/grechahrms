package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceReportScheduleRequest;
import com.example.demo.attendance.dto.AttendanceReportScheduleRequest.Frequency;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.base.service.EmailService;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceReportScheduleService {
    private final JdbcTemplate jdbc;
    private final CompanyRepository companies;
    private final EmployeeRepository employees;
    private final AttendanceService attendance;
    private final EmailService email;

    public List<Map<String, Object>> list(Long companyId) {
        requireSelectedCompany(companyId);
        return jdbc.query("SELECT * FROM public.attendance_report_schedules WHERE company_id=? ORDER BY created_at DESC, id DESC",
                (rs, n) -> scheduleMap(rs.getLong("id"), rs.getString("name"), rs.getString("frequency"),
                        rs.getObject("day_of_week", Integer.class), rs.getObject("day_of_month", Integer.class),
                        rs.getObject("send_at", LocalTime.class), rs.getString("time_zone"),
                        rs.getString("recipient_employee_ids"), rs.getBoolean("enabled"),
                        rs.getObject("last_run_date", LocalDate.class), rs.getString("last_run_status"),
                        rs.getString("last_run_message"), companyId), companyId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> employees(Long companyId) {
        requireSelectedCompany(companyId);
        return employees.findByCompanyIdAndIsActiveTrue(companyId).stream()
                .sorted(Comparator.comparing(Employee::getFirstName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(e -> Optional.ofNullable(e.getLastName()).orElse(""), String.CASE_INSENSITIVE_ORDER))
                .map(employee -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", employee.getId());
                    row.put("name", (employee.getFirstName() + " " + Optional.ofNullable(employee.getLastName()).orElse("")).trim());
                    row.put("employeeCode", employee.getBadgeId());
                    row.put("department", employee.getDepartment() == null ? null : employee.getDepartment().getName());
                    row.put("email", recipientEmail(employee));
                    row.put("eligible", recipientEmail(employee) != null);
                    return row;
                }).toList();
    }

    public List<long[]> enabledScheduleIds(List<Long> companyIds) {
        if (companyIds == null || companyIds.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(companyIds.size(), "?"));
        return jdbc.query("SELECT id, company_id FROM public.attendance_report_schedules WHERE enabled=true AND company_id IN ("
                        + placeholders + ")", (rs, n) -> new long[]{rs.getLong(1), rs.getLong(2)}, companyIds.toArray());
    }

    @Transactional
    public Map<String, Object> create(Long companyId, AttendanceReportScheduleRequest request) {
        validateRequest(companyId, request);
        String ids = normalizeIds(request.recipientEmployeeIds());
        Long id = jdbc.queryForObject("""
                INSERT INTO public.attendance_report_schedules
                  (company_id, name, frequency, day_of_week, day_of_month, send_at, time_zone,
                   recipient_employee_ids, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now()) RETURNING id
                """, Long.class, companyId, request.name().trim(), request.frequency().name(),
                request.frequency() == Frequency.WEEKLY ? request.dayOfWeek() : null,
                request.frequency() == Frequency.MONTHLY ? request.dayOfMonth() : null,
                request.sendAt(), request.timeZone(), ids, !Boolean.FALSE.equals(request.enabled()));
        return getById(companyId, id);
    }

    @Transactional
    public Map<String, Object> update(Long companyId, Long id, AttendanceReportScheduleRequest request) {
        validateRequest(companyId, request);
        int changed = jdbc.update("""
                UPDATE public.attendance_report_schedules SET name=?, frequency=?, day_of_week=?, day_of_month=?,
                  send_at=?, time_zone=?, recipient_employee_ids=?, enabled=?, updated_at=now()
                WHERE id=? AND company_id=?
                """, request.name().trim(), request.frequency().name(),
                request.frequency() == Frequency.WEEKLY ? request.dayOfWeek() : null,
                request.frequency() == Frequency.MONTHLY ? request.dayOfMonth() : null,
                request.sendAt(), request.timeZone(), normalizeIds(request.recipientEmployeeIds()),
                !Boolean.FALSE.equals(request.enabled()), id, companyId);
        if (changed == 0) throw new ResourceNotFoundException("AttendanceReportSchedule", id);
        return getById(companyId, id);
    }

    @Transactional
    public void setEnabled(Long companyId, Long id, boolean enabled) {
        requireSelectedCompany(companyId);
        if (jdbc.update("UPDATE public.attendance_report_schedules SET enabled=?, updated_at=now() WHERE id=? AND company_id=?",
                enabled, id, companyId) == 0) throw new ResourceNotFoundException("AttendanceReportSchedule", id);
    }

    @Transactional
    public void delete(Long companyId, Long id) {
        requireSelectedCompany(companyId);
        if (jdbc.update("DELETE FROM public.attendance_report_schedules WHERE id=? AND company_id=?", id, companyId) == 0)
            throw new ResourceNotFoundException("AttendanceReportSchedule", id);
    }

    /** Executes one due schedule in the selected tenant schema. Called by the system scheduler. */
    public void deliver(long scheduleId, long companyId, ZonedDateTime now) {
        List<Object[]> rows = jdbc.query("SELECT frequency, day_of_week, day_of_month, send_at, time_zone, recipient_employee_ids, last_run_date, name "
                        + "FROM public.attendance_report_schedules WHERE id=? AND company_id=? AND enabled=true",
                (rs, n) -> new Object[]{rs.getString("frequency"), rs.getObject("day_of_week", Integer.class),
                        rs.getObject("day_of_month", Integer.class), rs.getObject("send_at", LocalTime.class),
                        rs.getString("time_zone"), rs.getString("recipient_employee_ids"),
                        rs.getObject("last_run_date", LocalDate.class), rs.getString("name")}, scheduleId, companyId);
        if (rows.isEmpty()) return;
        Object[] row = rows.get(0);
        Frequency frequency = Frequency.valueOf((String) row[0]);
        Integer dayOfWeek = (Integer) row[1];
        Integer dayOfMonth = (Integer) row[2];
        LocalTime sendAt = (LocalTime) row[3];
        ZoneId zone = ZoneId.of((String) row[4]);
        LocalDate lastRunDate = (LocalDate) row[6];
        ZonedDateTime localNow = now.withZoneSameInstant(zone);
        LocalDate today = localNow.toLocalDate();
        if (Objects.equals(lastRunDate, today) || localNow.toLocalTime().isBefore(sendAt)) return;
        if (frequency == Frequency.WEEKLY && today.getDayOfWeek().getValue() != dayOfWeek) return;
        if (frequency == Frequency.MONTHLY && today.getDayOfMonth() != Math.min(dayOfMonth, today.lengthOfMonth())) return;

        LocalDate from;
        LocalDate to;
        switch (frequency) {
            case DAILY -> from = to = today.minusDays(1);
            case WEEKLY -> {
                LocalDate thisWeekStart = today.with(DayOfWeek.MONDAY);
                from = thisWeekStart.minusWeeks(1);
                to = thisWeekStart.minusDays(1);
            }
            case MONTHLY -> {
                from = today.withDayOfMonth(1).minusMonths(1);
                to = from.withDayOfMonth(from.lengthOfMonth());
            }
            default -> throw new IllegalStateException("Unsupported report frequency");
        }
        deliverReport(scheduleId, companyId, (String) row[5], from, to, (String) row[7], today);
    }

    private void deliverReport(long scheduleId, long companyId, String recipientIds, LocalDate from, LocalDate to, String name, LocalDate scheduleDate) {
        String status = "FAILED";
        String message = "No valid employee recipients were found.";
        try {
            List<Long> ids = parseIds(recipientIds);
            List<Employee> recipients = employees.findByCompanyIdAndIsActiveTrue(companyId).stream()
                    .filter(employee -> ids.contains(employee.getId()) && recipientEmail(employee) != null).toList();
            if (recipients.isEmpty()) throw new IllegalStateException(message);
            if (!email.hasActiveSmtpConfig(companyId)) throw new IllegalStateException("Configure active email delivery for this company before enabling scheduled reports.");
            byte[] report = attendance.exportToExcelBytes(companyId, null, from, to);
            String filename = "attendance-" + from + "-to-" + to + ".xlsx";
            String subject = "Attendance report: " + name + " (" + from + " to " + to + ")";
            String body = "<p>Hello,</p><p>Your scheduled attendance report <strong>" + escape(name)
                    + "</strong> for <strong>" + from + " to " + to + "</strong> is attached.</p>"
                    + "<p>This message was sent automatically by GRECHA.AI.</p>";
            int sent = 0;
            for (Employee recipient : recipients) {
                if (email.sendEmailWithAttachment(companyId, recipientEmail(recipient), subject, body, recipient, filename, report)) sent++;
            }
            status = sent == recipients.size() ? "SENT" : sent > 0 ? "PARTIAL" : "FAILED";
            message = sent + " of " + recipients.size() + " email(s) sent.";
        } catch (Exception ex) {
            message = Optional.ofNullable(ex.getMessage()).orElse("Report delivery failed.");
            log.error("Scheduled attendance report {} failed for company {}", scheduleId, companyId, ex);
        }
        jdbc.update("UPDATE public.attendance_report_schedules SET last_run_date=?, last_run_at=now(), last_run_status=?, last_run_message=?, updated_at=now() WHERE id=? AND company_id=?",
                scheduleDate, status, message, scheduleId, companyId);
    }

    private void validateRequest(Long companyId, AttendanceReportScheduleRequest request) {
        requireSelectedCompany(companyId);
        if (request.frequency() == Frequency.WEEKLY && (request.dayOfWeek() == null || request.dayOfWeek() < 1 || request.dayOfWeek() > 7))
            throw new BadRequestException("Choose a weekday for the weekly report.");
        if (request.frequency() == Frequency.MONTHLY && (request.dayOfMonth() == null || request.dayOfMonth() < 1 || request.dayOfMonth() > 31))
            throw new BadRequestException("Choose a day from 1 to 31 for the monthly report.");
        try { ZoneId.of(request.timeZone()); } catch (Exception e) { throw new BadRequestException("Choose a valid time zone."); }
        List<Long> requested = parseIds(normalizeIds(request.recipientEmployeeIds()));
        Set<Long> eligible = employees.findByCompanyIdAndIsActiveTrue(companyId).stream()
                .filter(employee -> recipientEmail(employee) != null).map(Employee::getId).collect(Collectors.toSet());
        if (requested.isEmpty() || !eligible.containsAll(requested))
            throw new BadRequestException("Select one or more active employees with an email address from this company.");
    }

    private void requireSelectedCompany(Long companyId) {
        AccessScopeContext.ScopeData scope = AccessScopeContext.get();
        Long selectedCompanyId = scope == null ? null
                : scope.getFilterCompanyId() != null ? scope.getFilterCompanyId() : scope.getCompanyId();
        if (scope == null || selectedCompanyId == null || !selectedCompanyId.equals(companyId) || scope.isSelfScope()
                || scope.getScope() == com.example.demo.auth.entity.UserRole.AccessScope.DEPARTMENT
                || !scope.canAccess(companyId))
            throw new org.springframework.security.access.AccessDeniedException("You cannot manage attendance reports for this company.");
        var company = companies.findById(companyId).orElseThrow(() -> new ResourceNotFoundException("Company", companyId));
        var owner = company.isHeadOffice() ? company : companies.findById(company.getParentCompanyId())
                .orElseThrow(() -> new BadRequestException("The selected company has no workspace."));
        if (!company.isActive() || !owner.isSchemaReady() || owner.getSchemaName() == null || !owner.getSchemaName().equals(TenantContext.getTenant()))
            throw new BadRequestException("Select a company in the active workspace before managing report schedules.");
    }

    private Map<String, Object> getById(Long companyId, Long id) {
        return jdbc.query("SELECT * FROM public.attendance_report_schedules WHERE id=? AND company_id=?",
                rs -> rs.next() ? scheduleMap(rs.getLong("id"), rs.getString("name"), rs.getString("frequency"),
                        rs.getObject("day_of_week", Integer.class), rs.getObject("day_of_month", Integer.class),
                        rs.getObject("send_at", LocalTime.class), rs.getString("time_zone"), rs.getString("recipient_employee_ids"),
                        rs.getBoolean("enabled"), rs.getObject("last_run_date", LocalDate.class), rs.getString("last_run_status"),
                        rs.getString("last_run_message"), companyId) : null, id, companyId);
    }

    private Map<String, Object> scheduleMap(Long id, String name, String frequency, Integer dayOfWeek, Integer dayOfMonth,
                                             LocalTime sendAt, String timeZone, String recipientIds, boolean enabled,
                                             LocalDate lastRunDate, String lastRunStatus, String lastRunMessage, Long companyId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id); result.put("companyId", companyId); result.put("name", name);
        result.put("frequency", frequency); result.put("dayOfWeek", dayOfWeek); result.put("dayOfMonth", dayOfMonth);
        result.put("sendAt", sendAt == null ? null : sendAt.toString()); result.put("timeZone", timeZone);
        result.put("recipientEmployeeIds", parseIds(recipientIds)); result.put("enabled", enabled);
        result.put("lastRunDate", lastRunDate); result.put("lastRunStatus", lastRunStatus); result.put("lastRunMessage", lastRunMessage);
        return result;
    }

    private String normalizeIds(List<Long> ids) {
        if (ids == null) return "";
        return ids.stream().filter(Objects::nonNull).distinct().sorted().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> parseIds(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Long::valueOf).distinct().toList();
    }

    private static String recipientEmail(Employee employee) {
        String address = employee.getWorkEmail();
        if (address == null || address.isBlank()) address = employee.getEmail();
        return address == null || address.isBlank() ? null : address.trim();
    }

    private static String escape(String value) { return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); }
}
