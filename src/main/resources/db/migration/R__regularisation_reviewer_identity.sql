-- Add audit identity without changing requests, attendance, employees or roles.
DO $reviewer$
DECLARE tenant text;
BEGIN
    FOR tenant IN SELECT 'public' UNION SELECT schema_name FROM public.companies WHERE schema_name IS NOT NULL LOOP
        IF tenant !~ '^[a-zA-Z0-9_]+$' THEN RAISE EXCEPTION 'Invalid tenant schema'; END IF;
        IF to_regclass(format('%I.attendance_regularisation_requests', tenant)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE %I.attendance_regularisation_requests
            ADD COLUMN IF NOT EXISTS hr_approved_by_user_id bigint,
            ADD COLUMN IF NOT EXISTS hr_approved_by_user_name varchar(250),
            ADD COLUMN IF NOT EXISTS rejected_by_user_id bigint,
            ADD COLUMN IF NOT EXISTS rejected_by_user_name varchar(250)', tenant);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                       WHERE n.nspname=tenant AND c.conname='attendance_reg_approved_user_fk') THEN
            EXECUTE format('ALTER TABLE %I.attendance_regularisation_requests ADD CONSTRAINT attendance_reg_approved_user_fk FOREIGN KEY (hr_approved_by_user_id) REFERENCES public.users(id)', tenant);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                       WHERE n.nspname=tenant AND c.conname='attendance_reg_rejected_user_fk') THEN
            EXECUTE format('ALTER TABLE %I.attendance_regularisation_requests ADD CONSTRAINT attendance_reg_rejected_user_fk FOREIGN KEY (rejected_by_user_id) REFERENCES public.users(id)', tenant);
        END IF;
    END LOOP;
END $reviewer$;
