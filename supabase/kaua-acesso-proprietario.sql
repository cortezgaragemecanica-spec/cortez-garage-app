-- Concede aos e-mails reconhecidos do Kauã o mesmo perfil operacional do proprietário.
-- Migração não destrutiva: não remove nem altera registros existentes.

create or replace function public.cortez_acesso_proprietario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'cortezgaragemecanica@gmail.com',
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
$$;

revoke all on function public.cortez_acesso_proprietario() from public, anon;
grant execute on function public.cortez_acesso_proprietario() to authenticated;

drop policy if exists financeiro_owner on public.lancamentos_financeiros;
create policy financeiro_owner on public.lancamentos_financeiros
for all to authenticated
using (public.cortez_acesso_proprietario())
with check (public.cortez_acesso_proprietario());

drop policy if exists sincronizacao_owner_access on public.sincronizacao;
create policy sincronizacao_owner_access on public.sincronizacao
for all to authenticated
using (public.cortez_acesso_proprietario())
with check (public.cortez_acesso_proprietario());
grant select, insert, update, delete on public.sincronizacao to authenticated;

drop policy if exists app_user_sessions_owner_read on public.app_user_sessions;
create policy app_user_sessions_owner_read on public.app_user_sessions
for select to authenticated
using (public.cortez_acesso_proprietario());

drop policy if exists "agenda proprietario insere" on public.agendamentos;
create policy "agenda proprietario insere" on public.agendamentos
for insert to authenticated
with check (public.cortez_acesso_proprietario());

drop policy if exists "agenda leitura" on public.agendamentos;
create policy "agenda leitura" on public.agendamentos
for select to authenticated
using (
  public.cortez_acesso_proprietario()
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
);

drop policy if exists "agenda equipe conclui" on public.agendamentos;
create policy "agenda equipe conclui" on public.agendamentos
for update to authenticated
using (
  public.cortez_acesso_proprietario()
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
)
with check (
  public.cortez_acesso_proprietario()
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
);

create or replace function public.usuario_tem_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.cortez_acesso_proprietario() then true
    when p_permissao in ('createEntries', 'editOrders', 'readyOrders') then true
    else coalesce((
      select coalesce((usuario -> 'permissions' ->> p_permissao)::boolean, false)
      from public.sincronizacao configuracao
      cross join lateral jsonb_array_elements(coalesce(configuracao.dados -> 'users', '[]'::jsonb)) usuario
      where configuracao.entidade = 'configuracao'
        and configuracao.registro_id = 'usuarios-permissoes'
        and lower(usuario ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce((usuario ->> 'active')::boolean, true)
        and coalesce((usuario -> 'permissions' ->> 'accessApp')::boolean, true)
      limit 1
    ), false)
  end
$$;

revoke all on function public.usuario_tem_permissao(text) from public;
grant execute on function public.usuario_tem_permissao(text) to authenticated;

create or replace function public.owner_save_agendamento(
  p_id uuid,p_mecanico text,p_inicio timestamp,p_fim timestamp,p_cliente text,p_veiculo text,
  p_telefone text,p_servico text,p_observacoes text
) returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid; dia integer; nome text;
begin
  if not public.cortez_acesso_proprietario() then raise exception 'Apenas o proprietário pode salvar agendamentos'; end if;
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

create or replace function public.owner_delete_agendamento(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.cortez_acesso_proprietario() then raise exception 'Apenas o proprietário pode excluir agendamentos'; end if;
  delete from public.agendamentos where id=p_id;
end $$;

revoke all on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) from public;
revoke all on function public.owner_delete_agendamento(uuid) from public;
grant execute on function public.owner_save_agendamento(uuid,text,timestamp,timestamp,text,text,text,text,text) to authenticated;
grant execute on function public.owner_delete_agendamento(uuid) to authenticated;

create or replace function public.historico_conferencia_comissoes_mecanicos()
returns table (
  confirmation_id uuid,
  user_email text,
  mechanic text,
  week_start date,
  confirmed_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.cortez_acesso_proprietario() then
    raise exception 'Somente o proprietário pode consultar este histórico.';
  end if;
  return query
  select c.id, c.email, c.mecanico, c.semana_inicio, c.conferido_em
  from public.conferencia_comissoes_mecanicos c
  order by c.semana_inicio desc, c.conferido_em desc;
end;
$$;

create or replace function public.reabrir_os_pronta(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  ordem public.ordens_servico%rowtype;
  movimento public.sincronizacao%rowtype;
  receivable public.lancamentos_financeiros%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão expirada'; end if;
  if not public.cortez_acesso_proprietario() then raise exception 'Somente o proprietário pode reabrir uma O.S. pronta'; end if;
  select * into ordem from public.ordens_servico where id = p_order_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if ordem.status <> 'Pronto para entrega' then raise exception 'Somente uma O.S. pronta pode ser reaberta'; end if;
  select * into receivable from public.lancamentos_financeiros
    where referencia = 'receber-os-' || p_order_id::text for update;
  if found and receivable.status = 'Realizado' then raise exception 'A conta a receber desta O.S. já foi baixada e impede a reabertura'; end if;
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

revoke all on function public.historico_conferencia_comissoes_mecanicos() from public, anon;
revoke all on function public.reabrir_os_pronta(uuid) from public, anon;
grant execute on function public.historico_conferencia_comissoes_mecanicos() to authenticated;
grant execute on function public.reabrir_os_pronta(uuid) to authenticated;

+create or replace function public.alterar_mecanico_servico_entregue(
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
  if not public.cortez_acesso_proprietario() then
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
