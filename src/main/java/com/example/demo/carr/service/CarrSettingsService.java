package com.example.demo.carr.service;

import com.example.demo.carr.entity.CarrCompanySettings;
import com.example.demo.carr.repository.CarrCompanySettingsRepository;
import com.example.demo.common.context.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.Objects;

@Service @RequiredArgsConstructor
public class CarrSettingsService {
    private final CarrCompanySettingsRepository settings;
    public record View(Long companyId,String reviewFrequency,Long version) {}
    public record Change(@NotNull @Pattern(regexp="Monthly|Quarterly|Half-Yearly|Yearly") String reviewFrequency,Long version) {}
    private Long company(){
        var scope=AccessScopeContext.get();Long id=scope!=null&&scope.getFilterCompanyId()!=null?scope.getFilterCompanyId():CompanyContext.get();
        if(id==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select a company");
        if(scope!=null&&!scope.canAccess(id))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Company is outside your access");return id;
    }
    @Transactional(readOnly=true) public View view(){return forCompany(company());}
    @Transactional(readOnly=true) public View forCompany(Long id){var row=settings.findById(id).orElse(null);return new View(id,row==null?"Quarterly":row.getReviewFrequency(),row==null?null:row.getVersion());}
    @Transactional public View save(Change change,Authentication auth){
        Long company=company();if(!CarrCreationService.canManage(auth))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only company HR administrators can change CAR settings");
        var row=settings.findById(company).orElse(null);
        if(!Objects.equals(row==null?null:row.getVersion(),change.version()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Settings changed; reload before saving");
        if(row==null){row=new CarrCompanySettings();row.setCompanyId(company);}row.setReviewFrequency(change.reviewFrequency());
        row=settings.saveAndFlush(row);return new View(company,row.getReviewFrequency(),row.getVersion());
    }
    public static LocalDate nextReview(LocalDate start,String frequency){return start.plusMonths(switch(frequency){case "Monthly"->1;case "Half-Yearly"->6;case "Yearly"->12;default->3;});}
}
