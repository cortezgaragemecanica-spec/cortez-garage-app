-- Conta a pagar opcional e dinâmica para as peças pendentes de cada O.S.
-- Não apaga dados e não modifica contas que já receberam pagamento.
create or replace function public.sincronizar_conta_compras_os(
  p_os_id uuid,
  p_criar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ordem public.ordens_servico%rowtype;
  checklist jsonb := '{}'::jsonb;
  conta public.lancamentos_financeiros%rowtype;
  referencia_conta text := 'compras-os-' || p_os_id::text;
  email_atual text := lower(coalesce(auth.jwt() ->> 'email', ''));
  total_pendente numeric(12,2) := 0;
  pecas_pendentes text := '';
  veiculo_descricao text := 'Veículo não informado';
  descricao_conta text;
  pagamento_existente boolean := false;
  marcador_concluido constant text := 'Compras concluídas automaticamente';
begin
  if auth.uid() is null then raise exception 'Faça login novamente.'; end if;
  if p_criar and email_atual <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode lançar compras em Contas a pagar.';
  end if;

  perform pg_advisory_xact_lock(hashtext(referencia_conta));
  select * into ordem from public.ordens_servico where id = p_os_id;
  if not found then raise exception 'Ordem de serviço não encontrada.'; end if;

  select coalesce(s.dados, '{}'::jsonb) into checklist
  from public.sincronizacao s
  where s.entidade = 'checklist_compras_os' and s.registro_id = p_os_id::text
  order by coalesce(s.dados ->> 'updatedAt','') desc
  limit 1;
  checklist := coalesce(checklist, '{}'::jsonb);

  select * into conta
  from public.lancamentos_financeiros f
  where f.referencia = referencia_conta
  limit 1;
  if not found and not p_criar then return jsonb_build_object('linked', false, 'orderId', p_os_id); end if;

  select coalesce(nullif(trim(concat_ws(' · ', nullif(v.placa,''), nullif(v.modelo,''))),''), 'Veículo não informado')
  into veiculo_descricao
  from public.veiculos v where v.id = ordem.veiculo_id;
  veiculo_descricao := coalesce(veiculo_descricao, 'Veículo não informado');

  with partes as (
    select p.item, p.ord,
      trim(regexp_replace(translate(lower(coalesce(nullif(p.item ->> 'code',''), p.item ->> 'description','item-' || p.ord::text)),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', ' ', 'g')) as identidade
    from jsonb_array_elements(coalesce(ordem.dados_extras -> 'budget' -> 'parts', '[]'::jsonb)) with ordinality p(item,ord)
  ), chaves as (
    select item, ord, identidade || ':' || (row_number() over(partition by identidade order by ord))::text as chave
    from partes
  ), pendentes as (
    select item, ord,
      greatest(1, coalesce(nullif(item ->> 'quantity','')::numeric, 1)) as quantidade,
      greatest(0, coalesce(nullif(item ->> 'cost','')::numeric, 0)) as custo
    from chaves
    where coalesce((item ->> 'refused')::boolean, false) = false
      and coalesce((checklist -> 'items' -> chave ->> 'excluded')::boolean, false) = false
      and coalesce((checklist -> 'items' -> chave ->> 'purchased')::boolean, false) = false
      and nullif(checklist -> 'items' -> chave ->> 'purchasedAt','') is null
  )
  select round(coalesce(sum(quantidade * custo),0),2),
    coalesce(string_agg(concat(coalesce(nullif(item ->> 'description',''),'Peça sem descrição'), ' (', quantidade::text, 'x)'), ', ' order by ord),'')
  into total_pendente, pecas_pendentes
  from pendentes;

  if p_criar and total_pendente <= 0 then raise exception 'Nenhuma peça pendente possui custo informado.'; end if;
  descricao_conta := left(concat('O.S. #', lpad(ordem.numero::text,4,'0'), ' · ', veiculo_descricao,
    case when pecas_pendentes <> '' then ' · Falta comprar: ' || pecas_pendentes else ' · Todas as peças compradas' end), 240);

  if conta.id is not null then
    select exists(select 1 from public.lancamentos_financeiros p where p.referencia like 'pagamento-conta-' || conta.id::text || '-%')
    into pagamento_existente;
    if pagamento_existente or (conta.status = 'Realizado' and coalesce(conta.forma_pagamento,'') <> marcador_concluido) then
      return jsonb_build_object('linked', true, 'protected', true, 'id', conta.id, 'amount', conta.valor, 'status', conta.status);
    end if;
    update public.lancamentos_financeiros set
      descricao = descricao_conta,
      valor = total_pendente,
      status = case when total_pendente > 0 then 'Pendente' else 'Realizado' end,
      forma_pagamento = case when total_pendente > 0 then null else marcador_concluido end
    where id = conta.id returning * into conta;
  else
    insert into public.lancamentos_financeiros
      (categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,os_id,referencia,semana_inicio)
    values
      ('Conta a pagar','Saída',descricao_conta,total_pendente,
       timezone('America/Sao_Paulo',now())::date + 1,'Pendente',null,null,p_os_id,referencia_conta,null)
    returning * into conta;
  end if;

  return jsonb_build_object('linked', true, 'protected', false, 'id', conta.id,
    'amount', conta.valor, 'status', conta.status, 'description', conta.descricao, 'dueDate', conta.vencimento);
end;
$$;

revoke all on function public.sincronizar_conta_compras_os(uuid,boolean) from public, anon;
grant execute on function public.sincronizar_conta_compras_os(uuid,boolean) to authenticated;
