DO $$ BEGIN
  CREATE TYPE public.hr_contract_type AS ENUM ('internal','freelancer_task','freelancer_hour','contractor','company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS contract_type public.hr_contract_type NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS admitted_on date,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS hr_notes text,
  ADD COLUMN IF NOT EXISTS company_legal_name text,
  ADD COLUMN IF NOT EXISTS company_tax_id text,
  ADD COLUMN IF NOT EXISTS company_contact text;

UPDATE public.team_members SET contract_type = CASE cost_mode
  WHEN 'internal_fixed' THEN 'internal'::public.hr_contract_type
  WHEN 'freelancer_per_task' THEN 'freelancer_task'::public.hr_contract_type
  WHEN 'freelancer_per_hour' THEN 'freelancer_hour'::public.hr_contract_type
  ELSE 'contractor'::public.hr_contract_type END;