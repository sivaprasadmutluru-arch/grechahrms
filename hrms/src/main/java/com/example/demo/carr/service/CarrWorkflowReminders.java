package com.example.demo.carr.service;

import com.example.demo.base.entity.Company;
import com.example.demo.base.repository.CompanyRepository;
import com.example.demo.carr.entity.CarrStatus;
import com.example.demo.carr.repository.CarrRecordRepository;
import com.example.demo.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.List;

@Component @RequiredArgsConstructor @Slf4j
public class CarrWorkflowReminders {
    private final CompanyRepository companies;
    private final Worker worker;
    @Value("${carr.workflow.reminders-enabled:true}") private boolean enabled;
    private volatile boolean ready;
    @EventListener(ApplicationReadyEvent.class) public void ready(){ready=true;}
    @Scheduled(initialDelay=60000,fixedDelayString="${carr.workflow.scan-ms:900000}")
    public synchronized void scan(){
        var now=ZonedDateTime.now(ZoneId.of("Asia/Dubai"));
        if(!ready||!enabled||now.getHour()<9)return;
        var previous=TenantContext.getTenant();
        try{for(var tenant:companies.findAllHeadOfficesActivePublic()){
            if(!tenant.isSchemaReady()||tenant.getSchemaName()==null||tenant.getStatus()!=Company.CompanyStatus.ACTIVE)continue;
            try{TenantContext.setTenant(tenant.getSchemaName());worker.company(tenant.getId(),now.toLocalDate());
                for(var branch:companies.findByParentCompanyIdAndIsActiveTruePublic(tenant.getId()))if(branch.getStatus()==Company.CompanyStatus.ACTIVE)worker.company(branch.getId(),now.toLocalDate());
            }catch(Exception ex){log.error("CARR action reminder failed tenant={}",tenant.getSchemaName(),ex);}finally{TenantContext.setTenant(previous);}
        }}finally{TenantContext.setTenant(previous);}
    }
    @Service @RequiredArgsConstructor
    public static class Worker {
        private final CarrRecordRepository records;
        private final CarrWorkflowNotifier notifier;
        @Transactional public void company(Long company,LocalDate today){
            var ids=records.findWorkflowActionIds(company,List.of(CarrStatus.SUBMITTED,CarrStatus.MANAGER_REVIEW,CarrStatus.DEPT_HEAD_REVIEW,CarrStatus.HR_REVIEW,CarrStatus.APPROVED,CarrStatus.ACKNOWLEDGEMENT_PENDING,CarrStatus.RETURNED),CarrStatus.PUBLISHED,today);
            for(Long id:ids)records.findForUpdate(id,company).filter(c->c.isActive()&&c.getEmployee().isActive()).ifPresent(c->notifier.remind(c,today));
        }
    }
}
