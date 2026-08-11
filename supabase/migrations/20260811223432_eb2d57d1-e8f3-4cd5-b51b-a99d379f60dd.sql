ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS strategy jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.project_benchmarks ADD COLUMN IF NOT EXISTS positioning text;
ALTER TABLE public.project_benchmarks ADD COLUMN IF NOT EXISTS threat_level text NOT NULL DEFAULT 'Média';

ALTER TABLE public.project_personas ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.project_personas ADD COLUMN IF NOT EXISTS help text;

CREATE TABLE IF NOT EXISTS public.project_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_value numeric,
  current_value numeric NOT NULL DEFAULT 0,
  unit text,
  period text,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_kpis TO authenticated;
GRANT ALL ON public.project_kpis TO service_role;

ALTER TABLE public.project_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_kpis_org" ON public.project_kpis
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER set_updated_project_kpis BEFORE UPDATE ON public.project_kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_project_kpis_project ON public.project_kpis(project_id);