
-- 1. Extend clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'pj',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Extend contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS object text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_day integer,
  ADD COLUMN IF NOT EXISTS total_value numeric(12,2) DEFAULT 0;

-- 3. Extend charges
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'income',
  ADD COLUMN IF NOT EXISTS category text;

-- ==== NEW TABLES ====

-- client_contacts
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_contacts_org ON public.client_contacts FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_client_contacts BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  tax_id text,
  legal_name text,
  email text,
  phone text,
  whatsapp text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_org ON public.suppliers FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_suppliers BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- goals
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  target_value numeric(14,2) NOT NULL DEFAULT 0,
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'BRL',
  period text DEFAULT 'monthly',
  start_date date,
  end_date date,
  auto_calculate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_org ON public.goals FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_goals BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_entries_org ON public.time_entries FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_time_entries BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- content_items
CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  platform text,
  content_type text,
  publish_date date,
  publish_time time,
  status text NOT NULL DEFAULT 'idea',
  copy_text text,
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  approval_token uuid UNIQUE DEFAULT gen_random_uuid(),
  approved_at timestamptz,
  approved_by_name text,
  approved_by_email text,
  notes text,
  grid_order integer DEFAULT 0,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT SELECT ON public.content_items TO anon;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_items_org ON public.content_items FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
-- Public read by token
CREATE POLICY content_items_public_token ON public.content_items FOR SELECT TO anon
  USING (approval_token IS NOT NULL);
-- Public update (only approval fields) via token
CREATE POLICY content_items_public_approve ON public.content_items FOR UPDATE TO anon
  USING (approval_token IS NOT NULL)
  WITH CHECK (approval_token IS NOT NULL);
CREATE TRIGGER set_updated_content_items BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_swot
CREATE TABLE IF NOT EXISTS public.project_swot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quadrant text NOT NULL,
  content text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_swot TO authenticated;
GRANT ALL ON public.project_swot TO service_role;
ALTER TABLE public.project_swot ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_swot_org ON public.project_swot FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_project_swot BEFORE UPDATE ON public.project_swot
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_personas
CREATE TABLE IF NOT EXISTS public.project_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  age integer,
  role text,
  pains jsonb DEFAULT '[]'::jsonb,
  desires jsonb DEFAULT '[]'::jsonb,
  channels jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_personas TO authenticated;
GRANT ALL ON public.project_personas TO service_role;
ALTER TABLE public.project_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_personas_org ON public.project_personas FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_project_personas BEFORE UPDATE ON public.project_personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- internal_campaigns
CREATE TABLE IF NOT EXISTS public.internal_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text,
  channel text,
  start_date date,
  end_date date,
  budget numeric(12,2) DEFAULT 0,
  expected_result text,
  status text NOT NULL DEFAULT 'planning',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_campaigns TO authenticated;
GRANT ALL ON public.internal_campaigns TO service_role;
ALTER TABLE public.internal_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY internal_campaigns_org ON public.internal_campaigns FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_internal_campaigns BEFORE UPDATE ON public.internal_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- idea_bank
CREATE TABLE IF NOT EXISTS public.idea_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  platform text,
  status text NOT NULL DEFAULT 'idea',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_bank TO authenticated;
GRANT ALL ON public.idea_bank TO service_role;
ALTER TABLE public.idea_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY idea_bank_org ON public.idea_bank FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_idea_bank BEFORE UPDATE ON public.idea_bank
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  payment_method text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_org ON public.invoices FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER set_updated_invoices BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- approval_comments
CREATE TABLE IF NOT EXISTS public.approval_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  comment text NOT NULL,
  commenter_name text,
  commenter_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_comments TO authenticated;
GRANT SELECT, INSERT ON public.approval_comments TO anon;
GRANT ALL ON public.approval_comments TO service_role;
ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_comments_org ON public.approval_comments FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY approval_comments_public_insert ON public.approval_comments FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_item_id AND ci.approval_token IS NOT NULL AND ci.organization_id = approval_comments.organization_id)
  );
