ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON public.projects (organization_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON public.tasks (organization_id, archived_at);