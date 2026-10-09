-- Fase 1: finalização segura da O.S., baixa/estorno do estoque e conta a receber.
-- Execute no SQL Editor do projeto Supabase.

create unique index if not exists sincronizacao_estoque_saida_ativa_uidx
on public.sincronizacao(entidade, registro_id)
where entidade = 'estoque_saida';

create unique index if not exists lancamentos_financeiros_referencia_uidx
on public.lancamentos_financeiros(referencia)
where referencia is not null;

create or replace function public.finalizar_os_pronta(
  p_order_id uuid,
  p_order_number text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  ordem public.ordens_servico%rowtype;
  stock_row public.estoque%rowtype;
  claimed boolean := false;
  claimed_count integer := 0;
  already_processed boolean := false;
  warranty boolean := false;
  advance_total numeric := 0;
  outstanding numeric := 0;
  client_name text := 'Cliente';
  receivable_status text := 'Pendente';
  receivable_payment text := null;
begin
  if auth.uid() is null then raise exception 'Sessão expirada'; end if;
  if not public.usuario_tem_permissao('readyOrders') then
    raise exception 'Usuário sem permissão para colocar a O.S. como pronta';
  end if;

  select * into ordem from public.ordens_servico where id = p_order_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if ordem.status = 'Entregue' then raise exception 'Esta O.S. já foi entregue'; end if;

  insert into public.sincronizacao(origem, entidade, registro_id, dados)
  values ('app', 'estoque_saida', p_order_id::text,
    jsonb_build_object('ordem', p_order_number, 'pecas', coalesce(p_items, '[]'::jsonb), 'estado', 'processando'))
  on conflict (entidade, registro_id) where entidade = 'estoque_saida' do nothing;
  get diagnostics claimed_count = row_count;
  claimed := claimed_count > 0;
  already_processed := not claimed;

  if claimed then
    for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      select * into stock_row from public.estoque where id = (item->>'stockId')::uuid for update;
      if not found then raise exception 'Item de estoque não encontrado: %', item->>'description'; end if;
      if coalesce(stock_row.quantidade, 0) < greatest(1, coalesce((item->>'quantity')::numeric, 1)) then
        raise exception 'Saldo insuficiente no estoque: %', item->>'description';
      end if;
      update public.estoque
      set quantidade = coalesce(quantidade, 0) - greatest(1, coalesce((item->>'quantity')::numeric, 1)),
          valor_unitario = greatest(coalesce(valor_unitario, 0), coalesce((item->>'saleValue')::numeric, 0))
      where id = stock_row.id;
    end loop;
  end if;

  warranty := coalesce((ordem.dados_extras->>'warranty')::boolean, false);
  select coalesce(sum(coalesce((entry->>'amount')::numeric, 0)), coalesce((ordem.dados_extras->>'advance')::numeric, 0), 0)
  into advance_total from jsonb_array_elements(coalesce(ordem.dados_extras->'advances', '[]'::jsonb)) entry;
  outstanding := case when warranty then 0 else greatest(0, coalesce(ordem.total, 0) - advance_total) end;
  client_name := coalesce(nullif(btrim(ordem.dados_extras->'client'->>'name'), ''), 'Cliente');
  receivable_status := case when warranty then 'Realizado' else 'Pendente' end;
  receivable_payment := case when warranty then 'Garantia' else null end;

  insert into public.lancamentos_financeiros(categoria, movimento, descricao, valor, vencimento, status, mecanico, forma_pagamento, os_id, referencia, semana_inicio)
  values ('Conta a receber', 'Entrada',
    case when warranty then format('O.S. #%s — %s · garantia sem cobrança', p_order_number, client_name)
         else format('O.S. #%s — %s · saldo após adiantamento', p_order_number, client_name) end,
    outstanding, current_date, receivable_status, null, receivable_payment, p_order_id, 'receber-os-' || p_order_id::text, null)
  on conflict (referencia) where referencia is not null do update set
    descricao = excluded.descricao,
    valor = excluded.valor,
    vencimento = excluded.vencimento,
    status = case when public.lancamentos_financeiros.status = 'Realizado' then public.lancamentos_financeiros.status else excluded.status end,
    forma_pagamento = coalesce(public.lancamentos_financeiros.forma_pagamento, excluded.forma_pagamento),
    atualizado_em = now();

  perform set_config('cortez.finalizando_pronto', 'on', true);
  update public.ordens_servico set status = 'Pronto para entrega' where id = p_order_id;
  update public.sincronizacao
  set dados = jsonb_build_object('ordem', p_order_number, 'pecas', coalesce(p_items, '[]'::jsonb), 'faltantes', jsonb_build_array(), 'estado', 'confirmado', 'usuario', coalesce(auth.jwt()->>'email', ''), 'confirmadoEm', now())
  where entidade = 'estoque_saida' and registro_id = p_order_id::text;

  return jsonb_build_object('alreadyProcessed', already_processed, 'missing', jsonb_build_array());
end;
$$;

create or replace function public.reabrir_os_pronta(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  ordem public.ordens_servico%rowtype;
  movimento public.sincronizacao%rowtype;
  receivable public.lancamentos_financeiros%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão expirada'; end if;
  if lower(coalesce(auth.jwt()->>'email', '')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode reabrir uma O.S. pronta';
  end if;

  select * into ordem from public.ordens_servico where id = p_order_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if ordem.status <> 'Pronto para entrega' then raise exception 'Somente uma O.S. pronta pode ser reaberta'; end if;

  select * into receivable from public.lancamentos_financeiros
  where referencia = 'receber-os-' || p_order_id::text for update;
  if found and receivable.status = 'Realizado' then
    raise exception 'A conta a receber desta O.S. já foi baixada e impede a reabertura';
  end if;

  select * into movimento from public.sincronizacao
  where entidade = 'estoque_saida' and registro_id = p_order_id::text for update;
  if found then
    for item in select value from jsonb_array_elements(coalesce(movimento.dados->'pecas', '[]'::jsonb)) loop
      update public.estoque
      set quantidade = coalesce(quantidade, 0) + greatest(1, coalesce((item->>'quantity')::numeric, 1))
      where id = (item->>'stockId')::uuid;
      if not found then raise exception 'Não foi possível estornar o item: %', item->>'description'; end if;
    end loop;
    insert into public.sincronizacao(origem, entidade, registro_id, dados)
    values ('app', 'estoque_estorno', gen_random_uuid()::text,
      movimento.dados || jsonb_build_object('osId', p_order_id, 'motivo', 'Reabertura da O.S.', 'usuario', coalesce(auth.jwt()->>'email', ''), 'estornadoEm', now()));
    delete from public.sincronizacao where id = movimento.id;
  end if;

  delete from public.lancamentos_financeiros
  where referencia = 'receber-os-' || p_order_id::text and status <> 'Realizado';
  perform set_config('cortez.reabrindo_pronto', 'on', true);
  update public.ordens_servico set status = 'Em andamento' where id = p_order_id;
  return jsonb_build_object('status', 'Em andamento', 'stockReversed', movimento.id is not null);
end;
$$;

create or replace function public.proteger_fluxo_estoque_os()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'Pronto para entrega' and old.status is distinct from 'Pronto para entrega'
     and coalesce(current_setting('cortez.finalizando_pronto', true), '') <> 'on' then
    raise exception 'Use o fluxo seguro para colocar a O.S. como pronta';
  end if;
  if old.status = 'Pronto para entrega' and new.status not in ('Pronto para entrega', 'Entregue')
     and coalesce(current_setting('cortez.reabrindo_pronto', true), '') <> 'on' then
    raise exception 'Use a reabertura com estorno para alterar esta O.S.';
  end if;
  if new.status = 'Entregue'
     and old.status is distinct from 'Entregue'
     and old.status <> 'Pronto para entrega' then
    raise exception 'Coloque a O.S. como pronta para entrega antes de entregá-la';
  end if;
  if old.status in ('Pronto para entrega', 'Entregue') and (
    new.mao_obra is distinct from old.mao_obra or new.valor_pecas is distinct from old.valor_pecas or
    new.desconto is distinct from old.desconto or new.total is distinct from old.total or
    new.dados_extras->'budget' is distinct from old.dados_extras->'budget'
  ) then
    raise exception 'Reabra a O.S. com estorno antes de alterar peças ou valores';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_fluxo_estoque_os on public.ordens_servico;
create trigger proteger_fluxo_estoque_os before update on public.ordens_servico
for each row execute function public.proteger_fluxo_estoque_os();

alter table public.estoque enable row level security;
drop policy if exists estoque_leitura_autenticada on public.estoque;
drop policy if exists estoque_escrita_operacional on public.estoque;
create policy estoque_leitura_autenticada on public.estoque for select to authenticated using (true);
create policy estoque_escrita_operacional on public.estoque for all to authenticated
using (public.usuario_tem_permissao('manageValues') or public.usuario_tem_permissao('addOrderItems'))
with check (public.usuario_tem_permissao('manageValues') or public.usuario_tem_permissao('addOrderItems'));

revoke all on function public.finalizar_os_pronta(uuid,text,jsonb) from public;
revoke all on function public.reabrir_os_pronta(uuid) from public;
grant execute on function public.finalizar_os_pronta(uuid,text,jsonb) to authenticated;
grant execute on function public.reabrir_os_pronta(uuid) to authenticated;
do $$
begin
  if to_regprocedure('public.processar_baixa_estoque(uuid,text,jsonb)') is not null then
    execute 'revoke execute on function public.processar_baixa_estoque(uuid,text,jsonb) from authenticated';
  end if;
end;
$$;
