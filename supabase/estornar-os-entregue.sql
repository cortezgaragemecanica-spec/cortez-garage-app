-- Instalar antes de usar o botão. Cada chamada é uma única transação.
create or replace function public.estornar_os_entregue(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  ordem public.ordens_servico%rowtype;
  ids uuid[];
  historico jsonb;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode estornar uma O.S. entregue';
  end if;
  select * into ordem from public.ordens_servico where id=p_order_id for update;
  if not found then raise exception 'O.S. não encontrada'; end if;
  if ordem.status <> 'Entregue' then raise exception 'Esta O.S. não está entregue ou já foi estornada'; end if;
  perform id from public.lancamentos_financeiros where os_id=p_order_id for update;
  if exists(select 1 from public.lancamentos_financeiros where os_id=p_order_id and categoria='Comissões' and status='Realizado') then
    raise exception 'Esta O.S. possui comissão já paga. Regularize o pagamento antes do estorno';
  end if;
  select array_agg(id),jsonb_agg(to_jsonb(f)) into ids,historico
  from public.lancamentos_financeiros f where os_id=p_order_id and (
    categoria in ('Comissões','Conta a receber') or
    (categoria='Fluxo de caixa' and movimento='Entrada' and
      (referencia='caixa-os-'||p_order_id::text or referencia like 'recebimento-%'))
  );
  insert into public.sincronizacao(origem,entidade,registro_id,dados)
  values('app','os_entrega_estorno',gen_random_uuid()::text,
    jsonb_build_object('osId',p_order_id,'ordemAnterior',to_jsonb(ordem),'lancamentos',coalesce(historico,'[]'::jsonb),'usuario',auth.jwt()->>'email','estornadoEm',now()));
  -- Somente lançamentos desta entrega; cópia integral acima preserva a auditoria.
  delete from public.lancamentos_financeiros where id=any(coalesce(ids,array[]::uuid[]));
  perform set_config('cortez.finalizando_pronto','on',true);
  update public.ordens_servico set status='Pronto para entrega' where id=p_order_id;
  perform public.reabrir_os_pronta(p_order_id);
  update public.ordens_servico set entregue_em=null,
    dados_extras=coalesce(dados_extras,'{}'::jsonb)-'closingReceipt'
    where id=p_order_id;
  return jsonb_build_object('status','Em andamento');
end;
$$;
revoke all on function public.estornar_os_entregue(uuid) from public,anon;
grant execute on function public.estornar_os_entregue(uuid) to authenticated;
notify pgrst,'reload schema';
