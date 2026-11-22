package com.example.demo.carr.service;

import com.example.demo.auth.entity.*;
import com.example.demo.auth.entity.Role;
import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.*;
import com.example.demo.carr.controller.*;
import com.example.demo.carr.entity.*;
import com.example.demo.common.interceptor.AccessScopeInterceptor;
import com.example.demo.employee.entity.Employee;
import com.example.demo.notification.service.NotificationService;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.config.annotation.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Opt-in real PostgreSQL + MVC + method security + production company-scope interceptor.
 * Uses only a disposable, loopback-only carr_qa database, never any application database.
 */
@EnabledIfEnvironmentVariable(named="CARR_POSTGRES_QA",matches="true")
@SpringBootTest(classes=CarrPostgresHttpTest.App.class,properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:55439/carr_qa",
    "spring.datasource.username=carr_qa","spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop","spring.jpa.open-in-view=false",
    "spring.datasource.hikari.minimum-idle=1","spring.datasource.hikari.maximum-pool-size=4",
    "app.jwt.secret=local-only-carr-qa-secret-not-for-any-deployment-20261119"})
@AutoConfigureMockMvc
class CarrPostgresHttpTest {
    @Configuration @EnableAutoConfiguration @EnableMethodSecurity
    @EntityScan("com.example.demo") @EnableJpaRepositories("com.example.demo")
    @Import({CarrController.class,CarrCreationController.class,CarrService.class,CarrCreationService.class,
        CarrJobTitleCatalog.class,CarrSalaryBenchmarkService.class,CarrKpiEngine.class,
        CarrWorkflowNotifier.class,NotificationService.class,AccessScopeInterceptor.class,CarrSettingsService.class,CarrSettingsController.class,
        CarrAssignmentPolicy.class,com.example.demo.onboarding.service.ProbationEligibility.class})
    static class App {
        @Bean SecurityFilterChain security(HttpSecurity http)throws Exception{return http.csrf(c->c.disable()).authorizeHttpRequests(a->a.anyRequest().authenticated()).build();}
        @Bean WebMvcConfigurer companyScope(AccessScopeInterceptor interceptor){return new WebMvcConfigurer(){public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(interceptor).addPathPatterns("/api/**");}};}
    }
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired EntityManager em;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired CarrWorkflowNotifier notifier;
    User admin,owner,manager,stranger; Long company,otherCompany,employee,managerEmployee;
    UsernamePasswordAuthenticationToken as(User user){var p=new UserPrincipal(user);return new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities());}
    User user(String name,Company c,Role role){var u=new User();u.setUsername(name);u.setEmail(name+"@example.invalid");u.setPassword("not-a-login-password");em.persist(u);var assignment=new UserRole();assignment.setUser(u);assignment.setCompany(c);assignment.setRole(role);assignment.setAccessScope(role.getName()==Role.RoleName.COMPANY_ADMIN?UserRole.AccessScope.BRANCH:UserRole.AccessScope.SELF);assignment.setAssignmentReason("Local isolated integration test");em.persist(assignment);u.getUserRoles().add(assignment);return u;}
    Employee employee(String name,User u,Company c,JobPosition position){var e=new Employee();e.setFirstName(name);e.setUser(u);e.setCompany(c);e.setJobPosition(position);em.persist(e);return e;}
    @BeforeEach void seed(){new TransactionTemplate(transactions).executeWithoutResult(tx->{
        var a=new Company();a.setName("CAR QA "+UUID.randomUUID());a.setSchemaName("public");em.persist(a);company=a.getId();
        var b=new Company();b.setName("Other CAR QA "+UUID.randomUUID());em.persist(b);otherCompany=b.getId();
        var hr=new Role();hr.setName(Role.RoleName.COMPANY_ADMIN);em.persist(hr);var staff=new Role();staff.setName(Role.RoleName.EMPLOYEE);em.persist(staff);
        admin=user("qa-admin",a,hr);owner=user("qa-owner",a,staff);manager=user("qa-manager",a,staff);stranger=user("qa-stranger",a,staff);
        var department=new Department();department.setName("Engineering");department.setCompany(a);em.persist(department);
        var position=new JobPosition();position.setName("Developer");position.setCompany(a);position.setDepartment(department);em.persist(position);
        var lead=employee("Manager",manager,a,position);managerEmployee=lead.getId();var person=employee("Owner",owner,a,position);person.setReportingManager(lead);employee=person.getId();employee("Stranger",stranger,a,position);
        // The administrator's unrelated role must not grant access to company B.
        em.flush();
    });}
    JsonNode call(User user,Long selected,String method,String path,Object body,int expected)throws Exception{
        var req=switch(method){case "POST"->post(path);case "PUT"->put(path);case "PATCH"->patch(path);default->get(path);};
        req.with(authentication(as(user))).header("X-Company-Id",selected).contentType("application/json");if(body!=null)req.content(json.writeValueAsString(body));
        var result=mvc.perform(req).andReturn();assertEquals(expected,result.getResponse().getStatus(),result.getResponse().getContentAsString());
        String text=result.getResponse().getContentAsString();return text.isBlank()?json.nullNode():json.readTree(text);
    }
    Map<String,Object> document(){return Map.of("employeeId",employee,"managerId",managerEmployee,"title","Developer","effectiveFrom","2026-11-01","effectiveTo","2026-12-31",
        "responsibilities",List.of(Map.of("statement","Deliver accepted work","weight",100)),
        "kpis",List.of(Map.of("name","Delivery quality","unit","%","targetValue",95,"weight",100,"dataSource","MANUAL","metricDefinition","Accepted items / assessed items x 100")));}
    @Test void realHttpLifecycleRevisionIsolationAndDailyReminderDeduplication()throws Exception{
        assertEquals("Quarterly",call(owner,company,"GET","/api/carr/settings",null,200).path("reviewFrequency").asText());
        call(owner,company,"PUT","/api/carr/settings",Map.of("reviewFrequency","Monthly"),403);
        var settings=call(admin,company,"PUT","/api/carr/settings",Map.of("reviewFrequency","Monthly"),200);assertEquals("Monthly",settings.path("reviewFrequency").asText());
        assertEquals("Monthly",call(admin,company,"GET","/api/carr/settings",null,200).path("reviewFrequency").asText());
        call(admin,company,"PUT","/api/carr/settings",Map.of("reviewFrequency","Yearly"),409);
        call(admin,otherCompany,"GET","/api/carr/settings",null,403);
        var configured=new HashMap<String,Object>(document());configured.put("industry","Software");configured.put("roleLevel","Specialist");configured.put("rewardsEnabled",true);configured.put("rewardsVisibleToEmployee",false);configured.put("rewards",List.of(Map.of("name","Agreed development opportunity","status","TO_BE_DISCUSSED")));
        var created=call(admin,company,"POST","/api/carr/records",configured,201);long id=created.path("id").asLong();assertTrue(created.path("resultScore").isNull());
        assertEquals("2026-12-01",created.path("nextReviewDate").asText());
        var beforePatch=call(admin,company,"GET","/api/carr/records/"+id,null,200);
        var changed=call(admin,company,"PATCH","/api/carr/records/"+id+"/responsibilities",Map.of("responsibilities",List.of(Map.of("id",created.path("responsibilities").get(0).path("id").asLong(),"statement","Updated responsibility only","weight",100))),200);
        assertEquals("Software",changed.path("industry").asText());assertTrue(changed.path("rewardsEnabled").asBoolean());assertEquals(beforePatch.path("rewards"),changed.path("rewards"));assertEquals(beforePatch.path("kpis"),changed.path("kpis"));
        assertEquals(0,call(owner,company,"GET","/api/carr/records/"+id,null,200).path("rewards").size());
        var template=call(admin,company,"POST","/api/carr/templates",Map.of("title","Developer role","scope","Deliver accepted features"),201);long templateId=template.path("id").asLong();
        call(admin,company,"POST","/api/carr/templates/"+templateId+"/assign",Map.of("employeeId",employee,"assignmentType","PROBATION"),400);
        new TransactionTemplate(transactions).executeWithoutResult(tx->{var person=em.find(Employee.class,employee);person.setDateJoining(LocalDate.of(2026,8,1));var policy=new com.example.demo.onboarding.entity.ProbationPolicy();policy.setCompanyId(company);policy.setEnabled(true);policy.setEffectiveFrom(LocalDate.of(2026,1,1));em.persist(policy);});
        var assigned=call(admin,company,"POST","/api/carr/templates/"+templateId+"/assign",Map.of("employeeId",employee,"assignmentType","PROBATION"),200);
        assertEquals("2027-02-01",assigned.path("effectiveTo").asText());assertEquals("2026-09-01",assigned.path("nextReviewDate").asText());
        call(owner,company,"POST","/api/carr/records",document(),403);
        call(admin,otherCompany,"GET","/api/carr/records/"+id,null,403);
        call(stranger,company,"GET","/api/carr/records/"+id,null,403);
        call(admin,company,"POST","/api/carr/records/"+id+"/transition",Map.of("status","SUBMITTED"),200);
        call(owner,company,"POST","/api/carr/records/"+id+"/approve",Map.of(),403);
        call(stranger,company,"POST","/api/carr/records/"+id+"/approve",Map.of(),403);
        new TransactionTemplate(transactions).executeWithoutResult(tx->{
            var assignment=new UserRole();assignment.setUser(em.getReference(User.class,owner.getId()));assignment.setCompany(em.getReference(Company.class,company));assignment.setRole(em.getReference(Role.class,admin.getUserRoles().getFirst().getRole().getId()));assignment.setAccessScope(UserRole.AccessScope.BRANCH);em.persist(assignment);
            // Refresh the detached authentication fixture with exactly the new database grant.
            assignment.setRole(admin.getUserRoles().getFirst().getRole());owner.getUserRoles().add(assignment);
        });
        call(owner,company,"POST","/api/carr/records/"+id+"/approve",Map.of(),403); // admin role does not permit self-approval
        new TransactionTemplate(transactions).executeWithoutResult(tx->{em.createQuery("update UserRole r set r.assignmentStatus=:revoked where r.user.id=:id").setParameter("revoked",UserRole.AssignmentStatus.REVOKED).setParameter("id",stranger.getId()).executeUpdate();});
        call(stranger,company,"GET","/api/carr/records",null,403); // cached principal cannot override revoked company grant
        new TransactionTemplate(transactions).executeWithoutResult(tx->{var row=em.find(CarrRecord.class,id);notifier.remind(row,LocalDate.of(2026,11,19));notifier.remind(row,LocalDate.of(2026,11,19));
            assertEquals(1L,em.createQuery("select count(a) from CarrAuditEvent a where a.carr.id=:id and a.action='WORKFLOW_REMINDER_SENT'",Long.class).setParameter("id",id).getSingleResult());});
        // Assigned reporting manager has EMPLOYEE role, not a manufactured MANAGER role.
        assertEquals("ACKNOWLEDGEMENT_PENDING",call(manager,company,"POST","/api/carr/records/"+id+"/approve",Map.of(),200).path("status").asText());
        call(manager,company,"POST","/api/carr/records/"+id+"/acknowledge",Map.of(),403);
        assertEquals("PUBLISHED",call(owner,company,"POST","/api/carr/records/"+id+"/acknowledge",Map.of(),200).path("status").asText());
        call(admin,company,"PUT","/api/carr/records/"+id,document(),409);
        var revision=call(admin,company,"POST","/api/carr/records/"+id+"/revisions",Map.of(),200);long next=revision.path("id").asLong();
        assertEquals(2,revision.path("version").asInt());assertEquals(id,revision.path("revisionOfId").asLong());assertTrue(revision.path("employeeAcknowledgedAt").isNull());assertTrue(revision.path("kpis").get(0).path("actualValue").isNull());
        call(admin,company,"POST","/api/carr/records/"+id+"/revisions",Map.of(),409);
        assertEquals("PUBLISHED",call(owner,company,"GET","/api/carr/records/"+id,null,200).path("status").asText());
        call(admin,company,"POST","/api/carr/records/"+next+"/transition",Map.of("status","SUBMITTED"),200);
        call(manager,company,"POST","/api/carr/records/"+next+"/approve",Map.of(),200);
        call(owner,company,"POST","/api/carr/records/"+next+"/acknowledge",Map.of(),200);
        assertEquals("ARCHIVED",call(owner,company,"GET","/api/carr/records/"+id,null,200).path("status").asText());
        call(admin,company,"POST","/api/carr/records/"+id+"/transition",Map.of("status","PUBLISHED"),409);
    }
}
