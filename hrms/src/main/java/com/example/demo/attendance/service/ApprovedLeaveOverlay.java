package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceResponse;
import com.example.demo.leave.entity.LeaveRequest;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Read-only approved-leave projection. Never alters punches, balances or approvals. */
final class ApprovedLeaveOverlay {
    record Coverage(double days, String label) {}
    private ApprovedLeaveOverlay() {}

    static Coverage forDay(Long companyId, Long employeeId, LocalDate date, List<LeaveRequest> leaves) {
        if (date == null || leaves == null) return null;
        var labels = new LinkedHashSet<String>();
        boolean first = false, second = false;
        for (LeaveRequest leave : leaves) {
            if (leave == null || !leave.isActive() || leave.getStatus() != LeaveRequest.LeaveStatus.APPROVED
                    || leave.getCompany() == null || !Objects.equals(companyId, leave.getCompany().getId())
                    || leave.getEmployee() == null || !Objects.equals(employeeId, leave.getEmployee().getId())
                    || leave.getStartDate() == null || leave.getEndDate() == null
                    || date.isBefore(leave.getStartDate()) || date.isAfter(leave.getEndDate())) continue;
            String type = leave.getLeaveType() != null ? leave.getLeaveType().getName() : "Leave";
            var duration = leave.getLeaveDuration();
            if (duration == null || duration == LeaveRequest.LeaveDuration.FULL_DAY)
                return new Coverage(1.0, type + " (Full day)");
            if (duration == LeaveRequest.LeaveDuration.FIRST_HALF) {
                first = true; labels.add(type + " (First half - 0.5 day)");
            } else if (duration == LeaveRequest.LeaveDuration.SECOND_HALF) {
                second = true; labels.add(type + " (Second half - 0.5 day)");
            }
        }
        double days = (first ? 0.5 : 0) + (second ? 0.5 : 0);
        return days == 0 ? null : new Coverage(days, String.join(" + ", labels));
    }

    static AttendanceResponse apply(AttendanceResponse row, List<LeaveRequest> leaves) {
        Coverage coverage = forDay(row.getCompanyId(), row.getEmployeeId(), row.getAttendanceDate(), leaves);
        if (coverage != null) {
            row.setDisplayStatus("ON_LEAVE");
            row.setLeaveTypeName(coverage.label());
        }
        return row;
    }
}
