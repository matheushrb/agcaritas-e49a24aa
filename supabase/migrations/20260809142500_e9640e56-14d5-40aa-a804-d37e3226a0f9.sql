ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.project_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_contact_at date;