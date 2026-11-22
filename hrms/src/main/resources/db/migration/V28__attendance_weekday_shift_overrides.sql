-- Deploy before the backend starts with schema validation enabled.
DO $weekday_shift$
DECLARE tenant text;
BEGIN
    FOR tenant IN SELECT 'public' UNION SELECT schema_name FROM public.companies WHERE schema_name IS NOT NULL LOOP
        IF to_regclass(format('%I.shift_schedules', tenant)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.shift_schedules ADD COLUMN IF NOT EXISTS weekday_shift_ids jsonb', tenant);
        END IF;
    END LOOP;
END $weekday_shift$;
