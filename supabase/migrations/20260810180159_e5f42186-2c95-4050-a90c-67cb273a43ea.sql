CREATE TYPE public.hr_comp_kind AS ENUM ('raise','promotion','bonus','adjustment');
CREATE TYPE public.hr_comp_status AS ENUM ('planned','approved','paid','cancelled');

CREATE TABLE public.hr_compensation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  kind public.hr_comp_kind NOT NULL DEFAULT 'raise',
  status public.hr_comp_status NOT NULL DEFAULT 'approved',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  previous_salary numeric,
  new_salary numeric,
  amount numeric,
  previous_role text,
  new_role text,
  previous_level text,
  new_level text,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_compensation_events TO authenticated;
GRANT ALL ON public.hr_compensation_events TO service_role;

ALTER TABLE public.hr_compensation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage compensation events"
ON public.hr_compensation_events FOR ALL TO authenticated
USING (organization_id = public.current_organization_id())
WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_hr_comp_events_updated_at
BEFORE UPDATE ON public.hr_compensation_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_hr_comp_events_member ON public.hr_compensation_events(member_id, effective_date DESC);

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS bank_info text,
  ADD COLUMN IF NOT EXISTS salary_review_months integer,
  ADD COLUMN IF NOT EXISTS last_review_on date;