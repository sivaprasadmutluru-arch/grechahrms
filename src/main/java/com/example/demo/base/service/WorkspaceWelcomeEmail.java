package com.example.demo.base.service;

import com.example.demo.auth.repository.UserRepository;
import com.example.demo.base.entity.Company;
import com.example.demo.base.entity.EmailLog;
import com.example.demo.base.repository.EmailLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceWelcomeEmail {
    private static final String PORTAL = "https://grecha.ai";
    private final ObjectProvider<JavaMailSender> senders;
    private final UserRepository users;
    private final EmailLogRepository logs;
    private final TransactionTemplate transactions;

    @Value("${spring.mail.username:}")
    private String from;
    @Value("${app.onboarding.terms-url:}")
    private String termsUrl;

    /** Called once after the provisioning job commits READY, with its tenant selected. */
    public boolean send(Company company, Long adminId) {
        var admin = users.findById(adminId).orElse(null);
        if (admin == null || !admin.isActive() || admin.getEmail() == null || admin.getEmail().isBlank()) return false;
        EmailLog delivery = new EmailLog();
        delivery.setCompany(company);
        delivery.setRecipientEmail(admin.getEmail());
        delivery.setSubject("Welcome to Grecha | Your workspace is ready");
        delivery.setBody("Workspace invitation. The private password setup link is not retained in this log.");
        delivery.setSentAt(LocalDateTime.now());

        String token = UUID.randomUUID().toString();
        String hash = tokenHash(token);
        try {
            JavaMailSender sender = senders.getIfAvailable();
            if (sender == null || from == null || from.isBlank()) {
                throw new IllegalStateException("Platform mail sender not configured");
            }
            transactions.executeWithoutResult(status -> {
                var locked = users.findByIdForUpdate(adminId).orElseThrow();
                locked.setResetToken(hash);
                locked.setResetTokenExpiry(LocalDateTime.now().plusHours(24));
                users.save(locked);
            });
            // Fragments aren't sent to the HTTP server or recorded in its access logs.
            String setup = PORTAL + "/forgot-password#setup=" + token;
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from, "Grecha");
            helper.setTo(admin.getEmail());
            helper.setSubject(delivery.getSubject());
            helper.setText("Welcome to Grecha. Your workspace for " + company.getName() + " is ready.\n"
                    + "Username: " + admin.getUsername() + "\nSet your password: " + setup
                    + "\nThe link expires in 24 hours. Sign in at " + PORTAL + "/login"
                    + "\nPrivacy Policy: " + PORTAL + "/privacy-policy"
                    + (safeTerms(termsUrl).isEmpty() ? "" : "\nTerms and Conditions: " + safeTerms(termsUrl)),
                    render(company.getName(), admin.getFirstName(), admin.getUsername(), setup, termsUrl));
            sender.send(message);
            delivery.setStatus(EmailLog.EmailStatus.SENT);
        } catch (Exception ex) {
            delivery.setStatus(EmailLog.EmailStatus.FAILED);
            delivery.setErrorMessage("Workspace invitation could not be sent. Check platform SMTP configuration.");
        }
        logs.save(delivery);
        return delivery.getStatus() == EmailLog.EmailStatus.SENT;
    }

    public static String tokenHash(String token) {
        try {
            return "invite:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static String render(String company, String name, String username, String setupUrl, String termsUrl) {
        String terms = safeTerms(termsUrl);
        String termsLink = terms.isEmpty() ? "" : " &nbsp;|&nbsp; <a href=\"" + escape(terms)
                + "\" style=\"color:#4338ca\">Terms and Conditions</a>";
        return """
                <!doctype html><html lang="en"><body style="margin:0;background:#f3f4f8;font-family:Arial,sans-serif;color:#172033">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e3ee;border-radius:16px">
                <tr><td style="padding:22px 28px;background:#27205a;color:#ffffff;font-size:20px;font-weight:bold;border-radius:16px 16px 0 0">GRECHA.AI</td></tr>
                <tr><td style="padding:28px;line-height:1.6;font-size:15px">
                <h1 style="font-size:25px;line-height:1.2;margin:0 0 14px">Your workspace is ready</h1>
                <p>Hello %s,</p><p>Welcome to Grecha! Your organization, <strong>%s</strong>, is ready to get started.</p>
                <p style="padding:14px 16px;background:#f3f1ff;border-radius:8px"><strong>Administrator username</strong><br>%s</p>
                <p><a href="%s" style="background:#4338ca;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold">Set your password</a></p>
                <p style="font-size:13px;color:#4b5563">This private link can be used once and expires in 24 hours. If it expires, contact your Grecha administrator. Do not forward it.</p>
                <p>Once set up, <a href="https://grecha.ai/login" style="color:#4338ca">sign in to Grecha</a> to configure your company and invite your team.</p>
                </td></tr><tr><td style="padding:18px 28px;background:#f8f8fc;font-size:13px;border-radius:0 0 16px 16px">
                <a href="https://grecha.ai/privacy-policy" style="color:#4338ca">Privacy Policy</a>%s</td></tr>
                </table></td></tr></table></body></html>
                """.formatted(escape(name == null || name.isBlank() ? "there" : name), escape(company),
                escape(username), escape(setupUrl), termsLink);
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    private static String safeTerms(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            URI uri = URI.create(value.trim());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null
                    ? uri.toASCIIString() : "";
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }
}
