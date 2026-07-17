ALTER TABLE public.charges 
  ADD COLUMN IF NOT EXISTS parent_charge_id uuid REFERENCES public.charges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deliverable_id text;

CREATE INDEX IF NOT EXISTS idx_charges_parent ON public.charges(parent_charge_id);