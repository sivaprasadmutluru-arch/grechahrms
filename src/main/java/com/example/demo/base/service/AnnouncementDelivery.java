package com.example.demo.base.service;

import com.example.demo.base.entity.Announcement;
import com.example.demo.common.tenant.TenantContext;
import com.example.demo.employee.entity.Employee;
import com.example.demo.employee.repository.EmployeeRepository;
import com.example.demo.notification.entity.Notification;
import com.example.demo.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.util.HtmlUtils;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnnouncementDelivery {
    private final EmployeeRepository employees;
    private final NotificationService notifications;
    private final EmailService email;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactions;

    record Recipient(Long employeeId, String email) {}
    public record MailBatch(String tenant, Long companyId, Long announcementId, String title, String html,
                            List<Recipient> recipients) {}

    /** Persist notifications in the same transaction as publication; leave SMTP until after commit. */
    public void publish(Announcement announcement) {
        var company = announcement.getCompany();
        String message = Objects.toString(announcement.getDescription(), "");
        Set<Long> userIds = new HashSet<>();
        Map<String, Recipient> recipients = new LinkedHashMap<>();
        for (Employee employee : employees.findByCompanyIdAndIsActiveTrue(company.getId())) {
            var user = employee.getUser();
            if (user != null && user.isActive() && userIds.add(user.getId())) {
                notifications.send(user.getId(), announcement.getTitle(), message, Notification.NotificationType.GENERAL,
                        "ANNOUNCEMENT", announcement.getId(), company);
            }
            String address = firstAddress(employee.getWorkEmail(), employee.getEmail(), user != null ? user.getEmail() : null);
            if (address != null) recipients.putIfAbsent(address.toLowerCase(Locale.ROOT), new Recipient(employee.getId(), address));
        }
        if (!recipients.isEmpty()) {
            String html = "<h2>" + HtmlUtils.htmlEscape(announcement.getTitle()) + "</h2><p>"
                    + HtmlUtils.htmlEscape(message).replace("\n", "<br>") + "</p>"
                    + "<p><a href=\"https://grecha.ai/announcements\">Open announcements in Grecha</a></p>";
            events.publishEvent(new MailBatch(TenantContext.getTenant(), company.getId(), announcement.getId(),
                    announcement.getTitle(), html, List.copyOf(recipients.values())));
        }
    }

    @Async
    @TransactionalEventListener
    public void deliver(MailBatch batch) {
        String previous = TenantContext.getTenant();
        try {
            TenantContext.setTenant(batch.tenant());
            if (!Boolean.TRUE.equals(transactions.execute(status -> email.hasActiveSmtpConfig(batch.companyId())))) {
                log.warn("Announcement {}: email not sent because SMTP is not configured for company {}", batch.announcementId(), batch.companyId());
                return;
            }
            for (Recipient recipient : batch.recipients()) {
                try {
                    transactions.executeWithoutResult(status -> employees.findById(recipient.employeeId())
                            .filter(e -> e.isActive() && e.getCompany() != null && batch.companyId().equals(e.getCompany().getId()))
                            .ifPresent(e -> email.sendEmail(batch.companyId(), recipient.email(), batch.title(), batch.html(), e)));
                } catch (RuntimeException ex) {
                    log.warn("Announcement {}: email delivery failed for employee {} ({})",
                            batch.announcementId(), recipient.employeeId(), ex.getClass().getSimpleName());
                }
            }
        } finally {
            TenantContext.setTenant(previous);
        }
    }

    private static String firstAddress(String... addresses) {
        for (String address : addresses) {
            if (address != null && address.trim().matches("[^\\s@,;]+@[^\\s@,;]+")) return address.trim();
        }
        return null;
    }
}
