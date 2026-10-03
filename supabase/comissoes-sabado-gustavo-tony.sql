-- Permite que Gustavo e Tony fechem a comissão na sexta ou no sábado.
-- Se ainda houver comissão pendente na virada para sábado, os serviços do sábado
-- permanecem no mesmo fechamento. Execute no SQL Editor do projeto Supabase.

create or replace function public.inicio_semana_comissao_mecanico(p_mecanico text, p_data date)
returns date language plpgsql stable security definer set search_path = public
as $$
declare
  inicio_base date := p_data - ((extract(dow from p_data)::integer + 1) % 7);
  nome text := translate(lower(trim(coalesce(p_mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
begin
  if extract(isodow from p_data) = 6 and nome in ('gustavo', 'tony') and exists (
    select 1 from public.lancamentos_financeiros f
    where f.categoria = 'Comissões'
      and f.status <> 'Realizado'
      and translate(lower(trim(coalesce(f.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = nome
      and coalesce(f.semana_inicio, f.vencimento - ((extract(dow from f.vencimento)::integer + 1) % 7)) = inicio_base - 7
  ) then return inicio_base - 7; end if;
  return inicio_base;
end;
$$;

revoke all on function public.inicio_semana_comissao_mecanico(text,date) from public, anon;
grant execute on function public.inicio_semana_comissao_mecanico(text,date) to authenticated;

-- As duas funções abaixo substituem as versões equivalentes de comissoes-mecanicos.sql.
-- Elas mantêm o mesmo retorno e acrescentam apenas a prorrogação de sábado.
create or replace function public.comissoes_semana_mecanico()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_base date;
  inicio_semana date;
  fim_semana date;
  mecanico_atual text;
  conferido timestamptz;
  itens jsonb;
  vales jsonb;
  total numeric(12,2);
  total_gerado numeric(12,2);
  total_vales numeric(12,2);
  mecanico_busca text;
  nome_normalizado text;
  fechamento_sabado boolean;
begin
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;
  inicio_base := agora_local::date - ((extract(dow from agora_local)::integer + 1) % 7);
  inicio_semana := public.inicio_semana_comissao_mecanico(mecanico_atual, agora_local::date);
  fechamento_sabado := inicio_semana < inicio_base;
  fim_semana := inicio_semana + case when fechamento_sabado then 7 else 6 end;
  nome_normalizado := translate(lower(trim(mecanico_atual)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  mecanico_busca := split_part(regexp_replace(nome_normalizado, '[^a-z0-9]+', ' ', 'g'), ' ', 1);

  select c.conferido_em into conferido from public.conferencia_comissoes_mecanicos c
  where c.usuario_id = auth.uid() and c.semana_inicio = inicio_semana limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'date', f.vencimento,
      'orderNumber', lpad(coalesce(o.numero::text, regexp_replace(f.descricao, '^.*#([0-9]+).*$', '\1')), 4, '0'),
      'vehicle', concat_ws(' · ', nullif(v.placa, ''), nullif(v.modelo, '')),
      'service', coalesce(nullif((select string_agg(nullif(trim(servico ->> 'description'), ''), ', ')
        from jsonb_array_elements(coalesce(o.dados_extras -> 'budget' -> 'services', '[]'::jsonb)) servico
        where translate(lower(trim(coalesce(nullif(servico ->> 'mechanic', ''), o.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = nome_normalizado
          and coalesce(servico ->> 'refused', 'false') <> 'true'), ''), 'Serviço da O.S.'),
      'amount', f.valor, 'status', f.status, 'kind', 'commission'
    ) order by f.vencimento desc, o.numero desc), '[]'::jsonb), coalesce(sum(f.valor), 0)
  into itens, total
  from public.lancamentos_financeiros f
  left join public.ordens_servico o on o.id = f.os_id
  left join public.veiculos v on v.id = o.veiculo_id
  where f.categoria = 'Comissões'
    and translate(lower(trim(coalesce(f.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = nome_normalizado
    and coalesce(f.semana_inicio, f.vencimento - ((extract(dow from f.vencimento)::integer + 1) % 7)) = inicio_semana;

  total_gerado := total;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'date', f.vencimento, 'orderNumber', null,
      'vehicle', coalesce(nullif(f.forma_pagamento, ''), 'Caixa'), 'service', f.descricao,
      'amount', -f.valor, 'status', 'Vale descontado', 'kind', 'advance'
    ) order by f.vencimento desc, f.criado_em desc), '[]'::jsonb), coalesce(sum(f.valor), 0)
  into vales, total_vales
  from public.lancamentos_financeiros f
  where f.categoria = 'Fluxo de caixa' and f.movimento = 'Saída' and f.status = 'Realizado'
    and f.vencimento between inicio_semana and fim_semana
    and concat(' ', regexp_replace(translate(lower(coalesce(f.descricao, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', ' ', 'g'), ' ') like '% vale %'
    and concat(' ', regexp_replace(translate(lower(coalesce(f.descricao, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', ' ', 'g'), ' ') like '% ' || mecanico_busca || ' %';

  itens := itens || vales;
  total := greatest(0, total_gerado - total_vales);
  return jsonb_build_object(
    'mechanic', mecanico_atual, 'weekStart', inicio_semana, 'weekEnd', fim_semana,
    'generated', total_gerado, 'advances', total_vales, 'total', total, 'items', itens,
    'confirmedAt', conferido,
    'canConfirm', conferido is null
      and (extract(isodow from agora_local) = 5 or (nome_normalizado in ('gustavo','tony') and extract(isodow from agora_local) = 6))
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
  nome_normalizado text;
  confirmado timestamptz;
begin
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;
  nome_normalizado := translate(lower(trim(mecanico_atual)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  inicio_semana := public.inicio_semana_comissao_mecanico(mecanico_atual, agora_local::date);
  if not (extract(isodow from agora_local) = 5 or (nome_normalizado in ('gustavo','tony') and extract(isodow from agora_local) = 6))
     or agora_local::time < time '17:00' or agora_local::time > time '21:00' then
    raise exception 'A conferência de Gustavo e Tony fica disponível sexta ou sábado, das 17h às 21h; para os demais, somente sexta.';
  end if;
  if not exists (
    select 1 from public.lancamentos_financeiros f
    where f.categoria = 'Comissões'
      and translate(lower(trim(coalesce(f.mecanico, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = nome_normalizado
      and coalesce(f.semana_inicio, f.vencimento - ((extract(dow from f.vencimento)::integer + 1) % 7)) = inicio_semana
  ) then raise exception 'Não há comissões pendentes neste fechamento para conferir.'; end if;

  insert into public.conferencia_comissoes_mecanicos (usuario_id, email, mecanico, semana_inicio)
  values (auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), mecanico_atual, inicio_semana)
  on conflict (usuario_id, semana_inicio) do update set conferido_em = public.conferencia_comissoes_mecanicos.conferido_em
  returning conferido_em into confirmado;
  return confirmado;
end;
$$;

revoke all on function public.conferir_comissoes_semana_mecanico() from public, anon;
grant execute on function public.conferir_comissoes_semana_mecanico() to authenticated;

-- Proteção no banco: domingo é fechado; sábado é exclusivo de Gustavo e Tony.
create or replace function public.owner_save_agendamento(
  p_id uuid,p_mecanico text,p_inicio timestamp,p_fim timestamp,p_cliente text,p_veiculo text,
  p_telefone text,p_servico text,p_observacoes text
) returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid; dia integer; nome text;
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'cortezgaragemecanica@gmail.com' then raise exception 'Apenas o proprietário pode salvar agendamentos'; end if;
  dia := extract(dow from p_inicio)::integer;
  nome := translate(lower(trim(coalesce(p_mecanico,''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  if dia = 0 or (dia = 6 and nome not in ('gustavo','tony')) then raise exception 'Sábado é exclusivo das agendas de Gustavo e Tony; domingo não possui atendimento.'; end if;
  if p_id is null then
    insert into public.agendamentos(mecanico,inicio,fim,cliente,veiculo,telefone,servico,observacoes,criado_por)
    values(p_mecanico,p_inicio,p_fim,p_cliente,p_veiculo,p_telefone,p_servico,p_observacoes,auth.uid()) returning id into result_id;
  else
    update public.agendamentos set mecanico=p_mecanico,inicio=p_inicio,fim=p_fim,cliente=p_cliente,veiculo=p_veiculo,
      telefone=p_telefone,servico=p_servico,observacoes=p_observacoes where id=p_id returning id into result_id;
  end if;
  return result_id;
end $$;

revoke all on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) from public;
grant execute on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) to authenticated;
