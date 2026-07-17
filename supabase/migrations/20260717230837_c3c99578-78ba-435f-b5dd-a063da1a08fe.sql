ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recorded_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aired_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Preenche as novas listas com os valores únicos existentes.
UPDATE public.tasks
   SET recorded_dates = jsonb_build_array(to_char(recorded_at, 'YYYY-MM-DD'))
 WHERE recorded_at IS NOT NULL
   AND (recorded_dates IS NULL OR jsonb_array_length(recorded_dates) = 0);

UPDATE public.tasks
   SET aired_dates = jsonb_build_array(to_char(aired_at, 'YYYY-MM-DD'))
 WHERE aired_at IS NOT NULL
   AND (aired_dates IS NULL OR jsonb_array_length(aired_dates) = 0);