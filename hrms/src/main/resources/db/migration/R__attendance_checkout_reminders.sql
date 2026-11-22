-- Existing tenants; newly provisioned tenants also receive this entity through Hibernate.
DO $$
DECLARE tenant record;
BEGIN
    FOR tenant IN SELECT 'public' AS schema_name UNION SELECT DISTINCT schema_name FROM public.companies
        WHERE is_active AND schema_name IS NOT NULL
          AND to_regclass(format('%I.attendances', schema_name)) IS NOT NULL
    LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.attendance_checkout_reminders (
            attendance_id bigint PRIMARY KEY, sent_at timestamptz NOT NULL)', tenant.schema_name);
    END LOOP;
END $$;
