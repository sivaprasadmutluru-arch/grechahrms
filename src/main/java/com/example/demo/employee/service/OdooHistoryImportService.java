package com.example.demo.employee.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.common.exception.BadRequestException;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.leave.entity.LeaveRequest;
import com.example.demo.leave.repository.LeaveRequestRepository;
import com.example.demo.leave.repository.LeaveTypeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OdooHistoryImportService {
    public enum Kind { LEAVE, ATTENDANCE }
    private static final ZoneId ZONE = ZoneId.of("Asia/Dubai");
    private static final DateTimeFormatter ODOO_TIME = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss");
    private final OdooEmployeeClient client;
    private final OdooEmployeeImportService scope;
    private final EmployeeRepository employees;
    private final LeaveTypeRepository types;
    private final LeaveRequestRepository leaves;
    private final AttendanceRepository attendance;
    private final TransactionTemplate transaction;
    private final Map<UUID, Snapshot> previews = new HashMap<>();

    public record Row(String employee, LocalDate date, String detail, boolean ready, String note) {}
    public record Preview(UUID token, String companyName, List<Row> rows) {}
    public record Result(int imported, int skipped, List<String> warnings) {}
    private record Entry(Row row, Long employeeId, Long typeId, LocalDate end, double days,
                         LeaveRequest.LeaveDuration duration, Instant in, Instant out, int seconds) {}
    private record Snapshot(Long user, Long company, Kind kind, Instant expires, List<Entry> entries) {}

    public Preview preview(Long company, Kind kind, String url, String database, String key, long source,
                           LocalDate from, LocalDate to) {
        var target = scope.target(company);
        if (to.isBefore(from) || to.isAfter(LocalDate.now(ZONE).minusDays(1)) || to.isAfter(from.plusDays(90)))
            throw new BadRequestException("Select a past date range of up to 91 days.");
        var sourceRows = client.read(url, database, key, source);
        String namespace = OdooEmployeeImportService.namespace(url, database, source);
        List<JsonNode> records = new ArrayList<>();
        String start = kind == Kind.LEAVE ? from.toString() : utcBoundary(from);
        String until = kind == Kind.LEAVE ? to.plusDays(1).toString() : utcBoundary(to.plusDays(1));
        long after = 0;
        while (true) {
            var page = client.historyPage(url, database, key, kind == Kind.LEAVE, source, start, until, after);
            for (var row : page) {
                long id = row.path("id").asLong();
                if (id <= after) throw new BadRequestException("Odoo returned unexpected record IDs.");
                after = id;
                records.add(row);
                if (records.size() > 1000) throw new BadRequestException("More than 1,000 records found. Select a shorter range.");
            }
            if (page.size() < 100) break;
        }
        var entries = transaction.execute(status -> plan(company, kind, namespace, sourceRows, records, from, to));
        UUID token = UUID.randomUUID();
        Long user = target.userId();
        synchronized (previews) {
            previews.values().removeIf(p -> !p.expires().isAfter(Instant.now()) || p.user().equals(user));
            if (previews.size() >= 32) throw new BadRequestException("Too many active previews. Try again shortly.");
            previews.put(token, new Snapshot(user, company, kind, Instant.now().plusSeconds(600), entries));
        }
        return new Preview(token, target.companyName(), entries.stream().map(Entry::row).toList());
    }

    private List<Entry> plan(Long company, Kind kind, String namespace, List<OdooEmployeeClient.EmployeeRow> source,
                             List<JsonNode> records, LocalDate from, LocalDate to) {
        Map<Long, Long> matches = new HashMap<>();
        for (var row : source) {
            var match = employees.findFirstByNormalizedBadgeId("ODOO-" + namespace + "-" + row.id());
            if (match.isEmpty() && row.email() != null)
                match = employees.findFirstByNormalizedEmail(row.email().trim().toLowerCase(Locale.ROOT));
            match.filter(e -> company.equals(e.getCompany().getId())).ifPresent(e -> matches.put(row.id(), e.getId()));
        }
        var leaveTypes = kind == Kind.LEAVE ? types.findByCompanyIdAndIsActiveTrue(company) : List.<com.example.demo.leave.entity.LeaveType>of();
        List<Entry> result = new ArrayList<>();
        Map<String, List<Entry>> daily = new LinkedHashMap<>();
        Set<String> incompleteDays = new HashSet<>();
        for (var record : records) {
            Long sourceEmployee = OdooEmployeeClient.relationId(record, "employee_id");
            String name = OdooEmployeeClient.relationName(record, "employee_id");
            Long employee = matches.get(sourceEmployee);
            if (employee == null) { result.add(skip(name, null, "Employee not matched; import employees first")); continue; }
            try {
                if (kind == Kind.LEAVE) {
                    LocalDate date = LocalDate.parse(record.path("request_date_from").asText());
                    LocalDate end = LocalDate.parse(record.path("request_date_to").asText());
                    double days = record.path("number_of_days").asDouble();
                    String type = OdooEmployeeClient.relationName(record, "holiday_status_id");
                    var matchedTypes = leaveTypes.stream().filter(t -> type != null && type.trim().equalsIgnoreCase(t.getName().trim())).toList();
                    var duration = duration(record, date, end, days);
                    if (matchedTypes.size() != 1 || duration == null || date.isBefore(from) || end.isAfter(to)
                            || !Double.isFinite(days) || days <= 0 || days > end.toEpochDay() - date.toEpochDay() + 1) {
                        result.add(skip(name, date, "Unmapped leave type, unsupported duration, or date range")); continue;
                    }
                    Long typeId = matchedTypes.getFirst().getId();
                    boolean exists = leaves.existsApprovedOverlap(employee, typeId, date, end);
                    result.add(new Entry(new Row(name, date, type + " · " + days + " days", !exists,
                            exists ? "Overlaps existing approved leave" : "Ready"), employee, typeId, end, days, duration, null, null, 0));
                } else {
                    Instant in = timestamp(record, "check_in");
                    LocalDate date = in.atZone(ZONE).toLocalDate();
                    String dayKey = employee + ":" + date;
                    Instant out;
                    try { out = timestamp(record, "check_out"); }
                    catch (DateTimeException ex) {
                        incompleteDays.add(dayKey);
                        result.add(skip(name, date, "Missing or invalid checkout"));
                        continue;
                    }
                    double hours = record.path("worked_hours").asDouble(-1);
                    long span = Duration.between(in, out).toSeconds();
                    if (date.isBefore(from) || out.atZone(ZONE).toLocalDate().isAfter(to)
                            || span <= 0 || span > 86400 || !Double.isFinite(hours) || hours < 0 || hours * 3600 > span + 1) {
                        incompleteDays.add(dayKey);
                        result.add(skip(name, date, "Invalid or out-of-range punches")); continue;
                    }
                    daily.computeIfAbsent(dayKey, ignored -> new ArrayList<>()).add(
                            new Entry(new Row(name, date, "", true, "Ready"), employee, null, null, 0, null, in, out,
                                    (int) Math.round(hours * 3600)));
                }
            } catch (DateTimeException ex) {
                result.add(skip(name, null, "Missing or invalid dates/punches"));
            }
        }
        for (var group : daily.entrySet()) {
            var sessions = group.getValue();
            sessions.sort(Comparator.comparing(Entry::in));
            Entry first = sessions.getFirst();
            Instant out = first.out();
            int seconds = first.seconds();
            boolean overlap = false;
            for (Entry next : sessions.subList(1, sessions.size())) {
                if (next.in().isBefore(out)) overlap = true;
                out = next.out();
                seconds += next.seconds();
            }
            boolean exists = attendance.findByEmployeeIdAndAttendanceDate(first.employeeId(), first.row().date()).isPresent();
            boolean incomplete = incompleteDays.contains(group.getKey());
            result.add(new Entry(new Row(first.row().employee(), first.row().date(), sessions.size() + " session(s) · "
                    + String.format(Locale.ROOT, "%.2f h", seconds / 3600.0), !overlap && !exists && !incomplete,
                    incomplete ? "Day has an incomplete session" : overlap ? "Overlapping Odoo sessions" : exists ? "Attendance already exists" : "Ready"),
                    first.employeeId(), null, null, 0, null, first.in(), out, seconds));
        }
        return List.copyOf(result);
    }

    public Result commit(Long company, Kind kind, UUID token) {
        scope.target(company);
        Snapshot snapshot;
        synchronized (previews) {
            snapshot = previews.get(token);
            if (snapshot == null || !snapshot.user().equals(AccessScopeContext.get().getUserId())
                    || !snapshot.company().equals(company) || snapshot.kind() != kind || !snapshot.expires().isAfter(Instant.now()))
                throw new BadRequestException("This preview is expired or does not match the selected company and step.");
            previews.remove(token);
        }
        int imported = 0;
        List<String> warnings = new ArrayList<>();
        for (Entry entry : snapshot.entries()) {
            if (!entry.row().ready()) continue;
            try {
                if (Boolean.TRUE.equals(transaction.execute(status -> save(company, kind, entry)))) imported++;
                else warnings.add(entry.row().employee() + " · " + entry.row().date() + ": already imported or mapping changed.");
            } catch (RuntimeException ex) {
                warnings.add(entry.row().employee() + " · " + entry.row().date() + ": could not be saved.");
            }
        }
        return new Result(imported, snapshot.entries().size() - imported, warnings);
    }

    private boolean save(Long company, Kind kind, Entry entry) {
        var employee = employees.findByIdForProbationConfirmation(entry.employeeId())
                .filter(e -> company.equals(e.getCompany().getId())).orElse(null);
        if (employee == null) return false;
        LocalDate date = entry.row().date();
        if (kind == Kind.LEAVE) {
            var type = types.findById(entry.typeId()).filter(t -> t.isActive() && company.equals(t.getCompany().getId())).orElse(null);
            if (type == null || leaves.existsApprovedOverlap(employee.getId(), type.getId(), date, entry.end())) return false;
            var leave = new LeaveRequest();
            leave.setEmployee(employee); leave.setCompany(employee.getCompany()); leave.setLeaveType(type);
            leave.setStartDate(date); leave.setEndDate(entry.end()); leave.setRequestedDays(entry.days());
            leave.setLeaveDuration(entry.duration()); leave.setStatus(LeaveRequest.LeaveStatus.APPROVED);
            leave.setDescription("Approved leave history imported from Odoo");
            leaves.save(leave);
        } else {
            if (attendance.findByEmployeeIdAndAttendanceDate(employee.getId(), date).isPresent()) return false;
            var record = new Attendance();
            var in = entry.in().atZone(ZONE); var out = entry.out().atZone(ZONE);
            record.setEmployee(employee); record.setCompany(employee.getCompany()); record.setAttendanceDate(date);
            record.setCheckInDate(in.toLocalDate()); record.setCheckOutDate(out.toLocalDate());
            record.setCheckIn(in.toLocalTime()); record.setCheckOut(out.toLocalTime());
            record.setCheckInUtc(entry.in()); record.setCheckOutUtc(entry.out());
            record.setWorkedHour(entry.seconds() / 3600.0); record.setAtWorkSecond(entry.seconds());
            record.setClockInSource("ODOO"); record.setClockOutSource("ODOO");
            attendance.save(record);
        }
        return true;
    }

    private static Entry skip(String name, LocalDate date, String note) {
        return new Entry(new Row(name, date, "", false, note), null, null, null, 0, null, null, null, 0);
    }
    static LeaveRequest.LeaveDuration duration(JsonNode row, LocalDate start, LocalDate end, double days) {
        if (row.path("request_unit_hours").asBoolean() || end.isBefore(start)) return null;
        if (!row.path("request_unit_half").asBoolean()) return LeaveRequest.LeaveDuration.FULL_DAY;
        String period = row.path("request_date_from_period").asText();
        if (!start.equals(end) || !period.equals(row.path("request_date_to_period").asText()) || days != .5) return null;
        return switch (period) {
            case "am" -> LeaveRequest.LeaveDuration.FIRST_HALF;
            case "pm" -> LeaveRequest.LeaveDuration.SECOND_HALF;
            default -> null;
        };
    }
    private static String utcBoundary(LocalDate date) {
        return ODOO_TIME.format(date.atStartOfDay(ZONE).withZoneSameInstant(ZoneOffset.UTC));
    }
    static Instant timestamp(JsonNode row, String field) {
        return LocalDateTime.parse(row.path(field).asText(), ODOO_TIME).toInstant(ZoneOffset.UTC);
    }
}
