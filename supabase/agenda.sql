create extension if not exists btree_gist;
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  mecanico text not null check (mecanico in ('Fabio','Gustavo','Cortez')),
  inicio timestamp without time zone not null,
  fim timestamp without time zone not null,
  cliente text not null,
  veiculo text not null,
  telefone text,
  servico text not null,
  observacoes text,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  constraint agenda_uma_hora check (fim = inicio + interval '1 hour'),
  constraint agenda_dia_util check (extract(isodow from inicio) between 1 and 5),
  constraint agenda_horario check (inicio::time in ('08:30','09:30','10:30','14:00','15:00','16:00','17:00')),
  constraint agenda_sem_sobreposicao exclude using gist (mecanico with =, tsrange(inicio,fim,'[)') with &&)
);
alter table public.agendamentos enable row level security;
grant select,insert,update,delete on public.agendamentos to authenticated;
drop policy if exists "agenda autenticada" on public.agendamentos;
create policy "agenda autenticada" on public.agendamentos for all to authenticated using (true) with check (true);
create index if not exists agendamentos_inicio_idx on public.agendamentos(inicio);

