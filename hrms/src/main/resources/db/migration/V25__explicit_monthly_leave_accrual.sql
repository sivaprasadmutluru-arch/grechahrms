DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname FROM pg_tables
           WHERE tablename = 'leave_types' AND schemaname NOT IN ('pg_catalog', 'information_schema') LOOP
    EXECUTE format('ALTER TABLE %I.leave_types ADD COLUMN IF NOT EXISTS monthly_accrual_days numeric(7,2)', t.schemaname);
  END LOOP;
END $$;
