
CREATE TYPE public.calendar_block_kind AS ENUM ('ferias','folga','bloqueio','feriado');

CREATE TABLE public.calendar_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.calendar_block_kind NOT NULL DEFAULT 'bloqueio',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  all_day boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_blocks_range_ok CHECK (end_date >= start_date)
);

CREATE INDEX idx_calendar_blocks_user_range ON public.calendar_blocks(user_id, start_date, end_date);
CREATE INDEX idx_calendar_blocks_org ON public.calendar_blocks(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_blocks TO authenticated;
GRANT ALL ON public.calendar_blocks TO service_role;

ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Todos da organização podem ver os bloqueios (para não marcar reuniões/tarefas)
CREATE POLICY "org members can view blocks"
ON public.calendar_blocks FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Apenas o próprio usuário gerencia seus bloqueios
CREATE POLICY "users manage own blocks"
ON public.calendar_blocks FOR ALL TO authenticated
USING (user_id = auth.uid() AND organization_id = public.current_organization_id())
WITH CHECK (user_id = auth.uid() AND organization_id = public.current_organization_id());

CREATE TRIGGER trg_calendar_blocks_updated_at
BEFORE UPDATE ON public.calendar_blocks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: verifica se usuário está bloqueado numa data
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid, _date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_blocks
    WHERE user_id = _user_id
      AND _date BETWEEN start_date AND end_date
  )
$$;
