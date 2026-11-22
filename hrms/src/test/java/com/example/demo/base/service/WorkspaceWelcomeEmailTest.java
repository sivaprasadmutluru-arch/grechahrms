package com.example.demo.base.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.repository.UserRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.EmailLog;
import com.example.demo.base.repository.EmailLogRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WorkspaceWelcomeEmailTest {
    @Test
    void brandedEmailEscapesCompanyAndShowsOnlyApprovedTermsLink() {
        String html = WorkspaceWelcomeEmail.render("<Org>", "Admin", "admin@example.test",
                "https://grecha.ai/forgot-password#setup=example", "https://grecha.ai/legal/terms");
        assertTrue(html.contains("&lt;Org&gt;"));
        assertTrue(html.contains("admin@example.test"));
        assertTrue(html.contains("Set your password"));
        assertTrue(html.contains("https://grecha.ai/legal/terms"));
        assertTrue(html.contains("Privacy Policy"));
        assertFalse(WorkspaceWelcomeEmail.render("Org", null, "admin", "#", "javascript:alert(1)")
                .contains("Terms and Conditions"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void sendsToInitialAdminAndKeepsSetupSecretOutOfLogs() throws Exception {
        ObjectProvider<JavaMailSender> senders = mock(ObjectProvider.class);
        var sender = mock(JavaMailSender.class);
        var users = mock(UserRepository.class);
        var logs = mock(EmailLogRepository.class);
        var tx = mock(TransactionTemplate.class);
        doAnswer(call -> {
            call.<java.util.function.Consumer<org.springframework.transaction.TransactionStatus>>getArgument(0)
                    .accept(mock(org.springframework.transaction.TransactionStatus.class));
            return null;
        }).when(tx).executeWithoutResult(any());
        var admin = new User();
        admin.setEmail("admin@example.test");
        admin.setUsername("workspace-admin");
        var company = new Company();
        company.setName("Example Company");
        when(users.findById(5L)).thenReturn(Optional.of(admin));
        when(users.findByIdForUpdate(5L)).thenReturn(Optional.of(admin));
        when(senders.getIfAvailable()).thenReturn(sender);
        var message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        var invitation = new WorkspaceWelcomeEmail(senders, users, logs, tx);
        ReflectionTestUtils.setField(invitation, "from", "grecha@example.test");
        assertTrue(invitation.send(company, 5L));
        verify(sender).send(message);
        assertEquals("admin@example.test", message.getAllRecipients()[0].toString());
        var output = new java.io.ByteArrayOutputStream();
        message.writeTo(output);
        String mime = output.toString(java.nio.charset.StandardCharsets.UTF_8);
        assertFalse(mime.contains(admin.getResetToken()));
        assertTrue(admin.getResetToken().matches("invite:[a-f0-9]{64}"));
        verify(logs).save(argThat(log -> log.getStatus() == EmailLog.EmailStatus.SENT
                && log.getCompany() == company && !log.getBody().contains("setup=")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void missingSmtpIsRecordedAsFailedAndDoesNotIssueToken() {
        ObjectProvider<JavaMailSender> senders = mock(ObjectProvider.class);
        var users = mock(UserRepository.class);
        var logs = mock(EmailLogRepository.class);
        var tx = mock(TransactionTemplate.class);
        var admin = new User();
        admin.setEmail("admin@example.test");
        when(users.findById(5L)).thenReturn(Optional.of(admin));
        assertFalse(new WorkspaceWelcomeEmail(senders, users, logs, tx).send(new Company(), 5L));
        verifyNoInteractions(tx);
        verify(logs).save(argThat(log -> log.getStatus() == EmailLog.EmailStatus.FAILED));
    }
}
