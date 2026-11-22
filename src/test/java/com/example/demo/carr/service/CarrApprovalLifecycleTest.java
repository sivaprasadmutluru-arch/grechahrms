package com.example.demo.carr.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.*;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.carr.dto.CarrDtos.*;
import com.example.demo.carr.entity.*;
import com.example.demo.carr.repository.*;
import com.example.demo.common.context.CompanyContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real service lifecycle with isolated in-memory repository doubles, not a database integration test. */
@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness=org.mockito.quality.Strictness.LENIENT)
class CarrApprovalLifecycleTest {
    @Mock CarrRoleTemplateRepository templateRepo; @Mock CarrRecordRepository recordRepo;
    @Mock CarrResponsibilityRepository responsibilityRepo; @Mock CarrKpiRepository kpiRepo;
    @Mock CarrRewardRepository rewardRepo; @Mock CarrAuditEventRepository auditRepo;
    @Mock EmployeeRepository employeeRepo; @Mock CompanyRepository companyRepo;
    @Mock com.example.demo.base.repository.JobRoleRepository jobRoleRepo;
    @Mock com.example.demo.pms.repository.PerformanceCycleRepository cycleRepo;
    @Mock CarrKpiEngine engine; @Mock CarrWorkflowNotifier workflowNotifier; @InjectMocks CarrService service;
    @Mock CarrSettingsService settings;
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    final List<CarrResponsibility> responsibilities=new ArrayList<>();
    final List<CarrKpi> kpis=new ArrayList<>();
    final Map<Long,Employee> staff=new HashMap<>();
    CarrRecord saved;
    Authentication auth(long userId,String role){var user=new User();user.setId(userId);user.setEmail("qa"+userId+"@example.invalid");return new TestingAuthenticationToken(new UserPrincipal(user),null,"ROLE_"+role);}
    @BeforeEach void setup(){
        when(settings.forCompany(anyLong())).thenReturn(new CarrSettingsService.View(65L,"Quarterly",null));
        CompanyContext.set(65L);var company=new Company();company.setId(65L);
        var employee=new Employee();employee.setId(101L);employee.setCompany(company);employee.setFirstName("Alex QA");
        var position=new JobPosition();position.setName("Developer");employee.setJobPosition(position);
        var manager=new Employee();manager.setId(102L);manager.setCompany(company);manager.setFirstName("Morgan QA");employee.setReportingManager(manager);
        var unrelated=new Employee();unrelated.setId(103L);unrelated.setCompany(company);
        staff.put(101L,employee);staff.put(102L,manager);staff.put(103L,unrelated);
        when(companyRepo.findByIdPublic(65L)).thenReturn(Optional.of(company));
        when(employeeRepo.findById(anyLong())).thenAnswer(call->Optional.ofNullable(staff.get(call.getArgument(0))));
        when(employeeRepo.findByUserId(anyLong())).thenAnswer(call->{long id=call.getArgument(0);return Optional.ofNullable(staff.get(id==1?101L:id==2?102L:103L));});
        when(recordRepo.save(any())).thenAnswer(call->{saved=call.getArgument(0);saved.setId(1L);return saved;});
        when(recordRepo.findForUpdate(eq(1L),eq(65L))).thenAnswer(call->Optional.ofNullable(saved));
        when(responsibilityRepo.save(any())).thenAnswer(call->{var row=(CarrResponsibility)call.getArgument(0);row.setId((long)responsibilities.size()+1);responsibilities.add(row);return row;});
        when(responsibilityRepo.findByCarrIdOrderById(1L)).thenAnswer(call->List.copyOf(responsibilities));
        when(kpiRepo.save(any())).thenAnswer(call->{var row=(CarrKpi)call.getArgument(0);if(row.getId()==null){row.setId(500L);kpis.add(row);}return row;});
        when(kpiRepo.findByCarrIdOrderById(1L)).thenAnswer(call->List.copyOf(kpis));
        when(kpiRepo.findById(500L)).thenAnswer(call->kpis.stream().findFirst());
    }
    @AfterEach void clear(){CompanyContext.clear();}
    RecordRequest request() throws Exception {return json.readValue("""
      {"employeeId":101,"managerId":102,"title":"Software Delivery Specialist","effectiveFrom":"2026-11-01","effectiveTo":"2026-11-30",
       "responsibilities":[{"statement":"Deliver accepted features","weight":100}],
       "kpis":[{"name":"Accepted features by due date","targetValue":100,"actualValue":null,"unit":"%","weight":100,"dueDate":"2026-11-30","dataSource":"MANUAL","metricDefinition":"Manager accepted features delivered by due date / features due x 100"}],"rewards":[]}
      """,RecordRequest.class);}
    @Test void createSubmitManagerApproveEmployeeAcknowledgeAndRecordVerifiedActual() throws Exception {
        var created=service.create(request(),auth(3,"SUPER_ADMIN"));
        assertEquals(CarrStatus.DRAFT,created.status());assertEquals("Software Delivery Specialist",created.title());assertNull(created.resultScore());
        assertEquals(CarrStatus.SUBMITTED,service.transition(1L,new TransitionRequest(CarrStatus.SUBMITTED,"Ready"),auth(3,"SUPER_ADMIN")).status());
        // Being the assigned reporting manager is sufficient; no fake MANAGER security role is needed.
        assertEquals(CarrStatus.ACKNOWLEDGEMENT_PENDING,service.approve(1L,auth(2,"EMPLOYEE")).status());
        assertThrows(ResponseStatusException.class,()->service.acknowledge(1L,auth(2,"EMPLOYEE")));
        var published=service.acknowledge(1L,auth(1,"EMPLOYEE"));assertEquals(CarrStatus.PUBLISHED,published.status());assertNotNull(published.employeeAcknowledgedAt());
        var measured=service.updateActual(1L,500L,new ActualValueRequest(new BigDecimal("95"),"QA acceptance log with dated deliverables"),auth(2,"EMPLOYEE"));
        assertEquals(0,measured.resultScore().compareTo(new BigDecimal("95")));
        var reviewed=service.completeReview(1L,new ReviewRequest("Reviewed outcomes","Verified delivery log",LocalDate.of(2026,12,1)),auth(2,"EMPLOYEE"));
        assertNotNull(reviewed.reviewCompletedAt());
    }
    @Test void unrelatedEmployeeAndOwnerCannotApproveAndCrossCompanyCannotRead() throws Exception {
        service.create(request(),auth(3,"SUPER_ADMIN"));service.transition(1L,new TransitionRequest(CarrStatus.SUBMITTED,"Ready"),auth(3,"SUPER_ADMIN"));
        assertThrows(ResponseStatusException.class,()->service.approve(1L,auth(1,"EMPLOYEE")));
        assertThrows(ResponseStatusException.class,()->service.approve(1L,auth(3,"EMPLOYEE")));
        CompanyContext.set(99L);
        assertThrows(com.example.demo.common.exception.ResourceNotFoundException.class,()->service.approve(1L,auth(2,"EMPLOYEE")));
        assertEquals(CarrStatus.SUBMITTED,saved.getStatus());
    }
    @Test void managerCanReturnWithReasonThenAdministratorCanResubmit() throws Exception {
        service.create(request(),auth(3,"SUPER_ADMIN"));service.transition(1L,new TransitionRequest(CarrStatus.SUBMITTED,"Ready"),auth(3,"SUPER_ADMIN"));
        var returned=service.requestChanges(1L,new ChangeRequest("Clarify acceptance evidence"),auth(2,"EMPLOYEE"));
        assertEquals(CarrStatus.RETURNED,returned.status());assertEquals("Clarify acceptance evidence",returned.returnReason());
        assertEquals(CarrStatus.SUBMITTED,service.transition(1L,new TransitionRequest(CarrStatus.SUBMITTED,"Clarified"),auth(3,"SUPER_ADMIN")).status());
    }
    @Test void archivedCannotBypassEmployeeAcknowledgementAndAdminCannotApproveOwnCar() throws Exception {
        service.create(request(),auth(3,"SUPER_ADMIN"));saved.setStatus(CarrStatus.ARCHIVED);
        assertThrows(ResponseStatusException.class,()->service.transition(1L,new TransitionRequest(CarrStatus.PUBLISHED,"Bypass"),auth(3,"SUPER_ADMIN")));
        var user=new User();user.setId(1L);saved.getEmployee().setUser(user);saved.setStatus(CarrStatus.SUBMITTED);
        assertThrows(ResponseStatusException.class,()->service.approve(1L,auth(1,"SUPER_ADMIN")));
        saved.setStatus(CarrStatus.APPROVED);
        assertThrows(ResponseStatusException.class,()->service.updateActual(1L,500L,new ActualValueRequest(new BigDecimal("95"),"Evidence"),auth(2,"EMPLOYEE")));
    }
    @Test void completingReviewSchedulesNextReviewFromCompanyFrequency() throws Exception {
        service.create(request(),auth(3,"SUPER_ADMIN"));saved.setStatus(CarrStatus.PUBLISHED);
        var result=service.completeReview(1L,new ReviewRequest(null,"Reviewed",null),auth(2,"EMPLOYEE"));
        assertEquals(CarrWorkflowNotifier.today().plusMonths(3),result.nextReviewDate());
    }
}
