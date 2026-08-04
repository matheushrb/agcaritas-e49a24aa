ALTER TABLE public.task_types
  ADD COLUMN IF NOT EXISTS has_tech_sheet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_live boolean NOT NULL DEFAULT false;

UPDATE public.task_types
SET has_live = true, has_tech_sheet = true
WHERE lower(replace(replace(name, '_', ' '), '-', ' ')) LIKE '%aula%online%';