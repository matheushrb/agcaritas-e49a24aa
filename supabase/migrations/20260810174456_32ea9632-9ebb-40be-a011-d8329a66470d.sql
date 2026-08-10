create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  nature text not null check (nature in ('revenue','expense')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.finance_categories to authenticated;
grant all on public.finance_categories to service_role;
alter table public.finance_categories enable row level security;
create policy "Members manage own org finance_categories" on public.finance_categories for all
  to authenticated using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());

create unique index finance_categories_org_name_nature_idx on public.finance_categories (organization_id, name, nature);

create table public.recurring_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null,
  amount numeric not null,
  nature text not null check (nature in ('revenue','expense')),
  category text,
  day_of_month integer not null check (day_of_month between 1 and 28),
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  collaborator_id uuid references public.team_members(id) on delete set null,
  payment_method text,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  last_generated_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recurring_charges to authenticated;
grant all on public.recurring_charges to service_role;
alter table public.recurring_charges enable row level security;
create policy "Members manage own org recurring_charges" on public.recurring_charges for all
  to authenticated using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());

create trigger set_updated_recurring_charges before update on public.recurring_charges
  for each row execute function public.set_updated_at();

alter table public.charges add column if not exists recurring_charge_id uuid references public.recurring_charges(id) on delete set null;

alter table public.charges add constraint charges_collaborator_id_fkey foreign key (collaborator_id) references public.team_members(id) on delete set null;

alter table public.team_members add column if not exists payment_day integer check (payment_day between 1 and 28);

create or replace function public.ensure_recurring_charges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  gen_month date;
  today date := current_date;
  created_count integer := 0;
  due_date date;
begin
  for r in
    select * from public.recurring_charges
    where active = true
      and organization_id = current_organization_id()
      and start_date <= today
      and (end_date is null or end_date >= today)
  loop
    gen_month := coalesce(r.last_generated_month, (date_trunc('month', r.start_date)::date - interval '1 month')::date);
    while gen_month < date_trunc('month', today)::date loop
      gen_month := (gen_month + interval '1 month')::date;
      due_date := least(
        (date_trunc('month', gen_month) + (r.day_of_month - 1) * interval '1 day')::date,
        (date_trunc('month', gen_month) + interval '1 month' - interval '1 day')::date
      );
      insert into public.charges (
        organization_id, description, amount, status, nature, category,
        due_date, competence_month, client_id, project_id, collaborator_id,
        payment_method, recurring_charge_id
      ) values (
        r.organization_id, r.description, r.amount, 'pending', r.nature, r.category,
        due_date, date_trunc('month', gen_month)::date, r.client_id, r.project_id, r.collaborator_id,
        r.payment_method, r.id
      );
      created_count := created_count + 1;
    end loop;
    update public.recurring_charges set last_generated_month = date_trunc('month', today)::date, updated_at = now() where id = r.id;
  end loop;
  return created_count;
end;
$$;

grant execute on function public.ensure_recurring_charges() to authenticated;

insert into public.finance_categories (organization_id, name, nature)
select o.id, c.name, c.nature
from public.organizations o
cross join (values
  ('Mensalidade','revenue'), ('Projeto','revenue'), ('Tráfego pago','revenue'), ('Produção','revenue'), ('Consultoria','revenue'), ('Outros','revenue'),
  ('Pessoal','expense'), ('Freelancer','expense'), ('Fornecedores','expense'), ('Ferramentas','expense'), ('Marketing','expense'), ('Impostos','expense'), ('Outros','expense'),
  ('Salário','expense'), ('13º salário','expense'), ('Férias','expense'), ('FGTS','expense'), ('INSS','expense'), ('Prêmio/Bônus','expense'), ('Abono','expense'), ('Rescisão','expense')
) as c(name, nature)
on conflict do nothing;