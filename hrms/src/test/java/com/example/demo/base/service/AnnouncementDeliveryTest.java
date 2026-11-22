package com.example.demo.base.service;

import com.example.demo.auth.entity.User;
import com.example.demo.base.entity.Announcement;
import com.example.demo.base.entity.Company;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AnnouncementDeliveryTest {
    @Test void notifiesUniqueLoginsAndIncludesEmployeesWhoOnlyHaveEmail() {
        var employees = mock(EmployeeRepository.class);
        var notifications = mock(NotificationService.class);
        var mail = mock(EmailService.class);
        var events = mock(ApplicationEventPublisher.class);
        var delivery = new AnnouncementDelivery(employees, notifications, mail, events, mock(TransactionTemplate.class));
        var company = new Company();
        company.setId(12L);
        var announcement = new Announcement();
        announcement.setId(20L);
        announcement.setCompany(company);
        announcement.setTitle("Office update");
        announcement.setDescription("<urgent>\nMonday");

        var user = new User(); user.setId(7L);
        Employee linked = new Employee(); linked.setId(1L); linked.setUser(user); linked.setEmail("linked@example.com");
        Employee emailOnly = new Employee(); emailOnly.setId(2L); emailOnly.setWorkEmail("work@example.com");
        when(employees.findByCompanyIdAndIsActiveTrue(12L)).thenReturn(List.of(linked, linked, emailOnly));
        delivery.publish(announcement);

        verify(notifications, times(1)).send(7L, "Office update", "<urgent>\nMonday",
                Notification.NotificationType.GENERAL, "ANNOUNCEMENT", 20L, company);
        var batch = ArgumentCaptor.forClass(AnnouncementDelivery.MailBatch.class);
        verify(events).publishEvent(batch.capture());
        assertEquals(List.of(new AnnouncementDelivery.Recipient(1L, "linked@example.com"),
                new AnnouncementDelivery.Recipient(2L, "work@example.com")), batch.getValue().recipients());
        assertTrue(batch.getValue().html().contains("&lt;urgent&gt;<br>Monday"));
        verifyNoInteractions(mail);
    }
}
