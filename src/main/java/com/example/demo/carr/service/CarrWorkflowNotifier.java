package com.example.demo.carr.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.carr.entity.*;
import com.example.demo.carr.repository.CarrAuditEventRepository;
import com.example.demo.notification.entity.Notification.NotificationType;
import com.example.demo.notification.repository.NotificationRepository;
import com.example.demo.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

/** In-app only. The caller owns the locked record and transaction, including deduplication audit. */
@Service @RequiredArgsConstructor
public class CarrWorkflowNotifier {
    private final NotificationService notifications;
    private final NotificationRepository notificationRepo;
    private final UserRoleRepository roles;
    private final CarrAuditEventRepository audit;
    private static final Set<String> HR=Set.of("PLATFORM_SUPER_ADMIN","SUPER_ADMIN","ACCOUNT_MANAGER","COMPANY_ADMIN","CEO","ENTERPRISE_ADMIN","COMPANY_MANAGER","BRANCH_ADMIN","HR_MANAGER");
    public static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Dubai"));}
    private Set<Long> hr(CarrRecord c){
        var companyIds=new ArrayList<Long>();companyIds.add(c.getCompany().getId());
        if(c.getCompany().getParentCompanyId()!=null)companyIds.add(c.getCompany().getParentCompanyId());
        var recipients=new LinkedHashSet<Long>();
        roles.findByCompanyIdIn(companyIds).stream().filter(r->r.isEffectiveOn(today())&&r.getRole().isActive()&&HR.contains(r.getRole().getName().name()))
                .map(r->r.getUser()).filter(u->u!=null&&u.isActive()).map(User::getId).forEach(recipients::add);
        return recipients;
    }
    private Long employeeUser(CarrRecord c){var u=c.getEmployee().getUser();return u!=null&&u.isActive()?u.getId():null;}
    public String action(CarrRecord c,LocalDate today){
        return switch(c.getStatus()){
            case SUBMITTED,MANAGER_REVIEW,DEPT_HEAD_REVIEW,HR_REVIEW,APPROVED -> "APPROVAL";
            case ACKNOWLEDGEMENT_PENDING -> "ACKNOWLEDGEMENT";
            case RETURNED -> "CHANGES";
            case PUBLISHED -> c.getNextReviewDate()!=null&&!c.getNextReviewDate().isAfter(today)?"REVIEW":null;
            default -> null;
        };
    }
    public Set<Long> recipients(CarrRecord c,String action){
        if(action.equals("ACKNOWLEDGEMENT")){Long owner=employeeUser(c);return owner==null?Set.of():Set.of(owner);}
        if(!action.equals("CHANGES")&&c.getManager()!=null&&c.getManager().isActive()&&c.getManager().getUser()!=null&&c.getManager().getUser().isActive()
                &&!Objects.equals(c.getManager().getId(),c.getEmployee().getId()))return Set.of(c.getManager().getUser().getId());
        var ids=hr(c);if(!action.equals("CHANGES"))ids.remove(employeeUser(c));return ids;
    }
    public void changed(CarrRecord c){
        for(String kind:List.of("APPROVAL","ACKNOWLEDGEMENT","CHANGES","REVIEW"))
            notificationRepo.completeRelatedAction(c.getCompany().getId(),"CARR_"+kind,c.getId(),"CARR_WORKFLOW_HISTORY","CAR status updated",c.getTitle()+" is now "+c.getStatus());
        String action=action(c,today());
        if(action!=null)for(Long recipient:recipients(c,action))send(c,recipient,action,false);
    }
    public void remind(CarrRecord c,LocalDate date){
        String action=action(c,date);if(action==null)return;
        for(Long recipient:recipients(c,action)){
            String key=date+":"+action+":"+recipient;
            if(audit.existsByCarrIdAndActionAndDetails(c.getId(),"WORKFLOW_REMINDER_SENT",key))continue;
            send(c,recipient,action,true);
            var event=new CarrAuditEvent();event.setCarr(c);event.setAction("WORKFLOW_REMINDER_SENT");event.setDetails(key);
            event.setActorUserId(0L);event.setActorEmail("system");audit.save(event);
        }
    }
    private void send(CarrRecord c,Long recipient,String action,boolean reminder){
        String task=switch(action){case "APPROVAL"->"Review and approve or request changes";case "ACKNOWLEDGEMENT"->"Read and acknowledge the approved CAR";case "CHANGES"->"Revise the CAR using the review feedback";default->"Complete the scheduled performance review";};
        notifications.send(recipient,(reminder?"Reminder: ":"")+"CAR "+action.toLowerCase(Locale.ROOT).replace('_',' ')+" required",
                c.getTitle()+" — version "+c.getVersion()+". "+task+" in CARR. No approval or acknowledgement is recorded by this notification.",
                NotificationType.GENERAL,"CARR_"+action,c.getId(),c.getCompany());
    }
}
