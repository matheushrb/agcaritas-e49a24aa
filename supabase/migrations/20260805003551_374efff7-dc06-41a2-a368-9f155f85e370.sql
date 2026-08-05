-- ============ BRIEFING TEMPLATES ============
CREATE TABLE public.briefing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  template_type text NOT NULL DEFAULT 'briefing',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_templates TO authenticated;
GRANT ALL ON public.briefing_templates TO service_role;
ALTER TABLE public.briefing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage briefing templates" ON public.briefing_templates
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_briefing_templates_updated BEFORE UPDATE ON public.briefing_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PIPELINE STAGES ============
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#64748B',
  default_probability integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage pipeline stages" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_pipeline_stages_updated BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEAD ACTIVITIES ============
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  notes text,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage lead activities" ON public.lead_activities
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_lead_activities_updated BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);

-- ============ LEADS EXTRA COLUMNS ============
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS probability integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temperature text,
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS briefing_template_id uuid REFERENCES public.briefing_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS briefing jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============ PROJECTS / TASKS / TASK TYPES ============
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS briefing_template_id uuid REFERENCES public.briefing_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS briefing jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS briefing_template_id uuid REFERENCES public.briefing_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS briefing jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.task_types
  ADD COLUMN IF NOT EXISTS briefing_template_id uuid REFERENCES public.briefing_templates(id) ON DELETE SET NULL;

-- ============ SEED DEFAULT PIPELINE STAGES PER ORG ============
INSERT INTO public.pipeline_stages (organization_id, name, sort_order, color, default_probability, is_won, is_lost)
SELECT o.id, s.name, s.ord, s.color, s.prob, s.won, s.lost
FROM public.organizations o
CROSS JOIN (VALUES
  ('Lead', 0, '#64748B', 10, false, false),
  ('Contato', 1, '#3B82F6', 25, false, false),
  ('Proposta', 2, '#8B5CF6', 50, false, false),
  ('Negociação', 3, '#F59E0B', 75, false, false),
  ('Ganho', 4, '#10B981', 100, true, false),
  ('Perdido', 5, '#EF4444', 0, false, true)
) AS s(name, ord, color, prob, won, lost)
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages ps WHERE ps.organization_id = o.id);

-- map existing lead.stage enum to the new stage rows
UPDATE public.leads l
SET stage_id = ps.id
FROM public.pipeline_stages ps
WHERE ps.organization_id = l.organization_id
  AND l.stage_id IS NULL
  AND ps.sort_order = CASE l.stage
      WHEN 'lead' THEN 0 WHEN 'contact' THEN 1 WHEN 'proposal' THEN 2
      WHEN 'negotiation' THEN 3 WHEN 'closed' THEN 4 ELSE 0 END;