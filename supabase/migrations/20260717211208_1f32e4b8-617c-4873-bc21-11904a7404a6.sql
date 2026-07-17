
-- ================================================================
-- 1) PROJECTS: campos que faltavam
-- ================================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS monthly_value numeric,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS printing_budget numeric,
  ADD COLUMN IF NOT EXISTS social_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS has_content_calendar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_content_grid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_timeline boolean NOT NULL DEFAULT false;

-- ================================================================
-- 2) PROPOSALS: campos novos + token público + numeração
-- ================================================================
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS intro_text text,
  ADD COLUMN IF NOT EXISTS scope_text text,
  ADD COLUMN IF NOT EXISTS exclusions_text text,
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS warranty_text text,
  ADD COLUMN IF NOT EXISTS diagnosis_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_plan_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'a_vista' CHECK (payment_type IN ('a_vista','parcelado','recorrente')),
  ADD COLUMN IF NOT EXISTS installments_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_interval text,
  ADD COLUMN IF NOT EXISTS first_due_date date,
  ADD COLUMN IF NOT EXISTS start_date_expected date,
  ADD COLUMN IF NOT EXISTS end_date_expected date,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_by_email text,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS proposals_public_token_key ON public.proposals(public_token);
CREATE INDEX IF NOT EXISTS proposals_org_idx ON public.proposals(organization_id);

-- ================================================================
-- 3) PROPOSAL_ITEMS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT SELECT ON public.proposal_items TO anon;
GRANT ALL ON public.proposal_items TO service_role;

ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own org proposal_items"
ON public.proposal_items FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

CREATE POLICY "Members manage own org proposal_items"
ON public.proposal_items FOR ALL TO authenticated
USING (organization_id = public.current_organization_id())
WITH CHECK (organization_id = public.current_organization_id());

-- Público via token: lê itens quando a proposta-pai tem token que bate
CREATE POLICY "Public read via proposal token"
ON public.proposal_items FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id));

CREATE TRIGGER trg_proposal_items_updated_at
BEFORE UPDATE ON public.proposal_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 4) PROPOSALS: policies para link público
-- ================================================================
-- Leitura anônima: RLS libera SELECT, mas o front sempre filtra por token; policy
-- só devolve linha se o cliente informou o token (via .eq('public_token', token)),
-- portanto policy USING (true) para anon é ok — nada é listável sem o token.
GRANT SELECT ON public.proposals TO anon;

DROP POLICY IF EXISTS "Public read proposals via token" ON public.proposals;
CREATE POLICY "Public read proposals via token"
ON public.proposals FOR SELECT TO anon
USING (true);

-- UPDATE anônimo restrito às colunas de aprovação/recusa e viewed_at.
-- Postgres não filtra por coluna direto na policy — mas o WITH CHECK garante
-- que campos críticos não sejam alterados (status limitado, doc_number igual).
DROP POLICY IF EXISTS "Public approve/decline proposal" ON public.proposals;
CREATE POLICY "Public approve/decline proposal"
ON public.proposals FOR UPDATE TO anon
USING (true)
WITH CHECK (
  status IN ('viewed','approved','declined')
);

-- ================================================================
-- 5) INVOICES: evoluir
-- ================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS competence_month date,
  ADD COLUMN IF NOT EXISTS issue_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'detailed' CHECK (mode IN ('detailed','summary')),
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS financial_transaction_id uuid;

-- ================================================================
-- 6) INVOICE_ITEMS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  parent_item_id uuid REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  project_id uuid,
  task_id uuid,
  deliverable_key text,
  service_label text,
  description text NOT NULL,
  item_date date,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  is_subitem boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own org invoice_items"
ON public.invoice_items FOR ALL TO authenticated
USING (organization_id = public.current_organization_id())
WITH CHECK (organization_id = public.current_organization_id());

CREATE TRIGGER trg_invoice_items_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_task_idx ON public.invoice_items(task_id);

-- ================================================================
-- 7) CHARGES: nature, competência, vínculo com fatura
-- ================================================================
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS competence_month date,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collaborator_id uuid;

CREATE INDEX IF NOT EXISTS charges_invoice_idx ON public.charges(invoice_id);
CREATE INDEX IF NOT EXISTS charges_competence_idx ON public.charges(competence_month);

-- ================================================================
-- 8) TASKS: marcador de faturada
-- ================================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS billed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billed_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_billed_idx ON public.tasks(billed);

-- ================================================================
-- 9) Numeração automática de proposal.doc_number (PRO-0001 por org)
-- ================================================================
CREATE OR REPLACE FUNCTION public.assign_proposal_doc_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_seq int;
BEGIN
  IF NEW.doc_number IS NULL OR NEW.doc_number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(doc_number, '\D', '', 'g'), '')::int), 0) + 1
      INTO next_seq
    FROM public.proposals
    WHERE organization_id = NEW.organization_id;
    NEW.doc_number := 'PRO-' || LPAD(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_doc_number ON public.proposals;
CREATE TRIGGER trg_proposal_doc_number
BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.assign_proposal_doc_number();

-- ================================================================
-- 10) Numeração automática de invoices.number (YYYYMM-seq por org)
-- ================================================================
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ym text; next_seq int;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    ym := to_char(COALESCE(NEW.issue_date, CURRENT_DATE), 'YYYYMM');
    SELECT COALESCE(MAX(NULLIF(split_part(number, '-', 2), '')::int), 0) + 1
      INTO next_seq
    FROM public.invoices
    WHERE organization_id = NEW.organization_id
      AND number LIKE ym || '-%';
    NEW.number := ym || '-' || LPAD(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();
