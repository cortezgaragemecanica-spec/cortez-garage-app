-- Visão protegida das comissões da semana para cada mecânico.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.conferencia_comissoes_mecanicos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  email text not null,
  mecanico text not null,
  semana_inicio date not null,
  conferido_em timestamptz not null default now(),
  unique (usuario_id, semana_inicio)
);

alter table public.conferencia_comissoes_mecanicos enable row level security;
revoke all on public.conferencia_comissoes_mecanicos from anon, authenticated;

create or replace function public.mecanico_atual_do_usuario()
returns text language plpgsql stable security definer set search_path = public
as $$
declare
  email_atual text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  usuario jsonb;
  mecanico text;
begin
  select usuarios.item into usuario
  from public.sincronizacao configuracao
  cross join lateral jsonb_array_elements(coalesce(configuracao.dados -> 'users', '[]'::jsonb)) as usuarios(item)
  where configuracao.entidade = 'configuracao'
    and configuracao.registro_id = 'usuarios-permissoes'
    and lower(trim(usuarios.item ->> 'email')) = email_atual
  limit 1;

  if usuario is not null and not coalesce((usuario ->> 'active')::boolean, true) then return null; end if;
  mecanico := nullif(trim(usuario ->> 'agendaMechanic'), '');
  if mecanico is not null then return mecanico; end if;

  return case
    when email_atual in ('gust.cribas@gmail.com', 'gust.ribas@gmail.com', 'gust.ribas@hotmail.com') then 'Gustavo'
    when email_atual = 'fabiomaier19850901@gmail.com' then 'Fabio'
    else null
  end;
end;
$$;

revoke all on function public.mecanico_atual_do_usuario() from public, anon;
grant execute on function public.mecanico_atual_do_usuario() to authenticated;

create or replace function public.comissoes_semana_mecanico()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_semana date;
  fim_semana date;
  mecanico_atual text;
  conferido timestamptz;
  itens jsonb;
  total numeric(12,2);
