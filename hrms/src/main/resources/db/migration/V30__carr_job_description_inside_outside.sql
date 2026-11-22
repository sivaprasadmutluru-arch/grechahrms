-- Dual-Mode Job Description: Support Inside Employee CARs and Outside Candidate Recruitment JDs
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_schema FROM information_schema.tables
           WHERE table_name = 'carr_role_templates' AND table_type = 'BASE TABLE'
             AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.carr_role_templates
      ADD COLUMN IF NOT EXISTS target_audience VARCHAR(30) DEFAULT ''BOTH'',
      ADD COLUMN IF NOT EXISTS department_id BIGINT,
      ADD COLUMN IF NOT EXISTS reports_to_title VARCHAR(180),
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50),
      ADD COLUMN IF NOT EXISTS location VARCHAR(180),
      ADD COLUMN IF NOT EXISTS experience_min_years INT,
      ADD COLUMN IF NOT EXISTS experience_max_years INT,
      ADD COLUMN IF NOT EXISTS education_level VARCHAR(120),
      ADD COLUMN IF NOT EXISTS required_skills TEXT,
      ADD COLUMN IF NOT EXISTS preferred_skills TEXT,
      ADD COLUMN IF NOT EXISTS salary_min NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS salary_max NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT ''AED'',
      ADD COLUMN IF NOT EXISTS salary_frequency VARCHAR(30) DEFAULT ''MONTHLY'',
      ADD COLUMN IF NOT EXISTS show_salary_publicly BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS benefits_summary TEXT,
      ADD COLUMN IF NOT EXISTS vacancy_count INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT ''ACTIVE'',
      ADD COLUMN IF NOT EXISTS application_instructions TEXT;', t.table_schema);
  END LOOP;
END $$;
