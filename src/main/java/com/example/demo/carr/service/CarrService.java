package com.example.demo.carr.service;

import com.example.demo.auth.security.UserPrincipal;
import com.example.demo.base.entity.*;
import com.example.demo.base.repository.*;
import com.example.demo.carr.dto.CarrDtos.*;
import com.example.demo.carr.entity.*;
import com.example.demo.carr.repository.*;
import com.example.demo.common.context.CompanyContext;
import com.example.demo.common.exception.ResourceNotFoundException;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.pms.entity.PerformanceCycle;
import com.example.demo.pms.repository.PerformanceCycleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.math.*;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class CarrService {
    private final CarrRoleTemplateRepository templateRepo;
    private final CarrRecordRepository recordRepo;
    private final CarrResponsibilityRepository responsibilityRepo;
    private final CarrKpiRepository kpiRepo;
    private final CarrRewardRepository rewardRepo;
    private final CarrAuditEventRepository auditRepo;
    private final EmployeeRepository employeeRepo;
    private final CompanyRepository companyRepo;
    private final JobRoleRepository jobRoleRepo;
    private final DepartmentRepository departmentRepo;
    private final PerformanceCycleRepository cycleRepo;
    private final CarrKpiEngine kpiEngine;
    private final com.fasterxml.jackson.databind.ObjectMapper json;
    private final CarrCreationService carrCreationService;
    private final CarrWorkflowNotifier workflowNotifier;
    private final CarrAssignmentPolicy assignmentPolicy;
    private final CarrSettingsService settings;

    private Long companyId() {
        var scope = com.example.demo.common.context.AccessScopeContext.get();
        Long id = scope != null && scope.getFilterCompanyId() != null ? scope.getFilterCompanyId() : CompanyContext.get();
        if (id == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a company before using CARR");
        if (scope != null && !scope.canAccess(id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Company is outside your access");
        return id;
    }
    private Company company() { return companyRepo.findByIdPublic(companyId()).orElseThrow(() -> new ResourceNotFoundException("Company", companyId())); }
    private Employee employee(Long id) { if(id==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select an employee to assign this CAR; use a role draft for a future hire");return employeeRepo.findById(id).filter(e -> e.isActive() && e.getCompany()!=null && Objects.equals(e.getCompany().getId(), companyId())).orElseThrow(() -> new ResourceNotFoundException("Employee", id)); }
    private String designation(Employee employee) {
        String name = employee.getJobPosition() == null ? null : employee.getJobPosition().getName();
        if (name == null || name.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Set the employee's Job Position in the Employee module before creating a CAR.");
        return name.trim();
    }
    private String name(Employee e) { return ((e.getFirstName()==null?"":e.getFirstName())+" "+(e.getLastName()==null?"":e.getLastName())).trim(); }

    @Transactional(readOnly=true)
    public List<TemplateResponse> templates() { return templateRepo.findByCompanyIdAndIsActiveTrueOrderByTitle(companyId()).stream().map(this::templateDto).toList(); }
    @Transactional
    public TemplateResponse saveTemplate(Long id, TemplateRequest req, Authentication auth) {
        CarrRoleTemplate t = id == null ? new CarrRoleTemplate() : templateRepo.findByIdAndCompanyId(id, companyId()).orElseThrow(() -> new ResourceNotFoundException("CARR template", id));
        if (id == null) t.setCompany(company());
        if (req.jobRoleId() != null) {
            JobRole role = jobRoleRepo.findById(req.jobRoleId()).filter(r -> Objects.equals(r.getCompany().getId(), companyId())).orElseThrow(() -> new ResourceNotFoundException("Job role", req.jobRoleId()));
            t.setJobRole(role);
        } else t.setJobRole(null);
        if (req.departmentId() != null) {
            Department dept = departmentRepo.findById(req.departmentId()).filter(d -> Objects.equals(d.getCompany().getId(), companyId())).orElseThrow(() -> new ResourceNotFoundException("Department", req.departmentId()));
            t.setDepartment(dept);
        } else t.setDepartment(null);
        t.setTitle(req.title().trim());
        t.setReportsToTitle(req.reportsToTitle());
        t.setPurpose(req.purpose());
        t.setScope(req.scope());
        t.setCompetencies(req.competencies());
        t.setTargetAudience(req.targetAudience() != null && !req.targetAudience().isBlank() ? req.targetAudience().trim().toUpperCase() : "BOTH");
        t.setEmploymentType(req.employmentType());
        t.setWorkMode(req.workMode());
        t.setLocation(req.location());
        t.setExperienceMinYears(req.experienceMinYears());
        t.setExperienceMaxYears(req.experienceMaxYears());
        t.setEducationLevel(req.educationLevel());
        t.setRequiredSkills(req.requiredSkills());
        t.setPreferredSkills(req.preferredSkills());
        t.setSalaryMin(req.salaryMin());
        t.setSalaryMax(req.salaryMax());
        t.setSalaryBenchmarkMin(req.salaryBenchmarkMin());
        t.setSalaryBenchmarkMedian(req.salaryBenchmarkMedian());
        t.setSalaryBenchmarkMax(req.salaryBenchmarkMax());
        t.setSalaryCurrency(req.salaryCurrency() != null && !req.salaryCurrency().isBlank() ? req.salaryCurrency() : "AED");
        t.setSalaryFrequency(req.salaryFrequency() != null && !req.salaryFrequency().isBlank() ? req.salaryFrequency() : "MONTHLY");
        t.setShowSalaryPublicly(Boolean.TRUE.equals(req.showSalaryPublicly()));
        t.setBenefitsSummary(req.benefitsSummary());
        t.setVacancyCount(req.vacancyCount() != null && req.vacancyCount() > 0 ? req.vacancyCount() : 1);
        t.setStatus(req.status() != null && !req.status().isBlank() ? req.status().trim().toUpperCase() : "ACTIVE");
        t.setApplicationInstructions(req.applicationInstructions());
        if (req.draftContent() != null) t.setDraftContent(req.draftContent());
        return templateDto(templateRepo.save(t));
    }

    @Transactional
    public void deleteTemplate(Long id, Authentication auth) {
        CarrRoleTemplate t = templateRepo.findByIdAndCompanyId(id, companyId()).orElseThrow(() -> new ResourceNotFoundException("CARR template", id));
        t.setActive(false);
        t.setStatus("ARCHIVED");
        templateRepo.save(t);
    }

    @Transactional
    public RecordResponse assignTemplate(Long templateId, AssignTemplateRequest req, Authentication auth) {
        Long company = companyId();
        CarrRoleTemplate template = templateRepo.findByIdAndCompanyId(templateId, company)
                .orElseThrow(() -> new ResourceNotFoundException("CARR template", templateId));
        Employee emp = employee(req.employeeId());
        if (!Objects.equals(emp.getCompany().getId(), company)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee does not belong to the selected company");
        }

        if(!Set.of("PROBATION","PMS_CYCLE").contains(Objects.toString(req.assignmentType(),"")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose Probation or Performance Cycle");
        var policyDates=assignmentPolicy.forEmployee(emp);
        LocalDate effectiveFrom = req.effectiveFrom() != null ? req.effectiveFrom() : (policyDates.joiningDate()!=null?policyDates.joiningDate():LocalDate.now());
        boolean isProbation = "PROBATION".equals(req.assignmentType());
        LocalDate effectiveTo = req.effectiveTo() != null ? req.effectiveTo() : (isProbation ? policyDates.probationEndsOn() : effectiveFrom.plusMonths(12));
        if(effectiveTo==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"No applicable onboarding probation period; enter an explicit evaluation end date");
        if(effectiveTo.isBefore(effectiveFrom))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Evaluation end date cannot precede its start");
        LocalDate nextReviewDate = req.nextReviewDate() != null ? req.nextReviewDate() : CarrSettingsService.nextReview(effectiveFrom,settings.forCompany(company).reviewFrequency());
        if(nextReviewDate.isAfter(effectiveTo))nextReviewDate=effectiveTo;
        if(nextReviewDate.isBefore(effectiveFrom))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review date cannot precede evaluation start");

        Employee manager = req.managerId() != null ? employee(req.managerId()) : (emp.getReportingManager() != null ? emp.getReportingManager() : null);

        CarrRecord c = new CarrRecord();
        c.setCompany(company());
        c.setEmployee(emp);
        c.setManager(manager);
        c.setTemplate(template);
        c.setTitle(template.getTitle());
        c.setReportsToTitle(template.getReportsToTitle());
        String purposePrefix = isProbation ? "Probation Evaluation & Performance Management: " : "Performance Agreement: ";
        c.setPurpose(purposePrefix + (template.getPurpose() != null && !template.getPurpose().isBlank() ? template.getPurpose() : template.getTitle()));
        c.setEffectiveFrom(effectiveFrom);
        c.setEffectiveTo(effectiveTo);
        c.setNextReviewDate(nextReviewDate);
        c.setStatus(CarrStatus.DRAFT);

        if (req.cycleId() != null) {
            c.setCycle(cycleRepo.findById(req.cycleId()).filter(x -> Objects.equals(x.getCompany().getId(), company)).orElse(null));
        }

        c = recordRepo.save(c);

        List<ResponsibilityRequest> respRequests = new ArrayList<>();
        List<KpiRequest> kpiRequests = new ArrayList<>();

        if (template.getDraftContent() != null && !template.getDraftContent().isBlank()) {
            try {
                com.example.demo.carr.dto.CarrCreationDtos.RoleDefinition def = json.readValue(template.getDraftContent(), com.example.demo.carr.dto.CarrCreationDtos.RoleDefinition.class);
                if (def.responsibilities() != null && !def.responsibilities().isEmpty()) {
                    respRequests.addAll(def.responsibilities());
                }
                if (def.kpis() != null && !def.kpis().isEmpty()) {
                    kpiRequests.addAll(def.kpis());
                }
            } catch (Exception ex) {
                // Ignore json parsing exception and fallback
            }
        }

        if (respRequests.isEmpty() && template.getScope() != null && !template.getScope().isBlank()) {
            List<String> lines = Arrays.stream(template.getScope().split("\\r?\\n"))
                    .map(String::trim).filter(s -> !s.isBlank()).toList();
            int count = lines.size();
            for (int i = 0; i < count; i++) {
                int weight = 100 / count + (i < 100 % count ? 1 : 0);
                respRequests.add(new ResponsibilityRequest(null, lines.get(i), emp.getId(), "HIGH", "Monthly", "Monthly outcome evidence", weight));
            }
        }
        if (respRequests.isEmpty()) {
            respRequests.add(new ResponsibilityRequest(null, "Deliver agreed outcomes for " + template.getTitle(), emp.getId(), "HIGH", "Monthly", "Completion and acceptance evidence", 100));
        }

        for (ResponsibilityRequest r : respRequests) {
            CarrResponsibility x = new CarrResponsibility();
            x.setCarr(c);
            x.setStatement(r.statement().trim());
            x.setAccountableEmployee(emp);
            x.setPriority(r.priority() == null ? "HIGH" : r.priority());
            x.setFrequency(r.frequency() == null ? "Monthly" : r.frequency());
            x.setEvidenceRequired(r.evidenceRequired() == null ? "Deliverable evidence" : r.evidenceRequired());
            x.setWeight(r.weight());
            responsibilityRepo.save(x);
        }

        if (kpiRequests.isEmpty()) {
            List<String> statements = respRequests.stream().map(ResponsibilityRequest::statement).toList();
            var suggestion = new com.example.demo.carr.dto.CarrCreationDtos.RoleSuggestion(template.getTitle(), statements, effectiveFrom, effectiveTo);
            kpiRequests.addAll(carrCreationService.suggest(suggestion, auth));
        }

        replaceKpis(c, kpiRequests);

        if (template.getVacancyCount() > 1) {
            template.setVacancyCount(template.getVacancyCount() - 1);
        } else {
            template.setVacancyCount(0);
            template.setStatus("ASSIGNED");
        }
        templateRepo.save(template);

        audit(c, "ASSIGNED_FROM_EXTERNAL_CAR", "Assigned from external CAR template #" + templateId + " (" + template.getTitle() + ") for " + (isProbation ? "Probation Evaluation" : "Annual PMS"), auth);
        audit(c, "KPI_CONFIGURATION_SAVED", kpiAudit(c), auth);

        return recordDto(c);
    }

    public String extractJobDescription(MultipartFile file) {
        if(file==null||file.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a job description file");
        String name=Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        try {
            if(name.endsWith(".docx")){try(XWPFDocument document=new XWPFDocument(file.getInputStream())){return document.getParagraphs().stream().map(p->p.getText().trim()).filter(s->!s.isBlank()).reduce((a,b)->a+"\n"+b).orElse("");}}
            if(name.endsWith(".txt")||name.endsWith(".md"))return new String(file.getBytes(),StandardCharsets.UTF_8).trim();
        } catch(IOException ex){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unable to read the uploaded job description",ex);}
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload a DOCX, TXT, or Markdown job description");
    }

    @Transactional(readOnly=true)
    public List<RecordResponse> records(Authentication auth) {
        if (canViewCompanyCarr(auth)) return recordRepo.findByCompanyIdOrderByUpdatedAtDesc(companyId()).stream().map(this::recordDto).toList();
        UserPrincipal principal=(UserPrincipal)auth.getPrincipal();
        Employee signedIn=employeeRepo.findByUserId(principal.getId()).filter(e->Objects.equals(e.getCompany().getId(),companyId())).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"No employee profile is linked to this account"));
        var visible = new LinkedHashMap<Long,CarrRecord>();
        recordRepo.findByCompanyIdAndEmployeeIdOrderByUpdatedAtDesc(companyId(),signedIn.getId()).forEach(c->visible.put(c.getId(),c));
        recordRepo.findByCompanyIdAndManagerIdOrderByUpdatedAtDesc(companyId(),signedIn.getId()).forEach(c->visible.put(c.getId(),c));
        return visible.values().stream().map(this::recordDto).toList();
    }
    @Transactional(readOnly=true)
    public RecordResponse record(Long id,Authentication auth) { CarrRecord record=requireRecord(id);ensureCanView(record,auth);return recordDto(record); }

    private boolean canViewCompanyCarr(Authentication auth){return CarrCreationService.canManage(auth);}
    private boolean hasRole(Authentication auth,String role){return auth.getAuthorities().stream().anyMatch(a->role.equals(a.getAuthority()));}
    private void ensureCanView(CarrRecord record,Authentication auth){if(canViewCompanyCarr(auth))return;Employee signedIn=signedInEmployee(auth);if(Objects.equals(record.getEmployee().getId(),signedIn.getId()))return;if(record.getManager()!=null&&Objects.equals(record.getManager().getId(),signedIn.getId()))return;throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You can only view your own or directly assigned team CARR records");}
    private Employee signedInEmployee(Authentication auth){UserPrincipal principal=(UserPrincipal)auth.getPrincipal();return employeeRepo.findByUserId(principal.getId()).filter(e->e.isActive()&&e.getCompany()!=null&&Objects.equals(e.getCompany().getId(),companyId())).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"No active employee profile is linked in the selected company"));}
    private void ensureCanApprove(CarrRecord record,Authentication auth){
        UserPrincipal principal=(UserPrincipal)auth.getPrincipal();
        if(record.getEmployee().getUser()!=null&&Objects.equals(record.getEmployee().getUser().getId(),principal.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You cannot approve or review your own CAR");
        if(canViewCompanyCarr(auth))return;
        Employee signedIn=signedInEmployee(auth);
        if(record.getManager()==null||!Objects.equals(record.getManager().getId(),signedIn.getId())||Objects.equals(record.getEmployee().getId(),signedIn.getId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the assigned manager or HR administrator can review this CARR");
    }

    @Transactional
    public RecordResponse createRevision(Long id,Authentication auth){
        if(!canViewCompanyCarr(auth))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only HR administrators can create CAR revisions");
        CarrRecord source=requireRecord(id);
        if(source.isTaskRecord()||source.getStatus()!=CarrStatus.PUBLISHED)throw new ResponseStatusException(HttpStatus.CONFLICT,"Create a revision from the current published CAR");
        if(recordRepo.existsByCompanyIdAndRevisionOfIdAndStatusNot(companyId(),id,CarrStatus.ARCHIVED))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"A revision already exists; continue editing that draft");
        CarrRecord revision=new CarrRecord();
        org.springframework.beans.BeanUtils.copyProperties(source,revision,"id","createdAt","updatedAt","status","version","revisionOfId","publishedAt","publishedBy","employeeAcknowledgedAt","reviewCompletedAt","employeeReflection","managerComments","returnReason");
        revision.setStatus(CarrStatus.DRAFT);revision.setVersion(source.getVersion()+1);revision.setRevisionOfId(id);
        revision=recordRepo.save(revision);
        for(var old:responsibilityRepo.findByCarrIdOrderById(id)){
            var copy=new CarrResponsibility();org.springframework.beans.BeanUtils.copyProperties(old,copy,"id","createdAt","updatedAt","carr");copy.setCarr(revision);responsibilityRepo.save(copy);
        }
        for(var old:kpiRepo.findByCarrIdOrderById(id)){
            var copy=new CarrKpi();org.springframework.beans.BeanUtils.copyProperties(old,copy,"id","createdAt","updatedAt","carr","actualValue","evidence","trackingStatus");copy.setCarr(revision);kpiRepo.save(copy);
        }
        for(var old:rewardRepo.findByCarrIdOrderById(id)){
            var copy=new CarrReward();org.springframework.beans.BeanUtils.copyProperties(old,copy,"id","createdAt","updatedAt","carr");copy.setCarr(revision);rewardRepo.save(copy);
        }
        audit(revision,"REVISION_CREATED","Revision of CAR #"+id+"; requires fresh approval and employee acknowledgement",auth);
        return recordDto(revision);
    }

    @Transactional
    public RecordResponse create(RecordRequest req, Authentication auth) {
        Employee emp = employee(req.employeeId());
        if (req.cycleId()!=null && recordRepo.existsByCompanyIdAndEmployeeIdAndCycleIdAndStatusNot(companyId(), emp.getId(), req.cycleId(), CarrStatus.ARCHIVED))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This employee already has an active CARR for the selected cycle");
        CarrRecord c = new CarrRecord(); c.setCompany(company()); c.setEmployee(emp); c.setStatus(CarrStatus.DRAFT);
        apply(c, req); c = recordRepo.save(c); replaceChildren(c, req); audit(c,"CREATED","CARR created",auth); audit(c,"KPI_CONFIGURATION_SAVED",kpiAudit(c),auth);
        return recordDto(c);
    }
    @Transactional
    public RecordResponse update(Long id, RecordRequest req, Authentication auth) {
        CarrRecord c=requireRecord(id); ensureEditable(c);
        if(c.getRevisionOfId()!=null&&(!Objects.equals(c.getEmployee().getId(),req.employeeId())||!Objects.equals(c.getCycle()==null?null:c.getCycle().getId(),req.cycleId())))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A revision must keep the original employee and performance cycle");
        apply(c,req); replaceChildren(c,req); audit(c,"UPDATED","Draft content updated",auth); audit(c,"KPI_CONFIGURATION_SAVED",kpiAudit(c),auth); return recordDto(c);
    }
    @Transactional
    public RecordResponse saveKpi(Long carrId, Long kpiId, KpiRequest req, Authentication auth) {
        CarrRecord c = requireRecord(carrId); ensureEditable(c);
        validateKpi(req);
        if(kpiRepo.findByCarrIdOrderById(c.getId()).stream().anyMatch(x->!Objects.equals(x.getId(),kpiId)&&x.getName().trim().equalsIgnoreCase(req.name().trim())))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"A KPI with this name already exists");
        CarrKpi k = kpiId == null ? new CarrKpi() : kpiRepo.findById(kpiId)
                .filter(x -> Objects.equals(x.getCarr().getId(), c.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("CARR KPI", kpiId));
        if (kpiId == null) k.setCarr(c);
        int otherWeight = kpiRepo.findByCarrIdOrderById(c.getId()).stream()
                .filter(x -> !Objects.equals(x.getId(), kpiId)).mapToInt(CarrKpi::getWeight).sum();
        if (otherWeight + req.weight() != 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "KPI weights must total 100. Save the complete configuration to rebalance weights.");
        applyKpi(k,req); kpiRepo.save(k);
        audit(c, kpiId==null?"KPI_CREATED":"KPI_UPDATED", k.getName(), auth);
        return recordDto(c);
    }
    @Transactional
    public RecordResponse updateResponsibilities(Long id,ResponsibilitiesChange req,Authentication auth){
        if(!canViewCompanyCarr(auth))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only company HR administrators can edit responsibilities");
        CarrRecord c=requireRecord(id);ensureEditable(c);
        var old=responsibilityRepo.findByCarrIdOrderById(id);Set<Long> kept=new HashSet<>();
        for(var r:req.responsibilities()){
            CarrResponsibility row=r.id()==null?new CarrResponsibility():old.stream().filter(x->x.getId().equals(r.id())).findFirst().orElseThrow(()->new ResourceNotFoundException("CARR responsibility",r.id()));
            if(r.id()!=null&&!kept.add(r.id()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Duplicate responsibility identifier");
            row.setCarr(c);row.setStatement(r.statement().trim());row.setAccountableEmployee(r.accountableEmployeeId()==null?c.getEmployee():employee(r.accountableEmployeeId()));
            row.setPriority(r.priority()==null?"MEDIUM":r.priority());row.setFrequency(r.frequency());row.setEvidenceRequired(r.evidenceRequired());row.setWeight(r.weight());responsibilityRepo.save(row);
        }
        responsibilityRepo.deleteAll(old.stream().filter(x->!kept.contains(x.getId())).toList());
        audit(c,"RESPONSIBILITIES_UPDATED","Updated responsibilities without changing CAR configuration, KPIs or rewards",auth);return recordDto(c);
    }
    @Transactional
    public void deleteKpi(Long carrId, Long kpiId, Authentication auth) {
        CarrRecord c = requireRecord(carrId); ensureEditable(c);
        CarrKpi k = kpiRepo.findById(kpiId).filter(x -> Objects.equals(x.getCarr().getId(), c.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("CARR KPI", kpiId));
        if(kpiRepo.findByCarrIdOrderById(c.getId()).size()>1)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Remove the KPI in the full configuration and rebalance the remaining weights to 100%");
        String name = k.getName(); kpiRepo.delete(k); audit(c,"KPI_DELETED",name,auth);
    }
    @Transactional(readOnly=true)
    public List<KpiRequest> suggestKpis(KpiSuggestionRequest req) {
        if(req.effectiveFrom()==null||req.effectiveTo()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose the KPI review start date and deadline before generating KPIs");
        Employee emp=employee(req.employeeId());
        designation(emp);
        if(req.departmentId()!=null && (emp.getDepartment()==null || !req.departmentId().equals(emp.getDepartment().getId())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Employee does not belong to the selected department");
        if(req.effectiveFrom()!=null && req.effectiveTo()!=null && req.effectiveTo().isBefore(req.effectiveFrom()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review end date cannot be before start date");
        String context="";
        if(req.templateId()!=null){
            CarrRoleTemplate t=templateRepo.findByIdAndCompanyId(req.templateId(),companyId()).orElseThrow(()->new ResourceNotFoundException("CARR template",req.templateId()));
            context=Objects.toString(t.getScope(),"")+" "+Objects.toString(t.getCompetencies(),"");
        }
        return kpiEngine.suggest(emp,req,context);
    }
    @Transactional
    public RecordResponse configureKpis(Long id,KpiConfigurationRequest req,Authentication auth) {
        CarrRecord c=requireRecord(id);ensureEditable(c);
        if(req.effectiveTo().isBefore(req.effectiveFrom()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Review end date cannot be before start date");
        c.setEffectiveFrom(req.effectiveFrom());c.setEffectiveTo(req.effectiveTo());if(req.nextReviewDate()!=null)c.setNextReviewDate(req.nextReviewDate());
        replaceKpis(c,req.kpis());
        audit(c,"KPI_CONFIGURATION_SAVED",kpiAudit(c),auth);
        return recordDto(c);
    }
    @Transactional
    public RecordResponse refreshKpiActuals(Long id,Authentication auth) {
        CarrRecord c=requireRecord(id);ensureCanApprove(c,auth);
        if(c.getStatus()==CarrStatus.ARCHIVED) throw new ResponseStatusException(HttpStatus.CONFLICT,"Archived KPI scores cannot be changed");
        for(CarrKpi k:kpiRepo.findByCarrIdOrderById(c.getId())) {
            if(!CarrKpiEngine.isAutomatic(k.getDataSource())) continue;
            var m=kpiEngine.measure(c.getEmployee(),k.getDataSource(),c.getEffectiveFrom(),measurementEnd(c,k));
            k.setActualValue(m.actual());k.setEvidence(m.evidence());kpiRepo.save(k);
        }
        audit(c,"KPI_SCORES_REFRESHED",kpiAudit(c),auth);
        return recordDto(c);
    }
    private String kpiAudit(CarrRecord c) {
        String value=kpiRepo.findByCarrIdOrderById(c.getId()).stream().map(k->"#"+k.getId()+" "+k.getName()+": metric="+k.getMetricDefinition()+", direction="+k.getDirection()+", target="+k.getTargetValue()+" "+k.getUnit()+", actual="+k.getActualValue()+", weight="+k.getWeight()+", cycle="+k.getReviewFrequency()+", score="+KpiScoring.score(k)+", source="+k.getDataSource()+", evidence="+k.getEvidence()).reduce((a,b)->a+"; "+b).orElse("No KPIs");
        return "Employee #"+c.getEmployee().getId()+"; period "+c.getEffectiveFrom()+" to "+c.getEffectiveTo()+"; "+value;
    }
    private void validateKpi(KpiRequest k) {
        if(k.name()==null||k.name().isBlank()||k.targetValue()==null||k.targetValue().signum()<=0||k.unit()==null||k.unit().isBlank()||k.weight()<1||k.weight()>100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Every KPI needs a name, positive target, unit and weight from 1 to 100");
        if(k.metricDefinition()==null||k.metricDefinition().isBlank()||k.metricDefinition().toLowerCase(Locale.ROOT).contains("configure "))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Define the measurement rule and required SLA, quota or acceptance parameters before saving");
        if(CarrKpiEngine.isAutomatic(k.dataSource()) && k.targetValue().compareTo(BigDecimal.valueOf(100))>0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Automatic completion-rate targets cannot exceed 100%");
        if(k.dataSource()!=null && k.dataSource().matches("(CARR_TASK|PMS_OBJECTIVE|PROJECT_TASK):.*") && !CarrKpiEngine.isAutomatic(k.dataSource()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid linked KPI data source");
        if(k.reviewFrequency()!=null&&!Set.of("Monthly","Quarterly","Annually","Yearly","Half-Yearly").contains(k.reviewFrequency()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid KPI review cycle");
        if(k.actualValue()!=null&&k.actualValue().signum()<0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Actual values cannot be negative");
        if(k.actualValue()!=null&&!CarrKpiEngine.isAutomatic(k.dataSource())&&(k.evidence()==null||k.evidence().isBlank()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Provide source evidence for manual actuals");
        if(CarrKpiEngine.isAutomatic(k.dataSource()) && (!"%".equals(k.unit()) || (k.direction()!=null&&k.direction()!=CarrKpi.Direction.INCREASE)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Automatic rate metrics must use % and higher-is-better scoring");
    }
    private void applyKpi(CarrKpi k,KpiRequest req) {
        validateKpi(req);
        k.setName(req.name().trim());k.setType(req.type()==null?CarrKpi.Type.KPI:req.type());k.setDirection(req.direction()==null?CarrKpi.Direction.INCREASE:req.direction());
        k.setTargetValue(req.targetValue());k.setUnit(req.unit().trim());k.setWeight(req.weight());k.setReviewFrequency(req.reviewFrequency()==null?"Monthly":req.reviewFrequency());
        LocalDate deadline=req.dueDate()==null?k.getCarr().getEffectiveTo():req.dueDate();
        if(deadline==null||k.getCarr().getEffectiveFrom()==null||deadline.isBefore(k.getCarr().getEffectiveFrom())||k.getCarr().getEffectiveTo()!=null&&deadline.isAfter(k.getCarr().getEffectiveTo()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"KPI deadline must fall within the review period");
        k.setDueDate(deadline);k.setDescription(req.description()==null?req.name():req.description());k.setMetricDefinition(req.metricDefinition());k.setGenerationKey(req.generationKey());
        k.setManuallyEdited(k.isManuallyEdited()||Boolean.TRUE.equals(req.manuallyEdited())||req.generationKey()==null);
        k.setDataSource(req.dataSource()==null?"MANUAL":req.dataSource());
        if(CarrKpiEngine.isAutomatic(k.getDataSource())) {
            kpiEngine.validateSource(k.getCarr().getEmployee(),k.getDataSource());
            var m=kpiEngine.measure(k.getCarr().getEmployee(),k.getDataSource(),k.getCarr().getEffectiveFrom(),measurementEnd(k.getCarr(),k));
            k.setActualValue(m.actual());k.setEvidence(m.evidence());
        } else {k.setActualValue(req.actualValue());k.setEvidence(req.evidence());}
    }
    private void replaceKpis(CarrRecord c,List<KpiRequest> requested) {
        if(!requested.isEmpty()&&(c.getEffectiveFrom()==null||c.getEffectiveTo()==null))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose the KPI review start and end dates");
        if(requested.size()>50)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"At most 50 KPIs can be configured");
        if(!requested.isEmpty()&&requested.stream().mapToInt(KpiRequest::weight).sum()!=100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"KPI weights must total exactly 100%");
        Set<String> names=new HashSet<>();Set<String> keys=new HashSet<>();Set<Long> ids=new HashSet<>();
        List<CarrKpi> existing=kpiRepo.findByCarrIdOrderById(c.getId());
        for(KpiRequest req:requested) {
            validateKpi(req);
            if(!names.add(req.name().trim().toLowerCase(Locale.ROOT)) || (req.id()!=null&&!ids.add(req.id())) || (req.generationKey()!=null&&!req.generationKey().isBlank()&&!keys.add(req.generationKey())))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Duplicate KPI names or identifiers are not allowed");
            CarrKpi k=req.id()==null?new CarrKpi():existing.stream().filter(x->req.id().equals(x.getId())).findFirst().orElseThrow(()->new ResourceNotFoundException("CARR KPI",req.id()));
            k.setCarr(c);applyKpi(k,req);kpiRepo.save(k);
        }
        kpiRepo.deleteAll(existing.stream().filter(k->!ids.contains(k.getId())).toList());
    }
    private void apply(CarrRecord c, RecordRequest req) {
        c.setEmployee(employee(req.employeeId())); c.setTitle(req.title()==null||req.title().isBlank()?designation(c.getEmployee()):req.title().trim()); c.setPurpose(req.purpose());
        if(req.departmentId()!=null && (c.getEmployee().getDepartment()==null || !Objects.equals(c.getEmployee().getDepartment().getId(),req.departmentId())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Selected employee does not belong to the selected department");
        c.setIndustry(req.industry()); c.setRoleLevel(req.roleLevel()); c.setReportsToTitle(req.reportsToTitle());
        c.setResponsibleFor(req.responsibleFor()); c.setRewardsEnabled(Boolean.TRUE.equals(req.rewardsEnabled()));
        c.setRewardsVisibleToEmployee(req.rewardsVisibleToEmployee()==null || req.rewardsVisibleToEmployee());
        c.setEffectiveFrom(req.effectiveFrom()); c.setEffectiveTo(req.effectiveTo()); c.setNextReviewDate(req.nextReviewDate()!=null?req.nextReviewDate():req.effectiveFrom()==null?null:CarrSettingsService.nextReview(req.effectiveFrom(),settings.forCompany(companyId()).reviewFrequency()));
        c.setManager(req.managerId()==null?c.getEmployee().getReportingManager():employee(req.managerId()));
        if(c.getManager()!=null&&Objects.equals(c.getManager().getId(),c.getEmployee().getId()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"An employee cannot be their own CAR reporting manager");
        c.setTemplate(req.templateId()==null?null:templateRepo.findByIdAndCompanyId(req.templateId(),companyId()).orElseThrow(() -> new ResourceNotFoundException("CARR template",req.templateId())));
        if(req.cycleId()!=null) c.setCycle(cycleRepo.findById(req.cycleId()).filter(x->Objects.equals(x.getCompany().getId(),companyId())).orElseThrow(() -> new ResourceNotFoundException("Performance cycle",req.cycleId()))); else c.setCycle(null);
        if(c.getEffectiveFrom()!=null && c.getEffectiveTo()!=null && c.getEffectiveTo().isBefore(c.getEffectiveFrom())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Effective end date cannot be before start date");
    }
    private void replaceChildren(CarrRecord c, RecordRequest req) {
        responsibilityRepo.deleteAll(responsibilityRepo.findByCarrIdOrderById(c.getId()));
        rewardRepo.deleteAll(rewardRepo.findByCarrIdOrderById(c.getId()));
        if(req.responsibilities()!=null) for(ResponsibilityRequest r:req.responsibilities()) {
            CarrResponsibility x=new CarrResponsibility(); x.setCarr(c); x.setStatement(r.statement().trim());
            x.setAccountableEmployee(r.accountableEmployeeId()==null?c.getEmployee():employee(r.accountableEmployeeId()));
            x.setPriority(r.priority()==null?"MEDIUM":r.priority()); x.setFrequency(r.frequency()); x.setEvidenceRequired(r.evidenceRequired()); x.setWeight(r.weight()); responsibilityRepo.save(x);
        }
        replaceKpis(c,req.kpis()==null?List.of():req.kpis());
        if(c.isRewardsEnabled() && req.rewards()!=null) for(RewardRequest reward:req.rewards()) {
            CarrReward x=new CarrReward(); x.setCarr(c); x.setName(reward.name().trim());
            x.setStatus(reward.status()==null?"TO_BE_DISCUSSED":reward.status());
            x.setDiscussionWith(reward.discussionWith()==null?"BOTH":reward.discussionWith()); rewardRepo.save(x);
        }
    }
    @Transactional
    public RecordResponse transition(Long id, TransitionRequest req, Authentication auth) {
        CarrRecord c=requireRecord(id); CarrStatus from=c.getStatus();
        Map<CarrStatus,Set<CarrStatus>> allowed=Map.of(
            CarrStatus.DRAFT,Set.of(CarrStatus.SUBMITTED,CarrStatus.ARCHIVED), CarrStatus.RETURNED,Set.of(CarrStatus.SUBMITTED,CarrStatus.ARCHIVED),
            CarrStatus.SUBMITTED,Set.of(CarrStatus.MANAGER_REVIEW,CarrStatus.RETURNED), CarrStatus.MANAGER_REVIEW,Set.of(CarrStatus.DEPT_HEAD_REVIEW,CarrStatus.HR_REVIEW,CarrStatus.RETURNED),
            CarrStatus.DEPT_HEAD_REVIEW,Set.of(CarrStatus.HR_REVIEW,CarrStatus.RETURNED), CarrStatus.HR_REVIEW,Set.of(CarrStatus.APPROVED,CarrStatus.RETURNED),
            CarrStatus.APPROVED,Set.of(CarrStatus.ACKNOWLEDGEMENT_PENDING,CarrStatus.RETURNED), CarrStatus.PUBLISHED,Set.of(CarrStatus.ARCHIVED));
        if(!allowed.getOrDefault(from,Set.of()).contains(req.status())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Invalid CARR transition from "+from+" to "+req.status());
        if(req.status()==CarrStatus.SUBMITTED) validateReady(c);
        if(!Set.of(CarrStatus.DRAFT,CarrStatus.RETURNED,CarrStatus.PUBLISHED).contains(from))ensureCanApprove(c,auth);
        c.setStatus(req.status()); c.setReturnReason(req.status()==CarrStatus.RETURNED?req.comment():null);
        if(req.status()==CarrStatus.PUBLISHED){UserPrincipal p=(UserPrincipal)auth.getPrincipal();c.setPublishedAt(LocalDateTime.now());c.setPublishedBy(p.getId());}
        recordRepo.save(c); audit(c,"STATUS_CHANGED",from+" -> "+req.status()+(req.comment()==null?"":" | "+req.comment()),auth); workflowNotifier.changed(c); return recordDto(c);
    }
    @Transactional
    public RecordResponse approve(Long id, Authentication auth) {
        CarrRecord c=requireRecord(id); ensureCanApprove(c,auth);
        if(!Set.of(CarrStatus.SUBMITTED,CarrStatus.MANAGER_REVIEW,CarrStatus.DEPT_HEAD_REVIEW,CarrStatus.HR_REVIEW,CarrStatus.APPROVED).contains(c.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"This CARR is not awaiting approval");
        CarrStatus from=c.getStatus(); c.setStatus(CarrStatus.ACKNOWLEDGEMENT_PENDING); c.setReturnReason(null); recordRepo.save(c);
        audit(c,"APPROVED",from+" -> employee acknowledgement",auth); workflowNotifier.changed(c); return recordDto(c);
    }
    @Transactional
    public RecordResponse requestChanges(Long id, ChangeRequest req, Authentication auth) {
        CarrRecord c=requireRecord(id); ensureCanApprove(c,auth);
        if(!Set.of(CarrStatus.SUBMITTED,CarrStatus.MANAGER_REVIEW,CarrStatus.DEPT_HEAD_REVIEW,CarrStatus.HR_REVIEW,CarrStatus.APPROVED,CarrStatus.ACKNOWLEDGEMENT_PENDING).contains(c.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"This CARR cannot be returned from its current status");
        c.setStatus(CarrStatus.RETURNED); c.setReturnReason(req.comment().trim()); recordRepo.save(c);
        audit(c,"CHANGES_REQUESTED",req.comment().trim(),auth); workflowNotifier.changed(c); return recordDto(c);
    }
    @Transactional
    public RecordResponse acknowledge(Long id, Authentication auth) {
        CarrRecord c=requireRecord(id); UserPrincipal p=(UserPrincipal)auth.getPrincipal();
        Employee signedIn=signedInEmployee(auth);
        if(!Objects.equals(signedIn.getId(),c.getEmployee().getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the assigned employee can acknowledge this CARR");
        if(c.getStatus()!=CarrStatus.ACKNOWLEDGEMENT_PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT,"This CARR is not awaiting employee acknowledgement");
        if(c.getRevisionOfId()!=null){
            CarrRecord previous=requireRecord(c.getRevisionOfId());
            if(previous.getStatus()!=CarrStatus.PUBLISHED)throw new ResponseStatusException(HttpStatus.CONFLICT,"The original CAR is no longer current; ask HR to resolve the revision");
            for(var k:kpiRepo.findByCarrIdOrderById(previous.getId()))if(CarrKpiEngine.isAutomatic(k.getDataSource())){var measured=measuredKpi(previous,k);k.setActualValue(measured.getActualValue());k.setEvidence(measured.getEvidence());kpiRepo.save(k);}
            previous.setStatus(CarrStatus.ARCHIVED);recordRepo.save(previous);audit(previous,"SUPERSEDED","Superseded by CAR #"+c.getId(),auth);workflowNotifier.changed(previous);
        }
        LocalDateTime now=LocalDateTime.now(); c.setEmployeeAcknowledgedAt(now); c.setPublishedAt(now); c.setPublishedBy(p.getId()); c.setStatus(CarrStatus.PUBLISHED); recordRepo.save(c);
        audit(c,"EMPLOYEE_ACKNOWLEDGED","Employee acknowledged and CARR published",auth); workflowNotifier.changed(c); return recordDto(c);
    }
    @Transactional
    public RecordResponse completeReview(Long id, ReviewRequest req, Authentication auth) {
        CarrRecord c=requireRecord(id); ensureCanApprove(c,auth);
        if(c.getStatus()!=CarrStatus.PUBLISHED) throw new ResponseStatusException(HttpStatus.CONFLICT,"Only a published CARR can be reviewed");
        LocalDate next=req.nextReviewDate()!=null?req.nextReviewDate():CarrSettingsService.nextReview(CarrWorkflowNotifier.today(),settings.forCompany(companyId()).reviewFrequency());
        if(!next.isAfter(CarrWorkflowNotifier.today()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The next review date must be in the future");
        c.setEmployeeReflection(req.employeeReflection()); c.setManagerComments(req.managerComments()); c.setNextReviewDate(next); c.setReviewCompletedAt(LocalDateTime.now()); recordRepo.save(c);
        audit(c,"REVIEW_COMPLETED","Performance review completed",auth); workflowNotifier.changed(c); return recordDto(c);
    }
    @Transactional
    public RecordResponse updateActual(Long carrId, Long kpiId, ActualValueRequest req, Authentication auth) {
        CarrRecord c = requireRecord(carrId);
        ensureCanApprove(c,auth);
        if (c.getStatus()!=CarrStatus.PUBLISHED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "KPI actuals can be updated only after employee acknowledgement and publication");
        CarrKpi k = kpiRepo.findById(kpiId).filter(x -> Objects.equals(x.getCarr().getId(), c.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("CARR KPI", kpiId));
        if(CarrKpiEngine.isAutomatic(k.getDataSource()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Refresh automatic actuals from source data; switch to manual in a draft to override");
        k.setActualValue(req.actualValue()); k.setEvidence(req.evidence()); kpiRepo.save(k);
        audit(c, "KPI_ACTUAL_UPDATED", k.getName() + " = " + req.actualValue()+"; evidence="+req.evidence()+"; score="+KpiScoring.score(k), auth);
        return recordDto(c);
    }
    private void validateReady(CarrRecord c){List<CarrKpi> ks=kpiRepo.findByCarrIdOrderById(c.getId());if(ks.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Add at least one KPI before submission");if(ks.stream().mapToInt(CarrKpi::getWeight).sum()!=100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"KPI weights must total 100");if(responsibilityRepo.findByCarrIdOrderById(c.getId()).isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Add at least one responsibility before submission");}
    private void ensureEditable(CarrRecord c){if(!Set.of(CarrStatus.DRAFT,CarrStatus.RETURNED).contains(c.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only draft or returned CARR records can be edited");}
    private CarrRecord requireRecord(Long id){return (org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly()?recordRepo.findByIdAndCompanyId(id,companyId()):recordRepo.findForUpdate(id,companyId())).orElseThrow(()->new ResourceNotFoundException("CARR",id));}
    @Transactional(readOnly=true) public List<AuditResponse> audit(Long id){requireRecord(id);return auditRepo.findByCarrIdOrderByCreatedAtDesc(id).stream().map(a->new AuditResponse(a.getId(),a.getAction(),a.getActorUserId(),a.getActorEmail(),a.getDetails(),a.getCreatedAt())).toList();}
    private void audit(CarrRecord c,String action,String details,Authentication auth){UserPrincipal p=(UserPrincipal)auth.getPrincipal();CarrAuditEvent a=new CarrAuditEvent();a.setCarr(c);a.setAction(action);a.setActorUserId(p.getId());a.setActorEmail(p.getEmail());a.setDetails(details);auditRepo.save(a);}
    @Transactional(readOnly=true) public DashboardResponse dashboard(){long active=employeeRepo.countByCompanyIdAndIsActiveTrue(companyId());long covered=recordRepo.countDistinctEmployeesByCompanyAndStatus(companyId(),CarrStatus.PUBLISHED);long published=recordRepo.countByCompanyIdAndStatus(companyId(),CarrStatus.PUBLISHED);long pending=List.of(CarrStatus.SUBMITTED,CarrStatus.MANAGER_REVIEW,CarrStatus.DEPT_HEAD_REVIEW,CarrStatus.HR_REVIEW,CarrStatus.APPROVED,CarrStatus.ACKNOWLEDGEMENT_PENDING).stream().mapToLong(s->recordRepo.countByCompanyIdAndStatus(companyId(),s)).sum();long drafts=recordRepo.countByCompanyIdAndStatus(companyId(),CarrStatus.DRAFT)+recordRepo.countByCompanyIdAndStatus(companyId(),CarrStatus.RETURNED);long overdue=recordRepo.countByCompanyIdAndNextReviewDateBeforeAndStatus(companyId(),LocalDate.now(),CarrStatus.PUBLISHED);long risk=recordRepo.findByCompanyIdOrderByUpdatedAtDesc(companyId()).stream().filter(c->c.getStatus()==CarrStatus.PUBLISHED).flatMap(c->kpiRepo.findByCarrIdOrderById(c.getId()).stream().map(k->measuredKpi(c,k))).filter(k->"AT_RISK".equals(risk(k))).count();BigDecimal coverage=active==0?BigDecimal.ZERO:BigDecimal.valueOf(covered*100.0/active).setScale(1,RoundingMode.HALF_UP);return new DashboardResponse(active,covered,Math.max(0,active-covered),drafts,pending,published,overdue,risk,coverage);}

    private TemplateResponse templateDto(CarrRoleTemplate t) {
        return new TemplateResponse(
            t.getId(),
            t.getJobRole() == null ? null : t.getJobRole().getId(),
            t.getJobRole() == null ? null : t.getJobRole().getName(),
            t.getDepartment() == null ? null : t.getDepartment().getId(),
            t.getDepartment() == null ? null : t.getDepartment().getName(),
            t.getTitle(),
            t.getReportsToTitle(),
            t.getPurpose(),
            t.getScope(),
            t.getCompetencies(),
            t.getTargetAudience() == null ? "BOTH" : t.getTargetAudience(),
            t.getEmploymentType(),
            t.getWorkMode(),
            t.getLocation(),
            t.getExperienceMinYears(),
            t.getExperienceMaxYears(),
            t.getEducationLevel(),
            t.getRequiredSkills(),
            t.getPreferredSkills(),
            t.getSalaryMin(),
            t.getSalaryMax(),
            t.getSalaryBenchmarkMin(),
            t.getSalaryBenchmarkMedian(),
            t.getSalaryBenchmarkMax(),
            t.getSalaryCurrency() == null ? "AED" : t.getSalaryCurrency(),
            t.getSalaryFrequency() == null ? "MONTHLY" : t.getSalaryFrequency(),
            t.isShowSalaryPublicly(),
            t.getBenefitsSummary(),
            t.getVacancyCount(),
            t.getStatus() == null ? "ACTIVE" : t.getStatus(),
            t.getApplicationInstructions(),
            t.getDraftContent(),
            t.getVersion(),
            t.isActive()
        );
    }
    private RecordResponse recordDto(CarrRecord c) {
        List<CarrKpi> ks=kpiRepo.findByCarrIdOrderById(c.getId()).stream().map(k->measuredKpi(c,k)).toList();
        List<ResponsibilityResponse> responsibilities=responsibilityRepo.findByCarrIdOrderById(c.getId()).stream().map(r->new ResponsibilityResponse(r.getId(),r.getStatement(),r.getAccountableEmployee().getId(),name(r.getAccountableEmployee()),r.getPriority(),r.getFrequency(),r.getEvidenceRequired(),r.getWeight())).toList();
        List<KpiResponse> kpis=ks.stream().map(k->new KpiResponse(k.getId(),k.getName(),k.getType(),k.getDirection(),k.getTargetValue(),k.getActualValue(),k.getUnit(),k.getWeight(),k.getDueDate(),k.getDataSource(),k.getEvidence(),achievement(k),risk(k),k.getReviewFrequency(),k.getMetricDefinition(),k.getGenerationKey(),k.isManuallyEdited(),KpiScoring.weighted(k),c.getEmployee().getId(),name(c.getEmployee()),
            c.getEmployee().getJobPosition()==null?c.getTitle():c.getEmployee().getJobPosition().getName(),k.getDescription()==null?k.getName():k.getDescription(),c.getEffectiveFrom(),KpiScoring.status(k,c.getEffectiveFrom(),c.getEffectiveTo(),LocalDate.now()))).toList();
        List<RewardResponse> rewards=rewardRepo.findByCarrIdOrderById(c.getId()).stream().map(r->new RewardResponse(r.getId(),r.getName(),r.getStatus(),r.getDiscussionWith())).toList();
        var authentication=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean managerView=authentication!=null&&authentication.getPrincipal() instanceof UserPrincipal principal&&c.getManager()!=null&&c.getManager().getUser()!=null&&Objects.equals(c.getManager().getUser().getId(),principal.getId());
        if(!c.isRewardsVisibleToEmployee()&&!canViewCompanyCarr(authentication)&&!managerView)rewards=List.of();
        return new RecordResponse(c.getId(),c.getEmployee().getId(),c.getEmployee().getBadgeId(),name(c.getEmployee()),c.getEmployee().getDepartment()==null?null:c.getEmployee().getDepartment().getName(),c.getTemplate()==null?null:c.getTemplate().getId(),c.getTemplate()==null?null:c.getTemplate().getTitle(),c.getCycle()==null?null:c.getCycle().getId(),c.getCycle()==null?null:c.getCycle().getName(),c.getManager()==null?null:c.getManager().getId(),c.getManager()==null?null:name(c.getManager()),c.getTitle(),c.getPurpose(),c.getIndustry(),c.getRoleLevel(),c.getReportsToTitle(),c.getResponsibleFor(),c.isRewardsEnabled(),c.isRewardsVisibleToEmployee(),c.getStatus(),c.getVersion(),c.getEffectiveFrom(),c.getEffectiveTo(),c.getNextReviewDate(),c.getPublishedAt(),c.getEmployeeAcknowledgedAt(),c.getReviewCompletedAt(),c.getEmployeeReflection(),c.getManagerComments(),responsibilities,kpis,rewards,score(ks),c.getReturnReason(),c.getCompany().getId(),c.getRevisionOfId());
    }
    private static LocalDate measurementEnd(CarrRecord c,CarrKpi k){return k.getDueDate()==null?c.getEffectiveTo():c.getEffectiveTo()==null||k.getDueDate().isBefore(c.getEffectiveTo())?k.getDueDate():c.getEffectiveTo();}
    private CarrKpi measuredKpi(CarrRecord c,CarrKpi k) {
        if(c.getStatus()==CarrStatus.ARCHIVED||!CarrKpiEngine.isAutomatic(k.getDataSource()))return k;
        CarrKpi projection=new CarrKpi();org.springframework.beans.BeanUtils.copyProperties(k,projection);
        var m=kpiEngine.measure(c.getEmployee(),k.getDataSource(),c.getEffectiveFrom(),measurementEnd(c,k));
        projection.setActualValue(m.actual());projection.setEvidence(m.evidence());projection.setTrackingStatus(m.status());return projection;
    }
    private BigDecimal achievement(CarrKpi k){return KpiScoring.score(k);}
    private String risk(CarrKpi k){BigDecimal a=achievement(k);return a==null?"NOT_SCORED":a.compareTo(BigDecimal.valueOf(70))<0?"AT_RISK":a.compareTo(BigDecimal.valueOf(100))<0?"ON_TRACK":"ACHIEVED";}
    private BigDecimal score(List<CarrKpi> ks){return KpiScoring.overall(ks);}
}
