-- Apply before startup in production (Hibernate schema validation).
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT schemaname, tablename FROM pg_tables
             WHERE tablename IN ('attendances', 'attendance_validation_conditions')
               AND schemaname NOT IN ('pg_catalog', 'information_schema') LOOP
        IF t.tablename = 'attendances' THEN
            EXECUTE format('ALTER TABLE %I.attendances
                ADD COLUMN IF NOT EXISTS reviewable_overtime_seconds integer,
                ADD COLUMN IF NOT EXISTS checkout_needs_review boolean,
                ADD COLUMN IF NOT EXISTS unapproved_work_seconds integer', t.schemaname);
        ELSE
            EXECUTE format('ALTER TABLE %I.attendance_validation_conditions
                ADD COLUMN IF NOT EXISTS overtime_review_from date,
                ADD COLUMN IF NOT EXISTS late_checkout_review_minutes integer', t.schemaname);
        END IF;
    END LOOP;
END $$;
