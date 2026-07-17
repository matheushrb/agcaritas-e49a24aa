CREATE TYPE public.task_stage AS ENUM ('briefing', 'creation', 'review', 'approval', 'delivery');
ALTER TABLE public.tasks ADD COLUMN stage public.task_stage NOT NULL DEFAULT 'creation';
COMMENT ON COLUMN public.tasks.stage IS 'Etapa do workflow de produção da tarefa (inspiração: ClickUp/Monday)';
