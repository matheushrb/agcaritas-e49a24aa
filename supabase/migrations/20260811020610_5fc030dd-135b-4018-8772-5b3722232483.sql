WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY task_type_id ORDER BY "order", created_at) - 1 AS rn
  FROM public.task_type_stages
)
UPDATE public.task_type_stages s
SET "order" = r.rn
FROM ranked r
WHERE s.id = r.id AND s."order" IS DISTINCT FROM r.rn;