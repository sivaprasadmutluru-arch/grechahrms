CREATE TABLE IF NOT EXISTS public.smart_performance_documents (
    company_id bigint NOT NULL REFERENCES public.companies(id),
    kind varchar(20) NOT NULL CHECK (kind IN ('settings','employee','library')),
    document_key varchar(80) NOT NULL,
    revision bigint NOT NULL CHECK (revision > 0),
    payload jsonb NOT NULL,
    PRIMARY KEY (company_id, kind, document_key)
);

CREATE TABLE IF NOT EXISTS public.smart_performance_reminders (
    company_id bigint NOT NULL REFERENCES public.companies(id),
    employee_id bigint NOT NULL,
    reminder_key varchar(120) NOT NULL,
    PRIMARY KEY (company_id, employee_id, reminder_key)
);
