create table public.lead_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null,
  meeting_date date,
  meeting_time text,
  status text not null default 'scheduled',
  notes text,
  conclusions text,
  next_steps text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.lead_meetings to authenticated;
grant all on public.lead_meetings to service_role;

alter table public.lead_meetings enable row level security;

create policy "Members manage own org lead_meetings" on public.lead_meetings for all
  to authenticated
  using (organization_id = current_organization_id())
  with check (organization_id = current_organization_id());

create index idx_lead_meetings_lead on public.lead_meetings(lead_id);

create trigger trg_lead_meetings_updated
  before update on public.lead_meetings
  for each row execute function public.set_updated_at();