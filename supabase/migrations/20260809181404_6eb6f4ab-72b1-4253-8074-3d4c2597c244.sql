alter table public.leads add column if not exists is_favorite boolean not null default false;
alter table public.leads add column if not exists interests jsonb not null default '[]'::jsonb;