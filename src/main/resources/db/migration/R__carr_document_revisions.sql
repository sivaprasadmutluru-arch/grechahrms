-- Public metadata and every existing tenant; new tenants inherit the entity column during provisioning.
DO $$ DECLARE t record; BEGIN
FOR t IN SELECT table_schema FROM information_schema.tables WHERE table_name='carr_records' AND table_type='BASE TABLE' LOOP
 EXECUTE format('ALTER TABLE %I.carr_records ADD COLUMN IF NOT EXISTS revision_of_id bigint',t.table_schema);
 EXECUTE format('CREATE INDEX IF NOT EXISTS carr_revision_source_idx ON %I.carr_records (company_id,revision_of_id)',t.table_schema);
END LOOP; END $$;
