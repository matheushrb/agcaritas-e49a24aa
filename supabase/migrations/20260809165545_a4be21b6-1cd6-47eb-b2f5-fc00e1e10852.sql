alter table public.leads add column if not exists sectors jsonb not null default '[]'::jsonb;

create table public.lead_stakeholders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  role text,
  role_type text,
  phone text,
  email text,
  channel text,
  notes text,
  is_main_contact boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.lead_stakeholders to authenticated;
grant all on public.lead_stakeholders to service_role;

alter table public.lead_stakeholders enable row level security;

create policy "Members manage own org lead_stakeholders" on public.lead_stakeholders for all
  to authenticated
  using (organization_id = current_organization_id())
  with check (organization_id = current_organization_id());

create index idx_lead_stakeholders_lead on public.lead_stakeholders(lead_id);