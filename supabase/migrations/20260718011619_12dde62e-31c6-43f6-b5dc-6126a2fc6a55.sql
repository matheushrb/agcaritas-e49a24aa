
-- 1) Novos campos em organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS bank_pix_key text,
  ADD COLUMN IF NOT EXISTS bank_holder text,
  ADD COLUMN IF NOT EXISTS bank_holder_document text;

-- 2) Trigger não atribui número em rascunho
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ym text; next_seq int;
BEGIN
  -- Rascunho: mantém sem número até ser confirmado
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
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
$function$;

-- Garantir gatilho de UPDATE também (para atribuir número ao confirmar)
DROP TRIGGER IF EXISTS invoices_assign_number_ins ON public.invoices;
DROP TRIGGER IF EXISTS invoices_assign_number_upd ON public.invoices;
CREATE TRIGGER invoices_assign_number_ins
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();
CREATE TRIGGER invoices_assign_number_upd
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW
WHEN (NEW.status <> 'draft' AND (NEW.number IS NULL OR NEW.number = ''))
EXECUTE FUNCTION public.assign_invoice_number();

-- 3) Storage: políticas para bucket agency-branding
DROP POLICY IF EXISTS "org members read branding"     ON storage.objects;
DROP POLICY IF EXISTS "org members upload branding"   ON storage.objects;
DROP POLICY IF EXISTS "org members update branding"   ON storage.objects;
DROP POLICY IF EXISTS "org members delete branding"   ON storage.objects;

-- Convenção: arquivos ficam em "<organization_id>/<arquivo>"
CREATE POLICY "org members read branding"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'agency-branding'
  AND (storage.foldername(name))[1]::uuid = public.current_organization_id()
);

CREATE POLICY "org members upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agency-branding'
  AND (storage.foldername(name))[1]::uuid = public.current_organization_id()
);

CREATE POLICY "org members update branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agency-branding'
  AND (storage.foldername(name))[1]::uuid = public.current_organization_id()
);

CREATE POLICY "org members delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'agency-branding'
  AND (storage.foldername(name))[1]::uuid = public.current_organization_id()
);
