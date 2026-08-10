ALTER TABLE public.task_type_stages
  ADD COLUMN IF NOT EXISTS auto_subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS start_offset_days integer,
  ADD COLUMN IF NOT EXISTS end_offset_days integer;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stage_started_on date,
  ADD COLUMN IF NOT EXISTS stage_due_on date;

CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON public.tasks(parent_task_id);