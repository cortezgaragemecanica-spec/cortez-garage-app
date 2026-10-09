-- Corrige a troca de mecânico em O.S. entregue na semana atual.
-- A data da entrega vem da própria O.S.; a semana da comissão continua
-- respeitando segunda a sábado para Tony/Gustavo e sábado a sexta para os demais.
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
  semana_mecanico_anterior date;
  semana_novo_mecanico date;
  comissao_paga boolean;
  numero_os text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode modificar o mecânico de uma O.S. entregue.';
  end if;
  if nullif(trim(p_new_mechanic), '') is null then raise exception 'Selecione o novo mecânico.'; end if;

  select * into ordem from public.ordens_servico where id = p_os_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada.'; end if;
  if ordem.status <> 'Entregue' then raise exception 'Esta função é exclusiva para O.S. entregues.'; end if;

  data_comissao := coalesce(ordem.entregue_em, ordem.data_entrada::date, agora_local::date);
  inicio_semana := data_comissao - ((extract(dow from data_comissao)::integer + 1) % 7);
  select exists (
    select 1 from public.lancamentos_financeiros f
    where f.os_id = p_os_id and f.categoria = 'Comissões' and f.status = 'Realizado'
  ) into comissao_paga;

  servicos := coalesce(ordem.dados_extras -> 'budget' -> 'services', '[]'::jsonb);
  if p_service_index < 0 or p_service_index >= jsonb_array_length(servicos) then raise exception 'Serviço não encontrado na O.S.'; end if;
  mecanico_anterior := coalesce(servicos -> p_service_index ->> 'mechanic', ordem.mecanico, '');
  semana_mecanico_anterior := case
    when lower(trim(mecanico_anterior)) in ('gustavo', 'tony')
      then data_comissao - (case when extract(dow from data_comissao)::integer = 0 then 6 else extract(dow from data_comissao)::integer - 1 end)
    else data_comissao - ((extract(dow from data_comissao)::integer + 1) % 7)
  end;
  semana_novo_mecanico := case
    when lower(trim(p_new_mechanic)) in ('gustavo', 'tony')
      then data_comissao - (case when extract(dow from data_comissao)::integer = 0 then 6 else extract(dow from data_comissao)::integer - 1 end)
    else data_comissao - ((extract(dow from data_comissao)::integer + 1) % 7)
  end;
  servicos := jsonb_set(servicos, array[p_service_index::text, 'mechanic'], to_jsonb(trim(p_new_mechanic)), true);
  perform set_config('cortez.trocando_mecanico', 'on', true);
  update public.ordens_servico
  set dados_extras = jsonb_set(coalesce(dados_extras, '{}'::jsonb), '{budget,services}', servicos, true),
      mecanico = case when jsonb_array_length(servicos) = 1 then trim(p_new_mechanic) else mecanico end
  where id = p_os_id;

  if not comissao_paga then
    delete from public.conferencia_comissoes_mecanicos c
    where (lower(trim(c.mecanico)) = lower(trim(mecanico_anterior)) and c.semana_inicio = semana_mecanico_anterior)
       or (lower(trim(c.mecanico)) = lower(trim(p_new_mechanic)) and c.semana_inicio = semana_novo_mecanico);

    delete from public.lancamentos_financeiros
    where os_id = p_os_id and categoria = 'Comissões' and status <> 'Realizado';

    numero_os := lpad(ordem.numero::text, 4, '0');
    insert into public.lancamentos_financeiros
    (categoria, movimento, descricao, valor, vencimento, status, mecanico, os_id, referencia, semana_inicio)
  select 'Comissões', 'Saída', 'Comissão O.S. #' || numero_os,
    round(sum(
      coalesce(nullif(servico ->> 'value', '')::numeric, 0)
      * greatest(0, least(1, coalesce(nullif(servico ->> 'commissionRate', '')::numeric, 0.5)))
    ), 2),
    data_comissao, 'Pendente', trim(servico ->> 'mechanic'), p_os_id,
    'comissao-os-' || p_os_id::text || '-' || trim(both '-' from regexp_replace(lower(trim(servico ->> 'mechanic')), '[^a-z0-9]+', '-', 'g')),
    case
      when lower(trim(servico ->> 'mechanic')) in ('gustavo', 'tony')
        then data_comissao - (case when extract(dow from data_comissao)::integer = 0 then 6 else extract(dow from data_comissao)::integer - 1 end)
      else data_comissao - ((extract(dow from data_comissao)::integer + 1) % 7)
    end
  from jsonb_array_elements(servicos) servico
  where coalesce(servico ->> 'refused', 'false') <> 'true'
    and nullif(trim(servico ->> 'mechanic'), '') is not null
    and not (
      coalesce((ordem.dados_extras ->> 'warranty')::boolean, false)
      and not coalesce((ordem.dados_extras ->> 'warrantyPayCommissions')::boolean, false)
    )
    group by trim(servico ->> 'mechanic'),
    case
      when lower(trim(servico ->> 'mechanic')) in ('gustavo', 'tony')
        then data_comissao - (case when extract(dow from data_comissao)::integer = 0 then 6 else extract(dow from data_comissao)::integer - 1 end)
      else data_comissao - ((extract(dow from data_comissao)::integer + 1) % 7)
      end;
  end if;

  return jsonb_build_object('orderId', p_os_id, 'serviceIndex', p_service_index,
    'previousMechanic', mecanico_anterior, 'newMechanic', trim(p_new_mechanic),
    'weekStart', inicio_semana, 'commissionHistoryPreserved', comissao_paga);
end;
$$;

revoke all on function public.alterar_mecanico_servico_entregue(uuid, integer, text) from public, anon;
grant execute on function public.alterar_mecanico_servico_entregue(uuid, integer, text) to authenticated;
