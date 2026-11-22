package com.example.demo.attendance.service;

import com.example.demo.attendance.dto.AttendanceResponse;
import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.example.demo.leave.entity.LeaveRequest;
import com.example.demo.leave.entity.LeaveType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ApprovedLeaveOverlayTest {
    final LocalDate day=LocalDate.of(2026,10,14);
    LeaveRequest leave(LeaveRequest.LeaveDuration duration) {
        var c=new Company();c.setId(7L);var e=new Employee();e.setId(13L);e.setCompany(c);
        var type=new LeaveType();type.setName("Leave Without Pay");
        var r=new LeaveRequest();r.setCompany(c);r.setEmployee(e);r.setStartDate(day);r.setEndDate(day);
        r.setLeaveType(type);r.setLeaveDuration(duration);r.setStatus(LeaveRequest.LeaveStatus.APPROVED);
        return r;
    }
    AttendanceResponse row() {
        var row=new AttendanceResponse();row.setCompanyId(7L);row.setEmployeeId(13L);row.setAttendanceDate(day);
        row.setCheckIn(LocalTime.of(9,0));row.setCheckOut(LocalTime.of(13,33));row.setWorkedHour(4.55);
        row.setAttendanceStatus("REGULAR");row.setDisplayStatus("REGULAR");return row;
    }
    @Test void firstHalfLeaveOverlaysButDoesNotEraseActualPunches() {
        var row=row();ApprovedLeaveOverlay.apply(row,List.of(leave(LeaveRequest.LeaveDuration.FIRST_HALF)));
        assertThat(row.getDisplayStatus()).isEqualTo("ON_LEAVE");
        assertThat(row.getLeaveTypeName()).contains("First half", "0.5 day", "Leave Without Pay");
        assertThat(row.getCheckIn()).isEqualTo(LocalTime.of(9,0));
        assertThat(row.getCheckOut()).isEqualTo(LocalTime.of(13,33));
        assertThat(row.getWorkedHour()).isEqualTo(4.55);assertThat(row.getAttendanceStatus()).isEqualTo("REGULAR");
    }
    @Test void fullDayLeaveOverridesEmptyAttendancePlaceholder() {
        var row=row();row.setCheckIn(null);row.setCheckOut(null);
        ApprovedLeaveOverlay.apply(row,List.of(leave(LeaveRequest.LeaveDuration.FULL_DAY)));
        assertThat(row.getDisplayStatus()).isEqualTo("ON_LEAVE");assertThat(row.getLeaveTypeName()).contains("Full day");
    }
    @Test void secondHalfIsHalfAUnit() {
        var coverage=ApprovedLeaveOverlay.forDay(7L,13L,day,List.of(leave(LeaveRequest.LeaveDuration.SECOND_HALF)));
        assertThat(coverage.days()).isEqualTo(0.5);assertThat(coverage.label()).contains("Second half");
    }
    @Test void twoHalvesAreOneUnitAndDuplicateHalfDoesNotDoubleCount() {
        var first=leave(LeaveRequest.LeaveDuration.FIRST_HALF);var second=leave(LeaveRequest.LeaveDuration.SECOND_HALF);
        assertThat(ApprovedLeaveOverlay.forDay(7L,13L,day,List.of(first,first)).days()).isEqualTo(0.5);
        assertThat(ApprovedLeaveOverlay.forDay(7L,13L,day,List.of(first,second)).days()).isEqualTo(1);
    }
    @Test void requestedRejectedAndCancelledLeavesNeverOverlay() {
        for(var status:List.of(LeaveRequest.LeaveStatus.REQUESTED,LeaveRequest.LeaveStatus.REJECTED,LeaveRequest.LeaveStatus.CANCELLED)) {
            var leave=leave(LeaveRequest.LeaveDuration.FULL_DAY);leave.setStatus(status);
            assertThat(ApprovedLeaveOverlay.forDay(7L,13L,day,List.of(leave))).isNull();
        }
    }
    @Test void wrongEmployeeCompanyDateAndInactiveLeaveNeverOverlay() {
        var leave=leave(LeaveRequest.LeaveDuration.FULL_DAY);
        assertThat(ApprovedLeaveOverlay.forDay(8L,13L,day,List.of(leave))).isNull();
        assertThat(ApprovedLeaveOverlay.forDay(7L,14L,day,List.of(leave))).isNull();
        assertThat(ApprovedLeaveOverlay.forDay(7L,13L,day.plusDays(1),List.of(leave))).isNull();
        leave.setActive(false);assertThat(ApprovedLeaveOverlay.forDay(7L,13L,day,List.of(leave))).isNull();
    }
}
