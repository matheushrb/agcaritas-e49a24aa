REVOKE SELECT ON public.proposals FROM anon;
REVOKE SELECT ON public.proposal_items FROM anon;
DROP POLICY IF EXISTS "Public read proposals via token" ON public.proposals;
DROP POLICY IF EXISTS "Public approve/decline proposal" ON public.proposals;
DROP POLICY IF EXISTS "Public read via proposal token" ON public.proposal_items;

CREATE OR REPLACE FUNCTION public.get_public_proposal(p_token uuid)
RETURNS TABLE (
  id uuid,
  doc_number text,
  number text,
  status proposal_status,
  total_value numeric,
  billing_model billing_model,
  items jsonb,
  valid_until date,
  created_at timestamptz,
  title text,
  scope_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.proposals p
     SET status = 'viewed', viewed_at = now()
   WHERE p.public_token = p_token AND p.status = 'sent';

  RETURN QUERY
  SELECT p.id, p.doc_number, p.number, p.status, p.total_value, p.billing_model,
         p.items, p.valid_until, p.created_at, p.title, p.scope_text
    FROM public.proposals p
   WHERE p.public_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_public_proposal(
  p_token uuid, p_action text, p_name text, p_email text, p_notes text default null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status proposal_status;
BEGIN
  IF p_action NOT IN ('approve','decline') THEN
    RAISE EXCEPTION 'Ação inválida: %', p_action;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.proposals
       SET status = 'approved', approved_at = now(),
           approved_by_name = p_name, approved_by_email = p_email,
           approval_notes = p_notes
     WHERE public_token = p_token
       AND status IN ('sent','viewed')
       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
     RETURNING status INTO v_status;
  ELSE
    UPDATE public.proposals
       SET status = 'declined', declined_at = now(), decline_reason = p_notes
     WHERE public_token = p_token
       AND status IN ('sent','viewed')
       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
     RETURNING status INTO v_status;
  END IF;

  IF v_status IS NULL THEN
    SELECT status INTO v_status FROM public.proposals WHERE public_token = p_token;
  END IF;

  RETURN v_status::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_public_proposal(uuid, text, text, text, text) TO anon, authenticated;