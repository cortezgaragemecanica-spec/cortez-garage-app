-- Instale esta migração no SQL Editor do projeto Supabase.
-- A função bloqueia os itens, valida o saldo e registra a baixa na mesma transação.
create or replace function public.processar_baixa_estoque(
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
  stock_row public.estoque%rowtype;
  movement_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada';
  end if;
  if not public.usuario_tem_permissao('readyOrders') then
    raise exception 'Usuário sem permissão para dar baixa no estoque';
  end if;

  select exists(
    select 1 from public.sincronizacao
    where entidade = 'estoque_saida' and registro_id = p_order_id::text
  ) into movement_exists;
  if movement_exists then
    return jsonb_build_object('alreadyProcessed', true, 'missing', jsonb_build_array());
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into stock_row
    from public.estoque
    where id = (item->>'stockId')::uuid
    for update;

    if not found then
      raise exception 'Item de estoque não encontrado: %', item->>'description';
    end if;
    if coalesce(stock_row.quantidade, 0) < greatest(1, (item->>'quantity')::numeric) then
      raise exception 'Saldo insuficiente no estoque: %', item->>'description';
    end if;

    update public.estoque
    set quantidade = coalesce(quantidade, 0) - greatest(1, (item->>'quantity')::numeric),
        valor_unitario = greatest(coalesce(valor_unitario, 0), coalesce((item->>'saleValue')::numeric, 0))
    where id = stock_row.id;
  end loop;

  insert into public.sincronizacao(origem, entidade, registro_id, dados)
  values ('app', 'estoque_saida', p_order_id::text,
    jsonb_build_object('ordem', p_order_number, 'pecas', p_items, 'faltantes', jsonb_build_array()));

  return jsonb_build_object('alreadyProcessed', false, 'missing', jsonb_build_array());
end;
$$;

revoke all on function public.processar_baixa_estoque(uuid,text,jsonb) from public;
grant execute on function public.processar_baixa_estoque(uuid,text,jsonb) to authenticated;
