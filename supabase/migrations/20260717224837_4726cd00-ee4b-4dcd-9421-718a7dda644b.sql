
-- Cost mode enum
DO $$ BEGIN
  CREATE TYPE public.team_cost_mode AS ENUM ('internal_fixed','freelancer_per_task','freelancer_per_hour','one_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_cost_kind AS ENUM ('per_task','per_hour','one_off','allocated_internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_cost_status AS ENUM ('pending','confirmed','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS cost_mode public.team_cost_mode NOT NULL DEFAULT 'internal_fixed',
  ADD COLUMN IF NOT EXISTS monthly_salary numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_hours numeric(6,2) DEFAULT 160,
  ADD COLUMN IF NOT EXISTS default_task_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS task_rate_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_notes text;

-- Project costs table
CREATE TABLE IF NOT EXISTS public.project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  kind public.project_cost_kind NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  hours numeric(8,2),
  description text,
  status public.project_cost_status NOT NULL DEFAULT 'pending',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_costs_project ON public.project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_task ON public.project_costs(task_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_member ON public.project_costs(team_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_costs TO authenticated;
GRANT ALL ON public.project_costs TO service_role;

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage project costs"
  ON public.project_costs FOR ALL
  TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_project_costs_updated_at
  BEFORE UPDATE ON public.project_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
