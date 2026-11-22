package com.example.demo.carr.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.*;
import com.example.demo.base.repository.*;
import com.example.demo.carr.dto.CarrCreationDtos.*;
import com.example.demo.carr.entity.CarrRoleTemplate;
import com.example.demo.carr.repository.CarrRoleTemplateRepository;
import com.example.demo.common.context.CompanyContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CarrCreationServiceTest {
    final EmployeeRepository employees=mock(EmployeeRepository.class);
    final DepartmentRepository departments=mock(DepartmentRepository.class);
    final CompanyRepository companies=mock(CompanyRepository.class);
    final CarrRoleTemplateRepository templates=mock(CarrRoleTemplateRepository.class);
    final CarrJobTitleCatalog catalog=mock(CarrJobTitleCatalog.class);
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    final CarrAssignmentPolicy assignmentPolicy=mock(CarrAssignmentPolicy.class);
    final CarrSettingsService settings=mock(CarrSettingsService.class);
    final CarrCreationService service=new CarrCreationService(employees,departments,companies,templates,catalog,json,assignmentPolicy,settings);
    Company company=new Company();
    @BeforeEach void setup(){CompanyContext.set(65L);company.setId(65L);when(companies.findByIdPublic(65L)).thenReturn(Optional.of(company));when(settings.forCompany(65L)).thenReturn(new CarrSettingsService.View(65L,"Quarterly",null));when(assignmentPolicy.forEmployee(any())).thenReturn(new CarrAssignmentPolicy.Dates(null,null,false));}
    @AfterEach void clear(){CompanyContext.clear();com.example.demo.common.context.AccessScopeContext.clear();}
    Authentication auth(String role){var u=new User();u.setId(1L);return new TestingAuthenticationToken(new UserPrincipal(u),null,"ROLE_"+role);}
    RoleDefinition definition() throws Exception{return json.readValue("""
        {"title":"Senior Medical Underwriter","purpose":"Assess medical risk","responsibilities":[{"statement":"Review agreed proposals","weight":100}],"kpis":[],"rewards":[]}
        """,RoleDefinition.class);}
    @Test void futureHireDraftPersistsWithoutCreatingOrLookingUpEmployee() throws Exception {
        when(templates.save(any())).thenAnswer(invocation->{CarrRoleTemplate t=invocation.getArgument(0);t.setId(8L);return t;});
        var saved=service.save(null,definition(),auth("SUPER_ADMIN"));
        assertEquals(8L,saved.id());assertEquals("Senior Medical Underwriter",saved.definition().title());
        verifyNoInteractions(employees);verify(templates).save(argThat(t->t.getCompany().getId().equals(65L)&&t.getDraftContent().contains("Review agreed proposals")));
    }
    @Test void normalEmployeesCannotManageRoleDraftsOrSeeEmployeePicker() {
        var context=service.context(auth("EMPLOYEE"));assertFalse(context.canManage());assertTrue(context.employees().isEmpty());assertTrue(context.jobTitles().isEmpty());
        assertThrows(ResponseStatusException.class,()->service.drafts(auth("EMPLOYEE")));
        verify(employees,never()).findByCompanyIdAndIsActiveTrue(any());
    }
    @Test void employeeCatalogIsMinimalAndOnlyActiveSelectedCompany() {
        var employee=new Employee();employee.setId(2L);employee.setFirstName("Test");employee.setLastName("Employee");employee.setCompany(company);
        var inactive=new Employee();inactive.setActive(false);inactive.setCompany(company);
        var foreign=new Employee();var other=new Company();other.setId(99L);foreign.setCompany(other);
        when(employees.findByCompanyIdAndIsActiveTrue(65L)).thenReturn(List.of(employee,inactive,foreign));
        var context=service.context(auth("COMPANY_ADMIN"));assertTrue(context.canManage());assertEquals(1,context.employees().size());
        assertEquals("Test Employee",context.employees().getFirst().fullName());assertNull(context.employees().getFirst().jobPositionName());
    }
    @Test void foreignRoleDraftAndDepartmentCannotBeUpdated() throws Exception {
        assertThrows(ResponseStatusException.class,()->service.save(999L,definition(),auth("SUPER_ADMIN")));
        var request=json.readValue(json.writeValueAsString(definition()).replace("\"departmentId\":null","\"departmentId\":999"),RoleDefinition.class);
        assertThrows(ResponseStatusException.class,()->service.save(null,request,auth("SUPER_ADMIN")));
        verify(templates,never()).save(any());
    }
    @Test void suggestionsHaveDefinedDeadlinesWeightsAndNoFabricatedActuals() {
        var request=new RoleSuggestion("Developer",List.of("Deliver accepted features","Resolve verified defects"),LocalDate.of(2026,11,1),LocalDate.of(2026,11,30));
        var kpis=service.suggest(request,auth("HR_MANAGER"));assertEquals(100,kpis.stream().mapToInt(k->k.weight()).sum());
        assertTrue(kpis.stream().allMatch(k->k.actualValue()==null&&k.dataSource().equals("MANUAL")&&k.dueDate().equals(request.effectiveTo())&&k.metricDefinition().contains("acceptance evidence")));
        verifyNoInteractions(employees);
    }
    @Test void commonCatalogueContainsBusinessDesignationsWithoutAddingHrOrAccessRoles() {
        assertTrue(CarrJobTitleCatalog.commonTitles().stream().anyMatch(e->e.name().equals("Senior Medical Underwriter")));
        assertTrue(CarrJobTitleCatalog.commonTitles().size()>40);
    }
}
