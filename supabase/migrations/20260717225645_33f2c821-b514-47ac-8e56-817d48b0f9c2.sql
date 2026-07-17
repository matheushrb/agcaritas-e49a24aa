
ALTER TABLE public.task_types
  ADD COLUMN IF NOT EXISTS has_broadcast boolean NOT NULL DEFAULT false;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS broadcast_kind text CHECK (broadcast_kind IN ('premiere','live','recorded')),
  ADD COLUMN IF NOT EXISTS recorded_at date,
  ADD COLUMN IF NOT EXISTS aired_at date;
