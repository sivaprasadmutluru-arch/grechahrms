-- Apply before enabling late punch reasons. Legacy tables without an enum check need no change.
DO $late_punch_reasons$
DECLARE chk record;
BEGIN
    FOR chk IN
        SELECT n.nspname, c.conname, pg_get_expr(c.conbin, c.conrelid) AS expression
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'request_type'
        WHERE t.relname = 'attendance_regularisation_requests'
          AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum]
          AND n.nspname IN (SELECT 'public' UNION SELECT schema_name FROM public.companies)
          AND pg_get_expr(c.conbin, c.conrelid) NOT LIKE '%LATE_CHECK_IN_REASON%'
    LOOP
        EXECUTE format('ALTER TABLE %I.attendance_regularisation_requests DROP CONSTRAINT %I,
            ADD CONSTRAINT %I CHECK ((%s) OR request_type IN (''LATE_CHECK_IN_REASON'', ''LATE_CHECK_OUT_REASON''))',
            chk.nspname, chk.conname, chk.conname, chk.expression);
    END LOOP;
END $late_punch_reasons$;
