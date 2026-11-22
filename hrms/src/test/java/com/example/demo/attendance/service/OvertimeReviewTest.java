package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.entity.AttendanceRegularisationRequest;
import com.example.demo.attendance.entity.AttendanceValidationCondition;
import com.example.demo.attendance.repository.AttendanceRepository;
import com.example.demo.attendance.repository.AttendanceValidationConditionRepository;
import com.example.demo.attendance.repository.GraceTimeRepository;
import com.example.demo.attendance.repository.AttendanceLateComeEarlyOutRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.ShiftSchedule;
import com.example.demo.base.repository.ShiftScheduleRepository;
import com.example.demo.employee.entity.Employee;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OvertimeReviewTest {
    @Mock AttendanceRepository attendances;
    @Mock AttendanceValidationConditionRepository policies;
    @Mock GraceTimeRepository graceTimes;
    @Mock AttendanceLateComeEarlyOutRepository lateComeEarlyOutRepository;
    @Mock ShiftScheduleRepository shiftSchedules;
    @Mock EmployeeAttendancePolicyService attendancePolicies;
    @InjectMocks AttendanceService service;
    final LocalDate date = LocalDate.of(2026, 11, 15);
    final Attendance attendance = new Attendance();
    final AttendanceValidationCondition policy = new AttendanceValidationCondition();

    @BeforeEach
    void setUp() {
        var shift = new ShiftSchedule();
        shift.setStartTime(LocalTime.of(9, 0));
        shift.setEndTime(LocalTime.of(18, 0));
        var company = new Company();
        company.setId(1L);
        attendance.setId(2L);
        attendance.setEmployee(new Employee());
        attendance.setCompany(company);
        attendance.setAttendanceDate(date);
        attendance.setShift(shift);
        attendance.setCheckIn(LocalTime.of(9, 0));
        attendance.setCheckOut(LocalTime.of(21, 0));
        attendance.setMinimumHour(9.0);
        policy.setOvertimeReviewFrom(date);
    }

    void compute() {
        when(attendances.findById(2L)).thenReturn(Optional.of(attendance));
        when(attendances.save(attendance)).thenReturn(attendance);
        when(policies.findByCompanyId(1L)).thenReturn(Optional.of(policy));
        service.computeWorkedHours(2L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"13:00", "13:15"})
    void saturdayUsesTheConfiguredFourHourShift(String checkout) {
        var general = attendance.getShift();
        general.setId(1L);
        general.setCompany(attendance.getCompany());
        general.setWeekdayShiftIds(Map.of(DayOfWeek.SATURDAY, 4L));
        attendance.setAttendanceDate(LocalDate.of(2026, 11, 14));
        attendance.setCheckOut(LocalTime.parse(checkout));
        attendance.setMinimumHour(8.0);
        var half = new ShiftSchedule();
        half.setId(4L);
        half.setCompany(attendance.getCompany());
        half.setStartTime(LocalTime.of(9, 0));
        half.setEndTime(LocalTime.of(13, 0));
        half.setMinimumWorkingHour(4);
        half.setWeeklyOffDays("MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SUNDAY");
        when(shiftSchedules.findById(4L)).thenReturn(Optional.of(half));
        when(attendancePolicies.required(attendance.getEmployee(), attendance.getAttendanceDate())).thenReturn(true);

        compute();

        assertSame(half, attendance.getShift());
        assertEquals(4.0, attendance.getMinimumHour());
        assertEquals(0, attendance.getDeductionMinutes());
        assertEquals(Attendance.AttendanceQualityStatus.REGULAR, attendance.getAttendanceStatus());
    }

    @Test
    void weekdaysKeepTheGeneralShiftAndCompanyBoundariesAreRespected() {
        var general = attendance.getShift();
        general.setId(1L);
        general.setCompany(attendance.getCompany());
        general.setWeekdayShiftIds(Map.of(DayOfWeek.SATURDAY, 4L));
        attendance.setAttendanceDate(LocalDate.of(2026, 11, 16));
        assertFalse(service.configureShiftForAttendance(attendance));
        verifyNoInteractions(shiftSchedules);

        var anotherCompany = new Company();
        anotherCompany.setId(99L);
        var unrelatedShift = new ShiftSchedule();
        unrelatedShift.setCompany(anotherCompany);
        attendance.setAttendanceDate(LocalDate.of(2026, 11, 14));
        when(shiftSchedules.findById(4L)).thenReturn(Optional.of(unrelatedShift));
        assertFalse(service.configureShiftForAttendance(attendance));
        assertSame(general, attendance.getShift());
    }

    @Test
    void weeklyScheduleShowsTheActualDayTimesAndSundayWeekOff() {
        var general = attendance.getShift();
        general.setId(1L);
        general.setName("General");
        general.setCompany(attendance.getCompany());
        general.setMinimumWorkingHour(8);
        general.setWeeklyOffDays("SATURDAY,SUNDAY");
        general.setWeekdayShiftIds(Map.of(DayOfWeek.SATURDAY, 4L));
        attendance.getEmployee().setShift(general);
        var half = new ShiftSchedule();
        half.setId(4L);
        half.setCompany(attendance.getCompany());
        half.setStartTime(LocalTime.of(9, 0));
        half.setEndTime(LocalTime.of(13, 0));
        half.setMinimumWorkingHour(4);
        when(shiftSchedules.findById(4L)).thenReturn(Optional.of(half));

        var schedule = service.weeklyShiftSchedule(attendance.getEmployee(), LocalDate.of(2026, 11, 18));
        assertEquals(7, schedule.days().size());
        assertEquals(LocalDate.of(2026, 11, 16), schedule.days().get(0).date());
        assertEquals(LocalTime.of(18, 0), schedule.days().get(0).endTime());
        assertEquals(LocalTime.of(13, 0), schedule.days().get(5).endTime());
        assertEquals(4.0, schedule.days().get(5).requiredHours());
        assertFalse(schedule.days().get(5).weekOff());
        assertTrue(schedule.days().get(6).weekOff());
        assertNull(schedule.days().get(6).startTime());
        assertSame(general, attendance.getEmployee().getShift());
        verifyNoInteractions(attendances);
    }

    @Test
    void explanationFlagsCompareToScheduledPunchTimesWithoutChangingAttendance() {
        attendance.setCheckIn(LocalTime.of(8, 59));
        attendance.setCheckOut(LocalTime.of(18, 0));
        var onTime = com.example.demo.attendance.dto.AttendanceResponse.from(attendance);
        assertFalse(onTime.isLateCheckIn());
        assertFalse(onTime.isLateCheckOut());
        assertNull(onTime.getPunchReasonType(), "history should never open the punch dialog");

        attendance.setCheckIn(LocalTime.of(9, 5));
        attendance.setCheckOut(LocalTime.of(18, 10));
        var late = com.example.demo.attendance.dto.AttendanceResponse.from(attendance);
        assertTrue(late.isLateCheckIn());
        assertTrue(late.isLateCheckOut());
    }

    @Test
    void nextMorningCheckoutIsComparedToTheOvernightShiftEnd() {
        attendance.getShift().setStartTime(LocalTime.of(22, 0));
        attendance.getShift().setEndTime(LocalTime.of(6, 0));
        attendance.setCheckOutDate(date.plusDays(1));
        attendance.setCheckOut(LocalTime.of(5, 55));
        assertEquals(0, OvertimeReview.lateCheckoutSeconds(attendance));
        attendance.setCheckOut(LocalTime.of(6, 5));
        assertEquals(300, OvertimeReview.lateCheckoutSeconds(attendance));
    }

    @ParameterizedTest
    @EnumSource(value = AttendanceRegularisationRequest.RequestType.class,
            names = {"LATE_CHECK_IN_REASON", "LATE_CHECK_OUT_REASON"})
    void approvedLateReasonRegularisesTheDayWithoutChangingPunchesOrOvertime(
            AttendanceRegularisationRequest.RequestType requestType) {
        attendance.setCheckIn(LocalTime.of(9, 10));
        attendance.setAttendanceStatus(Attendance.AttendanceQualityStatus.IRREGULAR);
        attendance.setCheckoutNeedsReview(true);
        attendance.setDeductionMinutes(10);
        attendance.setDeductionAmount(25.0);
        attendance.setOvertimeSecond(0);
        var request = new AttendanceRegularisationRequest();
        request.setAttendance(attendance);
        request.setRequestType(requestType);
        service.applyRegularisationApproval(request);
        assertEquals(LocalTime.of(9, 10), attendance.getCheckIn());
        assertEquals(LocalTime.of(21, 0), attendance.getCheckOut());
        assertEquals(0, attendance.getDeductionMinutes());
        assertEquals(0.0, attendance.getDeductionAmount());
        assertEquals(0, attendance.getOvertimeSecond());
        assertTrue(attendance.getCheckoutNeedsReview());
        assertEquals(Attendance.AttendanceQualityStatus.REGULARISED, attendance.getAttendanceStatus());
        assertEquals(Attendance.RegularisationStatus.REGULARISED, attendance.getRegularisationStatus());
        verify(lateComeEarlyOutRepository).markAllAsRegularisedByAttendanceId(attendance.getId());
        verify(attendances).save(attendance);
    }

    @Test
    void latePunchIsPreservedButNotPayableWithoutApproval() {
        compute();
        assertEquals(LocalTime.of(21, 0), attendance.getCheckOut());
        assertEquals(10800, attendance.getReviewableOvertimeSeconds());
        assertEquals(10800, attendance.getUnapprovedWorkSeconds());
        assertEquals(0, attendance.getOvertimeSecond());
        assertTrue(attendance.getCheckoutNeedsReview());

        var request = new AttendanceRegularisationRequest();
        request.setAttendance(attendance);
        request.setRequestType(AttendanceRegularisationRequest.RequestType.OVERTIME_REQUEST);
        request.setRequestedOvertimeHours(1.0);
        service.applyRegularisationApproval(request);
        assertEquals(3600, attendance.getOvertimeSecond());
        assertEquals(10800, attendance.getUnapprovedWorkSeconds());
    }

    @Test
    void pastAttendanceRetainsLegacyOvertime() {
        policy.setOvertimeReviewFrom(date.plusDays(1));
        compute();
        assertEquals(10800, attendance.getOvertimeSecond());
        assertNull(attendance.getReviewableOvertimeSeconds());
    }

    @Test
    void spreadsheetHoursWithoutCheckoutAreHeldOutOfPay() {
        attendance.setCheckOut(null);
        attendance.setAtWorkSecond(43200);
        when(policies.findByCompanyId(1L)).thenReturn(Optional.of(policy));

        service.reviewImportedOvertime(attendance);

        assertEquals(0, attendance.getReviewableOvertimeSeconds());
        assertEquals(0, attendance.getOvertimeSecond());
        assertEquals(43200, attendance.getUnapprovedWorkSeconds());
    }

    @Test
    void overnightShiftIsNotMistakenForLateCheckoutOrMissingPunch() {
        attendance.getShift().setStartTime(LocalTime.of(20, 0));
        attendance.getShift().setEndTime(LocalTime.of(5, 0));
        attendance.setCheckIn(LocalTime.of(20, 0));
        attendance.setCheckOut(LocalTime.of(5, 15));
        attendance.setCheckOutDate(date.plusDays(1));
        assertEquals(900, OvertimeReview.lateCheckoutSeconds(attendance));
        attendance.setCheckOut(null);
        assertFalse(OvertimeReview.missingCheckout(attendance, date.plusDays(1)));
        assertTrue(OvertimeReview.missingCheckout(attendance, date.plusDays(2)));
    }
}
