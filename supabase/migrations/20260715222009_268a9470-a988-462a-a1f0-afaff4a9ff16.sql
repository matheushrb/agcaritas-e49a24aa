
-- Extend projects with classification, billing, urgency, budgets, scope flags
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS billing_model text,
  ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS traffic_budget jsonb DEFAULT '{"enabled":false,"platforms":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS other_budgets jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scope_flags jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fixed_value numeric;

-- Action items (Plano de Ação) per project
CREATE TABLE IF NOT EXISTS public.project_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'todo',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_action_items TO authenticated;
GRANT ALL ON public.project_action_items TO service_role;
ALTER TABLE public.project_action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage action items"
  ON public.project_action_items FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER update_project_action_items_updated_at
  BEFORE UPDATE ON public.project_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Benchmarks / concorrência per project
CREATE TABLE IF NOT EXISTS public.project_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  strengths text,
  weaknesses text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_benchmarks TO authenticated;
GRANT ALL ON public.project_benchmarks TO service_role;
ALTER TABLE public.project_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage benchmarks"
  ON public.project_benchmarks FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER update_project_benchmarks_updated_at
  BEFORE UPDATE ON public.project_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
