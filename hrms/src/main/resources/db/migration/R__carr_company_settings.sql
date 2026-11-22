-- Apply before activating a production JAR that validates this entity.
CREATE TABLE IF NOT EXISTS public.carr_company_settings (
 company_id bigint PRIMARY KEY REFERENCES public.companies(id),
 review_frequency varchar(30) NOT NULL DEFAULT 'Quarterly'
   CHECK (review_frequency IN ('Monthly','Quarterly','Half-Yearly','Yearly')),
 version bigint NOT NULL DEFAULT 0
);
-- Table may be created by the deployment administrator rather than the application role.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cloudhrms_user') THEN
  GRANT SELECT,INSERT,UPDATE ON public.carr_company_settings TO cloudhrms_user;
 END IF;
END $$;