begin
  inicio_semana := agora_local::date - (extract(isodow from agora_local)::integer - 1);
  fim_semana := inicio_semana + 4;
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;

  select c.conferido_em into conferido
  from public.conferencia_comissoes_mecanicos c
  where c.usuario_id = auth.uid() and c.semana_inicio = inicio_semana limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'date', f.vencimento,
      'orderNumber', lpad(coalesce(o.numero::text, regexp_replace(f.descricao, '^.*#([0-9]+).*$', '\1')), 4, '0'),
      'vehicle', concat_ws(' · ', nullif(v.placa, ''), nullif(v.modelo, '')),
      'service', coalesce(nullif((
        select string_agg(nullif(trim(servico ->> 'description'), ''), ', ')
        from jsonb_array_elements(coalesce(o.dados_extras -> 'budget' -> 'services', '[]'::jsonb)) servico
        where translate(lower(trim(coalesce(nullif(servico ->> 'mechanic', ''), o.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = translate(lower(trim(mecanico_atual)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
          and coalesce(servico ->> 'refused', 'false') <> 'true'
      ), ''), 'Serviço da O.S.'),
      'amount', f.valor,
      'status', f.status
    ) order by f.vencimento desc, o.numero desc), '[]'::jsonb),
    coalesce(sum(f.valor), 0)
  into itens, total
  from public.lancamentos_financeiros f
  left join public.ordens_servico o on o.id = f.os_id
  left join public.veiculos v on v.id = o.veiculo_id
  where f.categoria = 'Comissões'
    and translate(lower(trim(coalesce(f.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = translate(lower(trim(mecanico_atual)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    and coalesce(f.semana_inicio, f.vencimento - (extract(isodow from f.vencimento)::integer - 1)) = inicio_semana;

  return jsonb_build_object(
    'mechanic', mecanico_atual, 'weekStart', inicio_semana, 'weekEnd', fim_semana,
    'total', total, 'items', itens, 'confirmedAt', conferido,
    'canConfirm', conferido is null and extract(isodow from agora_local) = 5
      and agora_local::time >= time '17:00' and agora_local::time <= time '21:00'
      and jsonb_array_length(itens) > 0
  );
end;
$$;

revoke all on function public.comissoes_semana_mecanico() from public, anon;
grant execute on function public.comissoes_semana_mecanico() to authenticated;

create or replace function public.conferir_comissoes_semana_mecanico()
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_semana date;
  mecanico_atual text;
  confirmado timestamptz;
begin
  inicio_semana := agora_local::date - (extract(isodow from agora_local)::integer - 1);
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;
  if extract(isodow from agora_local) <> 5 or agora_local::time < time '17:00' or agora_local::time > time '21:00' then
    raise exception 'A conferência fica disponível somente na sexta-feira, das 17h às 21h.';
  end if;
  if not exists (
    select 1 from public.lancamentos_financeiros f
    where f.categoria = 'Comissões'
      and translate(lower(trim(coalesce(f.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = translate(lower(trim(mecanico_atual)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
      and coalesce(f.semana_inicio, f.vencimento - (extract(isodow from f.vencimento)::integer - 1)) = inicio_semana
  ) then raise exception 'Não há comissões pendentes nesta semana para conferir.'; end if;

  insert into public.conferencia_comissoes_mecanicos (usuario_id, email, mecanico, semana_inicio)
  values (auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), mecanico_atual, inicio_semana)
  on conflict (usuario_id, semana_inicio) do update
    set conferido_em = public.conferencia_comissoes_mecanicos.conferido_em
  returning conferido_em into confirmado;
  return confirmado;
end;
$$;

revoke all on function public.conferir_comissoes_semana_mecanico() from public, anon;
grant execute on function public.conferir_comissoes_semana_mecanico() to authenticated;

create or replace function public.historico_conferencia_comissoes_mecanicos()
returns table (
  confirmation_id uuid,
  user_email text,
  mechanic text,
  week_start date,
  confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode consultar este histórico.';
  end if;

  return query
  select c.id, c.email, c.mecanico, c.semana_inicio, c.conferido_em
  from public.conferencia_comissoes_mecanicos c
  order by c.semana_inicio desc, c.conferido_em desc;
end;
$$;

revoke all on function public.historico_conferencia_comissoes_mecanicos() from public, anon;
grant execute on function public.historico_conferencia_comissoes_mecanicos() to authenticated;

create or replace function public.alterar_mecanico_servico_entregue(
  p_os_id uuid,
  p_service_index integer,
  p_new_mechanic text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_semana date;
  ordem public.ordens_servico%rowtype;
  servicos jsonb;
  mecanico_anterior text;
  data_comissao date;
  numero_os text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode modificar o mecânico de uma O.S. entregue.';
  end if;
  if nullif(trim(p_new_mechanic), '') is null then raise exception 'Selecione o novo mecânico.'; end if;

  inicio_semana := agora_local::date - (extract(isodow from agora_local)::integer - 1);
  select * into ordem from public.ordens_servico where id = p_os_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada.'; end if;
  if ordem.status <> 'Entregue' then raise exception 'Esta função é exclusiva para O.S. entregues.'; end if;

  select min(f.vencimento) into data_comissao
  from public.lancamentos_financeiros f
  where f.os_id = p_os_id and f.categoria = 'Comissões'
    and coalesce(f.semana_inicio, f.vencimento - (extract(isodow from f.vencimento)::integer - 1)) = inicio_semana;
  if data_comissao is null then raise exception 'A O.S. não foi entregue na semana vigente.'; end if;
  if exists (select 1 from public.lancamentos_financeiros f where f.os_id = p_os_id and f.categoria = 'Comissões' and f.status = 'Realizado') then
    raise exception 'A comissão desta O.S. já foi paga e não pode ser transferida.';
  end if;

  servicos := coalesce(ordem.dados_extras -> 'budget' -> 'services', '[]'::jsonb);
  if p_service_index < 0 or p_service_index >= jsonb_array_length(servicos) then raise exception 'Serviço não encontrado na O.S.'; end if;
  mecanico_anterior := coalesce(servicos -> p_service_index ->> 'mechanic', ordem.mecanico, '');
  if exists (
    select 1 from public.conferencia_comissoes_mecanicos c
    where c.semana_inicio = inicio_semana
      and lower(trim(c.mecanico)) in (lower(trim(mecanico_anterior)), lower(trim(p_new_mechanic)))
  ) then raise exception 'As comissões desta semana já foram conferidas e não podem ser transferidas.'; end if;
  servicos := jsonb_set(servicos, array[p_service_index::text, 'mechanic'], to_jsonb(trim(p_new_mechanic)), true);

  update public.ordens_servico
  set dados_extras = jsonb_set(coalesce(dados_extras, '{}'::jsonb), '{budget,services}', servicos, true),
      mecanico = case when jsonb_array_length(servicos) = 1 then trim(p_new_mechanic) else mecanico end
  where id = p_os_id;

  delete from public.lancamentos_financeiros
  where os_id = p_os_id and categoria = 'Comissões' and status <> 'Realizado';

  numero_os := lpad(ordem.numero::text, 4, '0');
  insert into public.lancamentos_financeiros
    (categoria, movimento, descricao, valor, vencimento, status, mecanico, os_id, referencia, semana_inicio)
  select 'Comissões', 'Saída', 'Comissão O.S. #' || numero_os,
    round(sum(coalesce(nullif(servico ->> 'value', '')::numeric, 0)) * 0.5, 2),
    data_comissao, 'Pendente', trim(servico ->> 'mechanic'), p_os_id,
    'comissao-os-' || p_os_id::text || '-' || trim(both '-' from regexp_replace(lower(trim(servico ->> 'mechanic')), '[^a-z0-9]+', '-', 'g')),
    inicio_semana
  from jsonb_array_elements(servicos) servico
  where coalesce(servico ->> 'refused', 'false') <> 'true' and nullif(trim(servico ->> 'mechanic'), '') is not null
  group by trim(servico ->> 'mechanic');

  return jsonb_build_object('orderId', p_os_id, 'serviceIndex', p_service_index,
    'previousMechanic', mecanico_anterior, 'newMechanic', trim(p_new_mechanic), 'weekStart', inicio_semana);
end;
$$;

revoke all on function public.alterar_mecanico_servico_entregue(uuid, integer, text) from public, anon;
grant execute on function public.alterar_mecanico_servico_entregue(uuid, integer, text) to authenticated;

-- A semana de uma O.S. entregue não pode depender de atualizado_em: qualquer
-- correção posterior alteraria sua semana. Este campo registra a entrega uma vez.
alter table public.ordens_servico
  add column if not exists entregue_em date;

with datas_entrega as (
  select
    o.id,
    coalesce(
      min(f.vencimento) filter (where f.categoria = 'Comissões'),
      min(f.vencimento) filter (
        where f.categoria = 'Fluxo de caixa'
          and f.movimento = 'Entrada'
          and (f.referencia like 'caixa-os-%' or f.descricao ilike '%saldo final%')
      ),
      o.data_entrada::date
    ) as entregue_em
  from public.ordens_servico o
  left join public.lancamentos_financeiros f on f.os_id = o.id
  where o.status = 'Entregue' and o.entregue_em is null
  group by o.id, o.atualizado_em
)
update public.ordens_servico o
set entregue_em = d.entregue_em
from datas_entrega d
where o.id = d.id and o.entregue_em is null;

-- Estas O.S. foram importadas sem movimento financeiro que comprovasse a entrega.
-- A última alteração ocorreu em 10/09, mas elas são entradas antigas de agosto.
update public.ordens_servico
set entregue_em = data_entrada::date
where numero in (3, 5, 7, 8, 13, 20, 24, 26, 27)
  and status = 'Entregue';

create or replace function public.registrar_data_entrega_os()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Entregue' then
    if tg_op = 'INSERT' then
      new.entregue_em := coalesce(new.entregue_em, new.data_entrada::date, timezone('America/Sao_Paulo', now())::date);
    elsif old.status is distinct from 'Entregue' then
      new.entregue_em := timezone('America/Sao_Paulo', now())::date;
    else
      new.entregue_em := coalesce(new.entregue_em, old.entregue_em, timezone('America/Sao_Paulo', now())::date);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ordens_servico_registrar_data_entrega on public.ordens_servico;
create trigger ordens_servico_registrar_data_entrega
before insert or update on public.ordens_servico
for each row execute function public.registrar_data_entrega_os();
