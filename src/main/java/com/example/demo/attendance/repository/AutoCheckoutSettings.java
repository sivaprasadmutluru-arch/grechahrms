package com.example.demo.attendance.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class AutoCheckoutSettings {
    private final JdbcTemplate jdbc;

    public boolean enabled(Long headOfficeId) {
        return enabledSince(headOfficeId, "").isPresent();
    }

    /** Transactional callers keep the policy stable until the checkout is committed. */
    public Instant lockEnabledSince(Long headOfficeId) {
        return enabledSince(headOfficeId, " FOR SHARE").orElse(null);
    }

    private Optional<Instant> enabledSince(Long headOfficeId, String lock) {
        return jdbc.query("""
                SELECT enabled_since FROM public.attendance_auto_checkout_settings
                WHERE head_office_id = ? AND enabled_since IS NOT NULL
                """ + lock, (rs, index) -> rs.getObject(1, OffsetDateTime.class).toInstant(), headOfficeId)
                .stream().findFirst();
    }

    public void setEnabled(Long headOfficeId, boolean enabled) {
        jdbc.update("""
                INSERT INTO public.attendance_auto_checkout_settings AS current_setting (head_office_id, enabled_since)
                VALUES (?, CASE WHEN ? THEN statement_timestamp() ELSE NULL END)
                ON CONFLICT (head_office_id) DO UPDATE SET enabled_since =
                    CASE WHEN EXCLUDED.enabled_since IS NULL THEN NULL
                         ELSE COALESCE(current_setting.enabled_since, EXCLUDED.enabled_since)
                    END
                """, headOfficeId, enabled);
    }
}
