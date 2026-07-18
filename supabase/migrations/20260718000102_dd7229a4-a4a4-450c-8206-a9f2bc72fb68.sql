
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS bank_info text;

DROP POLICY IF EXISTS org_update_own ON public.organizations;
CREATE POLICY org_update_own ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_organization_id())
  WITH CHECK (id = public.current_organization_id());
