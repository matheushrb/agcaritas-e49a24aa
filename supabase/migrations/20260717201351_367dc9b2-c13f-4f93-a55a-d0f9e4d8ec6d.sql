-- Enum for macro status groups
DO $$ BEGIN
  CREATE TYPE public.stage_status_group AS ENUM ('todo','in_progress','review','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- task_types
CREATE TABLE public.task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3B82F6',
  icon text,
  default_billing_model text,
  default_price numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_types TO authenticated;
GRANT ALL ON public.task_types TO service_role;

ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_types org access" ON public.task_types
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_task_types_updated
  BEFORE UPDATE ON public.task_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- task_type_stages
CREATE TABLE public.task_type_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_id uuid NOT NULL REFERENCES public.task_types(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#94A3B8',
  status_group public.stage_status_group NOT NULL DEFAULT 'todo',
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_type_stages_type_idx ON public.task_type_stages(task_type_id, "order");

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_type_stages TO authenticated;
GRANT ALL ON public.task_type_stages TO service_role;

ALTER TABLE public.task_type_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_type_stages org access" ON public.task_type_stages
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_task_type_stages_updated
  BEFORE UPDATE ON public.task_type_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type_id uuid REFERENCES public.task_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES public.task_type_stages(id) ON DELETE SET NULL;
