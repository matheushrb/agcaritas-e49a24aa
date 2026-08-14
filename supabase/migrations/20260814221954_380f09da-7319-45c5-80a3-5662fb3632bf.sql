-- 1. BRIEFINGS POR PROJETO
CREATE TABLE public.project_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Briefing',
  template_id uuid REFERENCES public.briefing_templates(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_briefings TO authenticated;
GRANT ALL ON public.project_briefings TO service_role;
ALTER TABLE public.project_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage project_briefings" ON public.project_briefings
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_project_briefings_updated BEFORE UPDATE ON public.project_briefings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_project_briefings_project ON public.project_briefings(project_id);

INSERT INTO public.project_briefings (organization_id, project_id, title, template_id, data, status)
SELECT p.organization_id, p.id, 'Briefing principal', p.briefing_template_id, COALESCE(p.briefing, '{}'::jsonb), 'draft'
FROM public.projects p
WHERE p.briefing IS NOT NULL AND p.briefing::text NOT IN ('{}', 'null');

-- 2. CONTAS BANCÁRIAS / CAIXAS
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text,
  kind text NOT NULL DEFAULT 'bank',
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage financial_accounts" ON public.financial_accounts
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_financial_accounts_updated BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. EXTRATO / BAIXAS
CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  direction text NOT NULL DEFAULT 'in',
  description text NOT NULL DEFAULT '',
  category text,
  payment_method text,
  reconciled boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage financial_entries" ON public.financial_entries
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
CREATE TRIGGER trg_financial_entries_updated BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_financial_entries_account_date ON public.financial_entries(account_id, entry_date);
CREATE INDEX idx_financial_entries_charge ON public.financial_entries(charge_id);

-- 4. LANÇAMENTOS MAIS COMPLETOS
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_no integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS document_number text;

-- 5. PLANO DE CONTAS
ALTER TABLE public.finance_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dre_group text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;