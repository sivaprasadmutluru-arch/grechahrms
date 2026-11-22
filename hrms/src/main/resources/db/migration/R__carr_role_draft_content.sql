DO $$ DECLARE t record; BEGIN
FOR t IN SELECT table_schema FROM information_schema.tables WHERE table_name='carr_role_templates' AND table_type='BASE TABLE' LOOP
 EXECUTE format('ALTER TABLE %I.carr_role_templates ADD COLUMN IF NOT EXISTS draft_content text',t.table_schema);
END LOOP; END $$;
