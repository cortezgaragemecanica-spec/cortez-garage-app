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
  constraint agenda_dia_util check (extract(isodow from inicio) between 1 and 5),
  constraint agenda_sem_sobreposicao exclude using gist (mecanico with =, tsrange(inicio,fim,'[)') with &&)
);
alter table public.agendamentos add column if not exists status text not null default 'Agendado' check (status in ('Agendado','Concluído'));
alter table public.agendamentos add column if not exists concluido_por uuid references auth.users(id);
alter table public.agendamentos add column if not exists concluido_em timestamptz;
alter table public.agendamentos drop constraint if exists agenda_uma_hora;
alter table public.agendamentos drop constraint if exists agenda_horario;
alter table public.agendamentos drop constraint if exists agenda_duracao_valida;
alter table public.agendamentos add constraint agenda_horario check (inicio::time in ('08:30','09:30','10:30','11:30','14:00','15:00','16:00','17:00'));
alter table public.agendamentos add constraint agenda_duracao_valida check (
  fim > inicio and inicio::date=fim::date and
  ((inicio::time >= '08:30' and fim::time <= '12:00') or
   (inicio::time >= '14:00' and fim::time <= '18:00') or
   (inicio::time >= '08:30' and inicio::time < '12:00' and fim::time > '14:00' and fim::time <= '18:00'))
);
alter table public.agendamentos enable row level security;
revoke insert,update,delete on public.agendamentos from authenticated;
grant select,insert on public.agendamentos to authenticated;
grant update(status,concluido_por,concluido_em) on public.agendamentos to authenticated;
drop policy if exists "agenda autenticada" on public.agendamentos;
drop policy if exists "agenda leitura" on public.agendamentos;
drop policy if exists "agenda proprietario insere" on public.agendamentos;
drop policy if exists "agenda equipe conclui" on public.agendamentos;
create policy "agenda leitura" on public.agendamentos for select to authenticated using (true);
create policy "agenda proprietario insere" on public.agendamentos for insert to authenticated with check (lower(auth.jwt()->>'email')='cortezgaragemecanica@gmail.com');
create policy "agenda equipe conclui" on public.agendamentos for update to authenticated using (true) with check (true);
create index if not exists agendamentos_inicio_idx on public.agendamentos(inicio);

create or replace function public.owner_save_agendamento(
  p_id uuid,p_mecanico text,p_inicio timestamp,p_fim timestamp,p_cliente text,p_veiculo text,
  p_telefone text,p_servico text,p_observacoes text
) returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid;
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'cortezgaragemecanica@gmail.com' then raise exception 'Apenas o proprietário pode salvar agendamentos'; end if;
  if p_id is null then
    insert into public.agendamentos(mecanico,inicio,fim,cliente,veiculo,telefone,servico,observacoes,criado_por)
    values(p_mecanico,p_inicio,p_fim,p_cliente,p_veiculo,p_telefone,p_servico,p_observacoes,auth.uid()) returning id into result_id;
  else
    update public.agendamentos set mecanico=p_mecanico,inicio=p_inicio,fim=p_fim,cliente=p_cliente,veiculo=p_veiculo,
      telefone=p_telefone,servico=p_servico,observacoes=p_observacoes where id=p_id returning id into result_id;
  end if;
  return result_id;
end $$;
create or replace function public.owner_delete_agendamento(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'cortezgaragemecanica@gmail.com' then raise exception 'Apenas o proprietário pode excluir agendamentos'; end if;
  delete from public.agendamentos where id=p_id;
end $$;
revoke all on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) from public;
revoke all on function public.owner_delete_agendamento(uuid) from public;
grant execute on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) to authenticated;
grant execute on function public.owner_delete_agendamento(uuid) to authenticated;
