package com.example.demo.attendance.service;

import com.example.demo.attendance.entity.Attendance;
import com.example.demo.attendance.repository.*;
import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.leave.entity.LeaveRequest;
import com.example.demo.leave.entity.LeaveType;
import com.example.demo.leave.repository.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayInputStream;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ApprovedLeaveAttendanceReportTest {
    @Mock AttendanceRepository attendanceRepository;
    @Mock EmployeeRepository employeeRepository;
    @Mock LeaveRequestRepository leaveRequestRepository;
    @Mock HolidayRepository holidayRepository;
    @Mock AttendanceLateComeEarlyOutRepository lateComeEarlyOutRepository;
    @Mock AttendanceRegularisationRequestRepository regularisationRequestRepository;
    @Mock EmployeeAttendancePolicyService attendancePolicies;
    @InjectMocks AttendanceService service;
    Company company; Employee employee;
    List<Attendance> attendances; List<LeaveRequest> leaves;
    @BeforeEach void setup() {
        company=new Company();company.setId(7L);company.setName("Company");
        employee=new Employee();employee.setId(13L);employee.setCompany(company);employee.setFirstName("Employee");employee.setActive(true);
        attendances=new ArrayList<>();leaves=new ArrayList<>();
        int[] dates={2,14,22};
        var durations=List.of(LeaveRequest.LeaveDuration.SECOND_HALF,LeaveRequest.LeaveDuration.FIRST_HALF,LeaveRequest.LeaveDuration.FULL_DAY);
        for(int i=0;i<dates.length;i++) {
            LocalDate day=LocalDate.of(2026,10,dates[i]);
            var a=new Attendance();a.setId((long)i+1);a.setCompany(company);a.setEmployee(employee);a.setAttendanceDate(day);a.setAttendanceStatus(Attendance.AttendanceQualityStatus.REGULAR);
            if(i<2){a.setCheckIn(LocalTime.of(9,0));a.setCheckOut(LocalTime.of(13,6+i*27));a.setWorkedHour(i==0?4.1:4.55);}
            attendances.add(a);
            var l=new LeaveRequest();l.setCompany(company);l.setEmployee(employee);l.setStartDate(day);l.setEndDate(day);l.setStatus(LeaveRequest.LeaveStatus.APPROVED);l.setLeaveDuration(durations.get(i));
            var t=new LeaveType();t.setName("Leave Without Pay");l.setLeaveType(t);leaves.add(l);
        }
        lenient().when(employeeRepository.findByCompanyIdAndIsActiveTrue(7L)).thenReturn(List.of(employee));
        lenient().when(employeeRepository.findById(13L)).thenReturn(Optional.of(employee));
        lenient().when(attendanceRepository.findByCompanyIdAndAttendanceDateBetween(eq(7L),any(),any())).thenReturn(attendances);
        lenient().when(leaveRequestRepository.findApprovedByCompanyAndDateRange(eq(7L),any(),any())).thenReturn(leaves);
        lenient().when(leaveRequestRepository.findByCompanyIdAndStatus(7L,LeaveRequest.LeaveStatus.APPROVED)).thenReturn(leaves);
        lenient().when(attendancePolicies.index(eq(7L),any(),any())).thenReturn(new EmployeeAttendancePolicyService.PolicyIndex(List.of()));
    }
    @Test void fullViewReflectsAllThreeApprovedDatesWithoutChangingPunches() {
        var result=service.getFullView(7L,LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),null,13L,null,PageRequest.of(0,100));
        var approved=result.getContent().stream().filter(r->"ON_LEAVE".equals(r.getDisplayStatus())).toList();
        assertThat(approved).hasSize(3);
        assertThat(approved.stream().filter(r->r.getAttendanceDate().getDayOfMonth()==14).findFirst().orElseThrow().getCheckOut()).isEqualTo(LocalTime.of(13,33));
        verify(attendanceRepository,never()).save(any());
    }
    @Test void downloadableAttendanceHasFirstSecondAndFullDayLabels() throws Exception {
        var response=new MockHttpServletResponse();
        service.exportToExcel(7L,List.of(13L),LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),response);
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(response.getContentAsByteArray()))) {
            var statuses=new ArrayList<String>();var sheet=book.getSheetAt(0);
            for(var row:sheet) if(row.getRowNum()>=2)statuses.add(row.getCell(14).getStringCellValue());
            assertThat(statuses).anyMatch(s->s.contains("First half - 0.5 day"));
            assertThat(statuses).anyMatch(s->s.contains("Second half - 0.5 day"));
            assertThat(statuses).anyMatch(s->s.contains("Full day"));
        }
        verify(attendanceRepository,never()).save(any());
    }
    @Test void registerCountsTwoHalfDaysAndOneFullDayAsTwoLeaveDays() {
        var row=service.getRegister(7L,null,2026,10).getEmployees().get(0);
        assertThat(row.getDays().get("2026-10-02").getDisplayStatus()).isEqualTo("HL");
        assertThat(row.getDays().get("2026-10-14").getDisplayStatus()).isEqualTo("HL");
        assertThat(row.getDays().get("2026-10-22").getDisplayStatus()).isEqualTo("OL");
        assertThat(row.getLeaveCount()).isEqualTo(2.0);
    }
    @Test void registerDownloadShowsHalfDaysAndCorrectTotal() throws Exception {
        var response=new MockHttpServletResponse();service.exportRegisterToExcel(7L,null,2026,10,response);
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(response.getContentAsByteArray()))) {
            var row=book.getSheetAt(0).getRow(2);
            assertThat(row.getCell(3).getStringCellValue()).isEqualTo("HL");
            assertThat(row.getCell(15).getStringCellValue()).isEqualTo("HL");
            assertThat(row.getCell(23).getStringCellValue()).isEqualTo("OL");
            assertThat(row.getCell(36).getNumericCellValue()).isEqualTo(2.0);
        }
    }
}
