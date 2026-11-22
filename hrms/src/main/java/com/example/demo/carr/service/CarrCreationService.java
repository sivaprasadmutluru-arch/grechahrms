package com.example.demo.carr.service;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.repository.DepartmentRepository;
import com.example.demo.carr.dto.CarrCreationDtos.*;
import com.example.demo.carr.dto.CarrDtos.*;
import com.example.demo.carr.entity.*;
import com.example.demo.carr.repository.CarrRoleTemplateRepository;
import com.example.demo.common.context.CompanyContext;
import com.example.demo.common.context.AccessScopeContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.base.repository.CompanyRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class CarrCreationService {
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final CompanyRepository companies;
    private final CarrRoleTemplateRepository templates;
    private final CarrJobTitleCatalog catalog;
    private final ObjectMapper json;
    private final CarrAssignmentPolicy assignmentPolicy;
    private final CarrSettingsService settings;
    private Long companyId() {
        var scope=AccessScopeContext.get();
        Long id=scope!=null&&scope.getFilterCompanyId()!=null?scope.getFilterCompanyId():CompanyContext.get();
        if(id==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select one company before creating a CAR");
        if(scope!=null&&!scope.canAccess(id))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Company is outside your access");
        return id;
    }
    public static boolean canManage(Authentication auth) {
        return auth!=null&&auth.isAuthenticated()&&auth.getAuthorities().stream().anyMatch(a->Set.of(
            "ROLE_PLATFORM_SUPER_ADMIN","ROLE_SUPER_ADMIN","ROLE_ACCOUNT_MANAGER","ROLE_COMPANY_ADMIN","ROLE_CEO",
            "ROLE_ENTERPRISE_ADMIN","ROLE_COMPANY_MANAGER","ROLE_BRANCH_ADMIN","ROLE_HR_MANAGER").contains(a.getAuthority()));
    }
    private void requireManager(Authentication auth) {
        companyId();
        if(!canManage(auth))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only company HR administrators can create role CARs");
    }
    private String name(Employee e){return e==null?"":(Objects.toString(e.getFirstName(),"")+" "+Objects.toString(e.getLastName(),"")).trim();}
    public Context context(Authentication auth) {
        Long company=companyId(); boolean manage=canManage(auth);
        var self=employees.findByUserId(((UserPrincipal)auth.getPrincipal()).getId())
                .filter(e->e.isActive()&&e.getCompany()!=null&&company.equals(e.getCompany().getId())).orElse(null);
        List<EmployeeOption> staff=manage?employees.findByCompanyIdAndIsActiveTrue(company).stream()
                .filter(e->e.isActive()&&e.getCompany()!=null&&company.equals(e.getCompany().getId()))
                .map(e->{var dates=assignmentPolicy.forEmployee(e);return new EmployeeOption(e.getId(),name(e),e.getBadgeId(),e.getDepartment()==null?null:e.getDepartment().getId(),
                    e.getDepartment()==null?null:e.getDepartment().getName(),e.getJobPosition()==null?null:e.getJobPosition().getName(),
                    e.getReportingManager()==null?null:e.getReportingManager().getId(),name(e.getReportingManager()),dates.joiningDate(),dates.probationEndsOn(),dates.probationCovered());})
                .sorted(Comparator.comparing(EmployeeOption::fullName,String.CASE_INSENSITIVE_ORDER)).toList():List.of();
        return new Context(company,manage,self==null?null:self.getId(),staff,
                manage?departments.findByCompanyIdAndIsActiveTrue(company).stream().map(d->new DepartmentOption(d.getId(),d.getName())).toList():List.of(),
                manage?catalog.list(company):List.of(),settings.forCompany(company).reviewFrequency());
    }
    public List<RoleDraft> drafts(Authentication auth) {
        requireManager(auth);
        return templates.findByCompanyIdAndIsActiveTrueOrderByTitle(companyId()).stream().filter(t->t.getDraftContent()!=null)
                .map(this::view).toList();
    }
    private RoleDraft view(CarrRoleTemplate t) {
        try{return new RoleDraft(t.getId(),t.getTitle(),t.getVersion(),json.readValue(t.getDraftContent(),RoleDefinition.class));}
        catch(JsonProcessingException ex){throw new IllegalStateException("Unable to read saved role CAR #"+t.getId(),ex);}
    }
    @Transactional
    public RoleDraft save(Long id,RoleDefinition request,Authentication auth) {
        requireManager(auth); Long company=companyId();
        if(request.departmentId()!=null&&!departments.findById(request.departmentId()).filter(d->d.isActive()&&d.getCompany()!=null&&company.equals(d.getCompany().getId())).isPresent())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a department in the selected company");
        if(request.effectiveFrom()!=null&&request.effectiveTo()!=null&&request.effectiveTo().isBefore(request.effectiveFrom()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review end date cannot precede start date");
        if(!request.kpis().isEmpty()&&request.kpis().stream().mapToInt(KpiRequest::weight).sum()!=100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"KPI weights must total 100%");
        for(var k:request.kpis()) {
            if(k.id()!=null||k.actualValue()!=null||k.dataSource()!=null&&!k.dataSource().equals("MANUAL"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Role drafts cannot contain employee results or employee-bound KPI sources");
            if(k.metricDefinition()==null||k.metricDefinition().isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Each KPI needs a measurement rule");
            if(request.effectiveFrom()==null||request.effectiveTo()==null||k.dueDate()!=null&&(k.dueDate().isBefore(request.effectiveFrom())||k.dueDate().isAfter(request.effectiveTo())))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Set a valid review period and KPI deadline");
        }
        if(request.responsibilities().stream().anyMatch(r->r.accountableEmployeeId()!=null||r.id()!=null))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Assign an employee only when converting this role draft to an employee CAR");
        var draft=id==null?new CarrRoleTemplate():templates.findByIdAndCompanyId(id,company).filter(t->t.isActive()&&t.getDraftContent()!=null)
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Role draft not found in selected company"));
        if(id==null)draft.setCompany(companies.findByIdPublic(company).orElseThrow());else draft.setVersion(draft.getVersion()+1);
        draft.setTitle(request.title().trim());draft.setPurpose(request.purpose());
        draft.setScope(request.responsibilities().stream().map(ResponsibilityRequest::statement).reduce((a,b)->a+"\n"+b).orElse(""));
        try{draft.setDraftContent(json.writeValueAsString(request));}catch(JsonProcessingException ex){throw new IllegalArgumentException("Unable to save role definition",ex);}
        return view(templates.save(draft));
    }
    public List<KpiRequest> suggest(RoleSuggestion request,Authentication auth) {
        requireManager(auth);
        if(request.effectiveTo().isBefore(request.effectiveFrom()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review end date cannot precede start date");
        // Reuse explicit company role targets when present; never copy employee actuals or bound task IDs.
        for(var template:templates.findByCompanyIdAndIsActiveTrueOrderByTitle(companyId())){
            if(template.getDraftContent()==null||!request.title().trim().equalsIgnoreCase(template.getTitle()))continue;
            var saved=view(template).definition().kpis();
            if(saved!=null&&!saved.isEmpty()&&saved.stream().mapToInt(KpiRequest::weight).sum()==100)
                return saved.stream().map(k->new KpiRequest(null,k.name(),k.type(),k.direction(),k.targetValue(),null,k.unit(),k.weight(),request.effectiveTo(),"MANUAL",null,k.reviewFrequency(),k.metricDefinition(),k.generationKey(),false,
                        "Saved company role target; confirm applicability to this review period. No previous employee result is copied.")).toList();
        }
        return CarrRoleKpiSuggestions.suggest(request,settings.forCompany(companyId()).reviewFrequency());
    }
}
