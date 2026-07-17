
-- Aperta a política de UPDATE público: só linhas pendentes e dentro da validade
DROP POLICY IF EXISTS "Public approve/decline proposal" ON public.proposals;
CREATE POLICY "Public approve/decline proposal"
ON public.proposals FOR UPDATE TO anon
USING (
  status IN ('sent','viewed')
  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
)
WITH CHECK (
  status IN ('viewed','approved','declined')
);

-- Bloqueia execução direta das funções de numeração (só o trigger executa)
REVOKE EXECUTE ON FUNCTION public.assign_proposal_doc_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_invoice_number() FROM PUBLIC, anon, authenticated;
