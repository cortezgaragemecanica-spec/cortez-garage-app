create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('Fluxo de caixa','Conta a receber','Conta a pagar','Comissões')),
  movimento text not null check (movimento in ('Entrada','Saída')),
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'Pendente' check (status in ('Pendente','Realizado')),
  mecanico text,
  forma_pagamento text,
  os_id uuid,
  referencia text,
  semana_inicio date,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

drop trigger if exists lancamentos_financeiros_atualizado on public.lancamentos_financeiros;
create trigger lancamentos_financeiros_atualizado
before update on public.lancamentos_financeiros
for each row execute function public.set_atualizado_em();

alter table public.lancamentos_financeiros enable row level security;

alter table public.lancamentos_financeiros add column if not exists mecanico text;
alter table public.lancamentos_financeiros add column if not exists forma_pagamento text;
alter table public.lancamentos_financeiros add column if not exists os_id uuid;
alter table public.lancamentos_financeiros add column if not exists referencia text;
alter table public.lancamentos_financeiros add column if not exists semana_inicio date;
create unique index if not exists lancamentos_financeiros_referencia_uidx
on public.lancamentos_financeiros(referencia) where referencia is not null;

alter table public.lancamentos_financeiros drop constraint if exists lancamentos_financeiros_categoria_check;
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_categoria_check
check (categoria in ('Fluxo de caixa','Conta a receber','Conta a pagar','Comissões'));

drop policy if exists financeiro_authenticated on public.lancamentos_financeiros;
drop policy if exists financeiro_owner on public.lancamentos_financeiros;
create policy financeiro_owner on public.lancamentos_financeiros
for all to authenticated
using ((auth.jwt() ->> 'email') = 'cortezgaragemecanica@gmail.com')
with check ((auth.jwt() ->> 'email') = 'cortezgaragemecanica@gmail.com');

drop policy if exists financeiro_os_select on public.lancamentos_financeiros;
drop policy if exists financeiro_os_insert on public.lancamentos_financeiros;
drop policy if exists financeiro_os_update on public.lancamentos_financeiros;
create policy financeiro_os_select on public.lancamentos_financeiros
for select to authenticated
using (categoria = 'Conta a receber' and referencia like 'receber-os-%');
create policy financeiro_os_insert on public.lancamentos_financeiros
for insert to authenticated
with check (categoria = 'Conta a receber' and movimento = 'Entrada' and referencia like 'receber-os-%' and os_id is not null);
create policy financeiro_os_update on public.lancamentos_financeiros
for update to authenticated
using (categoria = 'Conta a receber' and referencia like 'receber-os-%')
with check (categoria = 'Conta a receber' and movimento = 'Entrada' and referencia like 'receber-os-%' and os_id is not null);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.lancamentos_financeiros to authenticated;
grant select, insert, update, delete on public.estoque to authenticated;
grant usage, select on all sequences in schema public to authenticated;



