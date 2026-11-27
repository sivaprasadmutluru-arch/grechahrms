CREATE TABLE IF NOT EXISTS public.attendance_auto_checkout_settings (
    head_office_id bigint PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    enabled_since timestamptz
);
