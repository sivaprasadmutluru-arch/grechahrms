package com.example.demo.carr.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.repository.UserRoleRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.carr.entity.*;
import com.example.demo.carr.repository.CarrAuditEventRepository;
import com.example.demo.employee.entity.Employee;
import com.example.demo.notification.repository.NotificationRepository;
import com.example.demo.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CarrWorkflowNotifierTest {
    NotificationService notifications=mock(NotificationService.class);
    NotificationRepository notificationRepo=mock(NotificationRepository.class);
    UserRoleRepository roles=mock(UserRoleRepository.class);
    CarrAuditEventRepository audit=mock(CarrAuditEventRepository.class);
    CarrWorkflowNotifier notifier=new CarrWorkflowNotifier(notifications,notificationRepo,roles,audit);
    CarrRecord record(){var c=new CarrRecord();c.setId(1L);c.setTitle("QA CAR");var company=new Company();company.setId(65L);c.setCompany(company);
        var owner=new Employee();owner.setId(10L);var user=new User();user.setId(100L);owner.setUser(user);c.setEmployee(owner);
        var manager=new Employee();manager.setId(20L);var lead=new User();lead.setId(200L);manager.setUser(lead);c.setManager(manager);return c;}
    @Test void pendingRoutesToReportingManagerAndAcknowledgementOnlyToEmployee(){var c=record();c.setStatus(CarrStatus.SUBMITTED);
        assertEquals(Set.of(200L),notifier.recipients(c,notifier.action(c,LocalDate.now())));
        c.setStatus(CarrStatus.ACKNOWLEDGEMENT_PENDING);assertEquals(Set.of(100L),notifier.recipients(c,notifier.action(c,LocalDate.now())));
        c.setStatus(CarrStatus.PUBLISHED);c.setNextReviewDate(LocalDate.now().plusDays(1));assertNull(notifier.action(c,LocalDate.now()));
        c.setNextReviewDate(LocalDate.now());assertEquals("REVIEW",notifier.action(c,LocalDate.now()));}
    @Test void remindersAreDeduplicatedPerRecipientStageAndDay(){var c=record();c.setStatus(CarrStatus.SUBMITTED);Set<String> ledger=new HashSet<>();
        when(audit.existsByCarrIdAndActionAndDetails(anyLong(),anyString(),anyString())).thenAnswer(call->ledger.contains(call.getArgument(2)));
        when(audit.save(any())).thenAnswer(call->{CarrAuditEvent event=call.getArgument(0);ledger.add(event.getDetails());return event;});
        LocalDate day=LocalDate.of(2026,11,19);notifier.remind(c,day);notifier.remind(c,day);notifier.remind(c,day.plusDays(1));
        verify(notifications,times(2)).send(eq(200L),anyString(),anyString(),any(),eq("CARR_APPROVAL"),eq(1L),any());
        c.setStatus(CarrStatus.ARCHIVED);notifier.remind(c,day.plusDays(2));verifyNoMoreInteractions(notifications);}
}
