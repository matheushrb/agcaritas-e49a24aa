CREATE TABLE public.project_strategy_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_strategy_docs TO authenticated;
GRANT ALL ON public.project_strategy_docs TO service_role;

ALTER TABLE public.project_strategy_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_strategy_docs_org ON public.project_strategy_docs
  FOR ALL TO authenticated
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE TRIGGER trg_project_strategy_docs_updated_at
  BEFORE UPDATE ON public.project_strategy_docs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_project_strategy_docs_project ON public.project_strategy_docs(project_id);

-- Tipo de projeto: Campanha Eleitoral + tarefas-base
WITH org AS (
  SELECT '96a87ca3-0499-48c1-ae95-e9f10c056c69'::uuid AS id
), new_types AS (
  INSERT INTO public.task_types (organization_id, name, description, color, icon, default_billing_model, has_tech_sheet)
  SELECT org.id, t.name, t.description, t.color, t.icon, 'per_task', t.tech
  FROM org, (VALUES
    ('Peça de Feed', 'Arte estática ou carrossel para feed', '#2F6BEF', 'Image', false),
    ('Story', 'Peça vertical para stories', '#8B5CF6', 'Smartphone', false),
    ('Corte de Vídeo', 'Corte curto para redes a partir de material bruto', '#EF4444', 'Scissors', true),
    ('Cobertura de Agenda', 'Cobertura de evento, caminhada ou reunião', '#F59E0B', 'Camera', true),
    ('Material Impresso', 'Santinho, adesivo, bandeira, panfleto', '#0EA5E9', 'Printer', true),
    ('Criativo de Tráfego', 'Criativo para campanha de mídia paga', '#10B981', 'Megaphone', false),
    ('Jingle / Áudio', 'Produção de jingle, spot ou áudio para redes', '#EC4899', 'Music', true),
    ('Resposta Rápida (Crise)', 'Peça ou nota de resposta rápida', '#DC2626', 'ShieldAlert', false)
  ) AS t(name, description, color, icon, tech)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.task_types tt WHERE tt.organization_id = org.id AND tt.name = t.name
  )
  RETURNING id, name
)
INSERT INTO public.project_types (organization_id, name, slug, color, icon, description, sort_order, active, base_tasks)
SELECT
  org.id,
  'Campanha Eleitoral',
  'electoral',
  '#1D4ED8',
  'Vote',
  'Pré-campanha, campanha, reta final e prestação de contas — com regras de compliance eleitoral.',
  9,
  true,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('task_type_id', id)) FROM new_types), '[]'::jsonb)
FROM org
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_types pt WHERE pt.organization_id = org.id AND pt.slug = 'electoral'
);