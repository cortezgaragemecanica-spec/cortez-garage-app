create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('Fluxo de caixa','Conta a receber','Conta a pagar')),
  movimento text not null check (movimento in ('Entrada','Saída')),
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'Pendente' check (status in ('Pendente','Realizado')),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

drop trigger if exists lancamentos_financeiros_atualizado on public.lancamentos_financeiros;
create trigger lancamentos_financeiros_atualizado
before update on public.lancamentos_financeiros
for each row execute function public.set_atualizado_em();

alter table public.lancamentos_financeiros enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='lancamentos_financeiros' and policyname='financeiro_authenticated'
  ) then
    create policy financeiro_authenticated on public.lancamentos_financeiros
    for all to authenticated using (true) with check (true);
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.lancamentos_financeiros to authenticated;
grant select, insert, update, delete on public.estoque to authenticated;
grant usage, select on all sequences in schema public to authenticated;


