create table public.strategic_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  tools jsonb not null default '["swot","roadmap","personas","kpis","actions"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_plans to authenticated;
grant all on public.strategic_plans to service_role;
alter table public.strategic_plans enable row level security;
create policy "org members manage strategic_plans" on public.strategic_plans for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create trigger trg_strategic_plans_updated before update on public.strategic_plans for each row execute function public.set_updated_at();

create table public.strategic_swot_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  quadrant text not null,
  description text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_swot_items to authenticated;
grant all on public.strategic_swot_items to service_role;
alter table public.strategic_swot_items enable row level security;
create policy "org members manage strategic_swot_items" on public.strategic_swot_items for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

create table public.strategic_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  title text not null,
  description text,
  target_quarter text,
  category text,
  status text not null default 'planned',
  start_date date,
  end_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_roadmap_items to authenticated;
grant all on public.strategic_roadmap_items to service_role;
alter table public.strategic_roadmap_items enable row level security;
create policy "org members manage strategic_roadmap_items" on public.strategic_roadmap_items for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

create table public.strategic_personas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  name text not null,
  age_range text,
  gender text,
  location text,
  occupation text,
  avatar_color text,
  fictional_quote text,
  bio text,
  goals jsonb not null default '[]'::jsonb,
  pains jsonb not null default '[]'::jsonb,
  motivations jsonb not null default '[]'::jsonb,
  preferred_channels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_personas to authenticated;
grant all on public.strategic_personas to service_role;
alter table public.strategic_personas enable row level security;
create policy "org members manage strategic_personas" on public.strategic_personas for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

create table public.strategic_kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  name text not null,
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  category text,
  period text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_kpis to authenticated;
grant all on public.strategic_kpis to service_role;
alter table public.strategic_kpis enable row level security;
create policy "org members manage strategic_kpis" on public.strategic_kpis for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

create table public.strategic_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  title text not null,
  responsible text,
  due_date date,
  status text not null default 'todo',
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.strategic_actions to authenticated;
grant all on public.strategic_actions to service_role;
alter table public.strategic_actions enable row level security;
create policy "org members manage strategic_actions" on public.strategic_actions for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());