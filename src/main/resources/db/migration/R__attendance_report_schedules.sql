CREATE TABLE IF NOT EXISTS public.attendance_report_schedules (
    id bigserial PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    frequency varchar(12) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    day_of_week smallint,
    day_of_month smallint,
    send_at time NOT NULL,
    time_zone varchar(64) NOT NULL DEFAULT 'Asia/Dubai',
    recipient_employee_ids text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    last_run_date date,
    last_run_at timestamptz,
    last_run_status varchar(12),
    last_run_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_attendance_report_weekday CHECK (day_of_week IS NULL OR day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_attendance_report_monthday CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31)
);

CREATE INDEX IF NOT EXISTS idx_attendance_report_schedules_due
    ON public.attendance_report_schedules (enabled, company_id);
