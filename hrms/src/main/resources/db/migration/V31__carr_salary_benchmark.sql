-- V31: Add salary benchmark columns to carr_role_templates across all tenant schemas
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_schema FROM information_schema.tables
           WHERE table_name = 'carr_role_templates' AND table_type = 'BASE TABLE'
             AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.carr_role_templates
      ADD COLUMN IF NOT EXISTS salary_benchmark_min NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS salary_benchmark_median NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS salary_benchmark_max NUMERIC(15,2);', t.table_schema);
  END LOOP;
END $$;
