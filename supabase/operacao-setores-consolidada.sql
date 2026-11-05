-- Atualização aditiva: permissões operacionais globais e O.S. por item.
begin;
create or replace function public.operador_dos_setores()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and lower(coalesce(auth.jwt()->>'email',''))<>'marcelinocortez2910@gmail.com' and (
 lower(coalesce(auth.jwt()->>'email',''))='cortezgaragemecanica@gmail.com' or
 coalesce((select coalesce((u->>'active')::boolean,true) and coalesce((u->'permissions'->>'accessApp')::boolean,true) and
   lower(coalesce(u->>'name','')) not like '%marcelino%' and (lower(coalesce(nullif(u->>'agendaMechanic',''),u->>'name','')) in ('tony','fabio','fábio','gustavo','cortez') or lower(u->>'email') in ('gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com','fabiomaier19850901@gmail.com'))
 from public.sincronizacao s cross join lateral jsonb_array_elements(coalesce(s.dados->'users','[]'::jsonb)) u
 where s.entidade='configuracao' and s.registro_id='usuarios-permissoes' and lower(u->>'email')=lower(auth.jwt()->>'email') limit 1),
 lower(coalesce(auth.jwt()->>'email','')) in ('gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com','fabiomaier19850901@gmail.com'))
 )
$$;
revoke all on function public.operador_dos_setores() from public,anon;
grant execute on function public.operador_dos_setores() to authenticated;
create or replace function cortez_ae_private.usuario_tem_permissao(p_permissao text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$select public.operador_dos_setores() and public.usuario_tem_permissao(p_permissao)$$;
create or replace function cortez_ae_private.mecanico_atual_do_usuario() returns text language sql stable security definer set search_path=pg_catalog,public as $$select public.mecanico_atual_do_usuario()$$;

do $policies$
declare t text; f record; args text; body text;
begin
 foreach t in array array['clientes','veiculos','ordens_servico','itens_os','estoque','agendamentos'] loop
  execute format('create policy ae_operational_read on public.%I for select to authenticated using (public.operador_dos_setores())','ae_'||t);
  if t in ('clientes','veiculos','ordens_servico','itens_os') then
   execute format('create policy ae_operational_insert on public.%I for insert to authenticated with check (public.operador_dos_setores() and public.usuario_tem_permissao(''editOrders''))','ae_'||t);
   execute format('create policy ae_operational_update on public.%I for update to authenticated using (public.operador_dos_setores() and public.usuario_tem_permissao(''editOrders'')) with check (public.operador_dos_setores() and public.usuario_tem_permissao(''editOrders''))','ae_'||t);
  elsif t='estoque' then
   execute 'create policy ae_operational_stock on public.ae_estoque for all to authenticated using (public.operador_dos_setores() and (public.usuario_tem_permissao(''manageValues'') or public.usuario_tem_permissao(''addOrderItems''))) with check (public.operador_dos_setores() and (public.usuario_tem_permissao(''manageValues'') or public.usuario_tem_permissao(''addOrderItems'')))';
  else
   execute 'create policy ae_operational_agenda on public.ae_agendamentos for update to authenticated using (public.operador_dos_setores()) with check (public.operador_dos_setores())';
  end if;
 end loop;
 -- Same existing operational checks; these endpoints do not grant finance access.
 for f in select p.*,pg_get_function_arguments(oid) arguments,pg_get_function_result(oid) result,pg_get_function_identity_arguments(oid) ident from pg_proc p where pronamespace='public'::regnamespace and proname in ('finalizar_os_pronta','reabrir_os_pronta','estornar_os_entregue','alterar_mecanico_servico_entregue','comissoes_semana_mecanico','conferir_comissoes_semana_mecanico','historico_conferencia_comissoes_mecanicos','sincronizar_conta_compras_os') loop
  select string_agg(quote_ident(a),',' order by ord) into args from unnest(f.proargnames[1:f.pronargs]) with ordinality x(a,ord);
  body:=case when f.proretset then 'return query select * from ' when f.prorettype='void'::regtype then 'perform ' else 'return ' end||format('cortez_ae_private.%I(%s);',f.proname,args);
  execute format('create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path=pg_catalog,public as %L','ae_'||f.proname,f.arguments,f.result,'begin if not public.operador_dos_setores() then raise exception ''Acesso operacional não autorizado.'' using errcode=''42501''; end if; '||body||' end');
 end loop;
end $policies$;
create policy ae_operational_sync_read on public.ae_sincronizacao for select to authenticated using (public.operador_dos_setores() and (entidade in ('solicitacao_pecas','solicitacao_orcamento_servicos','solicitacao_revisao_os','checklist_compras_os','estoque_saida','estoque_estorno','alteracao_os') or entidade='configuracao' and registro_id in ('estoque-metadados','mecanicos')));
create policy ae_operational_sync_write on public.ae_sincronizacao for all to authenticated using (public.operador_dos_setores() and public.usuario_tem_permissao('editOrders') and entidade in ('solicitacao_pecas','solicitacao_orcamento_servicos','solicitacao_revisao_os','checklist_compras_os','estoque_saida','estoque_estorno','alteracao_os')) with check (public.operador_dos_setores() and public.usuario_tem_permissao('editOrders') and entidade in ('solicitacao_pecas','solicitacao_orcamento_servicos','solicitacao_revisao_os','checklist_compras_os','estoque_saida','estoque_estorno','alteracao_os'));
create policy ae_operational_stock_metadata on public.ae_sincronizacao for all to authenticated using (public.operador_dos_setores() and (public.usuario_tem_permissao('manageValues') or public.usuario_tem_permissao('addOrderItems')) and entidade='configuracao' and registro_id='estoque-metadados') with check (public.operador_dos_setores() and (public.usuario_tem_permissao('manageValues') or public.usuario_tem_permissao('addOrderItems')) and entidade='configuracao' and registro_id='estoque-metadados');
create policy ae_operational_closing on public.ae_lancamentos_financeiros for all to authenticated using (public.operador_dos_setores() and public.usuario_pode_fechar_os() and public.lancamento_pertence_fechamento_os(categoria,referencia,os_id)) with check (public.operador_dos_setores() and public.usuario_pode_fechar_os() and public.lancamento_pertence_fechamento_os(categoria,referencia,os_id));

-- A mixed O.S. is canonical in Mecânica. The electrical row is only its
-- projection. Marcelino cannot read the canonical mixed document via REST.
create or replace function public.os_tem_setor_restrito(p_id text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$select exists(select 1 from public.ordens_servico where id::text=p_id and coalesce((dados_extras->>'sectorMaster')::boolean,false))$$;
grant execute on function public.os_tem_setor_restrito(text) to authenticated;
create policy os_mista_privacidade on public.ordens_servico as restrictive for all to authenticated using (not coalesce((dados_extras->>'sectorMaster')::boolean,false) or public.operador_dos_setores()) with check (not coalesce((dados_extras->>'sectorMaster')::boolean,false) or public.operador_dos_setores());
create policy os_mista_solicitacoes_privadas on public.sincronizacao as restrictive for all to authenticated using (public.operador_dos_setores() or not(public.os_tem_setor_restrito(dados->>'orderId') or public.os_tem_setor_restrito(registro_id))) with check (public.operador_dos_setores() or not(public.os_tem_setor_restrito(dados->>'orderId') or public.os_tem_setor_restrito(registro_id)));
-- A user cannot promote their own account by editing the legacy shared JSON.
create policy proteger_perfis_insert on public.sincronizacao as restrictive for insert to authenticated with check (not(entidade='configuracao' and registro_id in ('usuarios-permissoes','mecanicos')) or lower(coalesce(auth.jwt()->>'email',''))='cortezgaragemecanica@gmail.com');
create policy proteger_perfis_update on public.sincronizacao as restrictive for update to authenticated using (not(entidade='configuracao' and registro_id in ('usuarios-permissoes','mecanicos')) or lower(coalesce(auth.jwt()->>'email',''))='cortezgaragemecanica@gmail.com') with check (not(entidade='configuracao' and registro_id in ('usuarios-permissoes','mecanicos')) or lower(coalesce(auth.jwt()->>'email',''))='cortezgaragemecanica@gmail.com');
create policy proteger_perfis_delete on public.sincronizacao as restrictive for delete to authenticated using (not(entidade='configuracao' and registro_id in ('usuarios-permissoes','mecanicos')) or lower(coalesce(auth.jwt()->>'email',''))='cortezgaragemecanica@gmail.com');
do $guard$
declare f record; def text; param text;
begin
 for f in select oid,proname,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname in ('finalizar_os_pronta','reabrir_os_pronta','sincronizar_conta_compras_os') loop
  param:=case when f.proname='sincronizar_conta_compras_os' then 'p_os_id' else 'p_order_id' end;
  def:=regexp_replace(f.definition,'\mbegin\M','begin if public.os_tem_setor_restrito('||param||'::text) and not public.operador_dos_setores() then raise exception ''Acesso operacional não autorizado.'' using errcode=''42501''; end if;','i');
  if f.proname='sincronizar_conta_compras_os' then
   def:=replace(def,'where coalesce((item ->> ''refused'')','where (not coalesce((ordem.dados_extras->>''sectorMaster'')::boolean,false) or coalesce(item->>''sector'',''mecanica'')=''mecanica'') and coalesce((item ->> ''refused'')');
  end if;
  execute def;
 end loop;
 for f in select pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname='comissoes_semana_mecanico' loop
  execute replace(f.definition,'where translate(lower(trim(coalesce(nullif(servico','where (not coalesce((o.dados_extras->>''sectorMaster'')::boolean,false) or coalesce(servico->>''sector'',''mecanica'')=''mecanica'') and translate(lower(trim(coalesce(nullif(servico');
 end loop;
end $guard$;

create or replace function cortez_ae_private.projecao_os(p_row jsonb,p_setor text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare budget jsonb:=coalesce(p_row->'dados_extras'->'budget','{}'); parts jsonb; services jsonb; ps numeric; labor numeric; weight numeric; whole numeric; total numeric; discount numeric; advance numeric; extras jsonb:=p_row->'dados_extras'; ae jsonb;
begin
 select coalesce(jsonb_agg(item),'[]'),coalesce(sum(case when coalesce((item->>'refused')::boolean,false) then 0 else coalesce((item->>'value')::numeric,0)*coalesce((item->>'quantity')::numeric,1) end),0) into parts,ps from jsonb_array_elements(coalesce(budget->'parts','[]')) item where coalesce(item->>'sector','mecanica')=p_setor;
 select coalesce(jsonb_agg(item||jsonb_build_object('originalIndex',ord-1)),'[]'),coalesce(sum(case when coalesce((item->>'refused')::boolean,false) then 0 else coalesce((item->>'value')::numeric,0) end),0) into services,labor from jsonb_array_elements(coalesce(budget->'services','[]')) with ordinality x(item,ord) where coalesce(item->>'sector','mecanica')=p_setor;
 weight:=ps+labor;whole:=coalesce((p_row->>'mao_obra')::numeric,0)+coalesce((p_row->>'valor_pecas')::numeric,0);
 total:=case when whole>0 then round(coalesce((p_row->>'total')::numeric,0)*weight/whole,2) else 0 end;
 discount:=case when whole>0 then round(coalesce((p_row->>'desconto')::numeric,0)*weight/whole,2) else 0 end;
 advance:=case when whole>0 then round(coalesce((extras->>'advance')::numeric,0)*weight/whole,2) else 0 end;
 if p_setor='mecanica' then
  -- Allocate all rounding residue to Mecânica; Auto elétrica gets half-up.
  ae:=cortez_ae_private.projecao_os(p_row,'auto_eletrica');total:=coalesce((p_row->>'total')::numeric,0)-coalesce((ae->>'total')::numeric,0);discount:=coalesce((p_row->>'desconto')::numeric,0)-coalesce((ae->>'desconto')::numeric,0);advance:=coalesce((extras->>'advance')::numeric,0)-coalesce((ae->'dados_extras'->>'advance')::numeric,0);
 end if;
 extras:=extras||jsonb_build_object('budget',budget||jsonb_build_object('parts',parts,'services',services,'partsTotal',ps,'servicesTotal',labor,'total',total),'sector',p_setor,'projectionOnly',true,'sectorMaster',false,'mirrorOf',p_row->>'id','advance',advance);
 extras:=extras||jsonb_build_object('advances',coalesce((select jsonb_agg(item||jsonb_build_object('amount',case when whole>0 then round(coalesce((item->>'amount')::numeric,0)*weight/whole,2) else 0 end)) from jsonb_array_elements(coalesce(extras->'advances','[]')) item),'[]'::jsonb));
 return p_row||jsonb_build_object('mao_obra',labor,'valor_pecas',ps,'desconto',discount,'total',total,'dados_extras',extras);
end $$;

create or replace function public.adiantamento_os_setores(p_order_id uuid,p_amount numeric,p_account text,p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare root public.ordens_servico%rowtype; ae numeric; amounts jsonb; sector text; relation text; ref text:='adiantamento-os-'||p_order_id::text||'-'||p_entry_id::text; rows jsonb; current_advance numeric;
begin
 if lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Somente proprietário' using errcode='42501';end if;
 select * into root from public.ordens_servico where id=p_order_id and coalesce((dados_extras->>'sectorMaster')::boolean,false) for update;
 if root.id is null or coalesce((root.dados_extras->>'warranty')::boolean,false) then raise exception 'O.S. inválida para adiantamento';end if;
 if p_entry_id is null or p_account is null or p_account not in ('Banco do Brasil','Mercado Livre','Dinheiro') or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Adiantamento inválido';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(root.dados_extras->'advances','[]')) item where item->>'id'=p_entry_id::text) then return to_jsonb(root);end if;
 current_advance:=coalesce((root.dados_extras->>'advance')::numeric,0);
 if p_amount>root.total-current_advance then raise exception 'Adiantamento ultrapassa saldo';end if;
 ae:=coalesce((cortez_ae_private.projecao_os(to_jsonb(root),'auto_eletrica')->>'total')::numeric,0);
 amounts:=jsonb_build_object('auto_eletrica',case when root.total>0 then round(p_amount*ae/root.total,2) else 0 end,'mecanica',p_amount-case when root.total>0 then round(p_amount*ae/root.total,2) else 0 end);
 foreach sector in array array['mecanica','auto_eletrica'] loop
  if (amounts->>sector)::numeric<=0 then continue;end if;
  relation:=case when sector='auto_eletrica' then 'ae_lancamentos_financeiros' else 'lancamentos_financeiros' end;
  execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento,os_id,referencia) values(''Fluxo de caixa'',''Entrada'',$1,$2,timezone(''America/Sao_Paulo'',now())::date,''Realizado'',$3,$4,$5) on conflict(referencia) where referencia is not null do nothing',relation) using 'Adiantamento O.S. #'||root.numero,(amounts->>sector)::numeric,p_account,p_order_id,ref;
 end loop;
 rows:=coalesce(root.dados_extras->'advances','[]')||jsonb_build_array(jsonb_build_object('id',p_entry_id,'amount',p_amount,'paymentType',p_account,'createdAt',now(),'reference',ref));
 update public.ordens_servico set dados_extras=dados_extras||jsonb_build_object('advances',rows,'advance',current_advance+p_amount,'advancePayment',p_account,'advanceAt',now()) where id=p_order_id returning * into root;
 return to_jsonb(root);
end $$;

-- Permit only the existing owner mechanic correction through ready/delivered
-- guards, without releasing changes to prices, quantities, sectors or rates.
do $mechanic_guard$
declare namespace text; def text; guard text;
begin
 guard:='begin if current_setting(''cortez.trocando_mecanico'',true)=''on'' and lower(coalesce(auth.jwt()->>''email'',''''))=''cortezgaragemecanica@gmail.com'' and (to_jsonb(new)-''mecanico''-''dados_extras''-''atualizado_em'')=(to_jsonb(old)-''mecanico''-''dados_extras''-''atualizado_em'') and (new.dados_extras-''budget'')=(old.dados_extras-''budget'') and ((new.dados_extras->''budget'')-''services'')=((old.dados_extras->''budget'')-''services'') and (select coalesce(jsonb_agg(item-''mechanic''),''[]'') from jsonb_array_elements(coalesce(new.dados_extras->''budget''->''services'',''[]'')) item)=(select coalesce(jsonb_agg(item-''mechanic''),''[]'') from jsonb_array_elements(coalesce(old.dados_extras->''budget''->''services'',''[]'')) item) then return new;end if;';
 foreach namespace in array array['public','cortez_ae_private'] loop
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=namespace and p.proname='proteger_fluxo_estoque_os';
  execute regexp_replace(def,'\mbegin\M',guard,'i');
 end loop;
end $mechanic_guard$;
create or replace function public.mecanico_os_mista(p_os_id uuid,p_service_index integer,p_new_mechanic text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare root public.ordens_servico%rowtype; service jsonb; sector text; relation text; previous text; ref text; week date; day date;
begin
 if lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Somente proprietário' using errcode='42501';end if;
 select * into root from public.ordens_servico where id=p_os_id and coalesce((dados_extras->>'sectorMaster')::boolean,false) for update;
 service:=root.dados_extras->'budget'->'services'->p_service_index;
 if root.id is null or root.status<>'Entregue' or p_service_index<0 or service is null or nullif(trim(p_new_mechanic),'') is null then raise exception 'Serviço inválido';end if;
 previous:=service->>'mechanic';sector:=coalesce(service->>'sector','mecanica');relation:=case when sector='auto_eletrica' then 'ae_lancamentos_financeiros' else 'lancamentos_financeiros' end;
 perform set_config('cortez.trocando_mecanico','on',true);
 update public.ordens_servico set dados_extras=jsonb_set(dados_extras,array['budget','services',p_service_index::text,'mechanic'],to_jsonb(trim(p_new_mechanic))),mecanico=case when jsonb_array_length(dados_extras->'budget'->'services')=1 then trim(p_new_mechanic) else mecanico end where id=p_os_id;
 day:=coalesce(root.entregue_em,timezone('America/Sao_Paulo',now())::date);
 week:=case when lower(trim(p_new_mechanic)) in ('tony','gustavo') then day-(extract(isodow from day)::integer-1) else day-((extract(dow from day)::integer+1)%7) end;
 ref:='comissao-os-'||p_os_id::text||'-servico-'||(p_service_index+1)::text;
 execute format('update public.%I set mecanico=$1,semana_inicio=$2 where os_id=$3 and referencia=$4 and categoria=''Comissões'' and status<>''Realizado''',relation) using trim(p_new_mechanic),week,p_os_id,ref;
 return jsonb_build_object('orderId',p_os_id,'serviceIndex',p_service_index,'previousMechanic',previous,'newMechanic',trim(p_new_mechanic));
end $$;

create or replace function cortez_ae_private.marcar_os_mista() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare electrical boolean; mechanical boolean;
begin
 select bool_or(coalesce(item->>'sector','mecanica')='auto_eletrica'),bool_or(coalesce(item->>'sector','mecanica')='mecanica') into electrical,mechanical from (select value item from jsonb_array_elements(coalesce(new.dados_extras->'budget'->'parts','[]')) union all select value from jsonb_array_elements(coalesce(new.dados_extras->'budget'->'services','[]'))) x;
 if electrical or coalesce((new.dados_extras->>'sectorMaster')::boolean,false) then
  if not public.operador_dos_setores() then raise exception 'O.S. restrita aos setores operacionais.' using errcode='42501'; end if;
  new.dados_extras:=new.dados_extras||jsonb_build_object('sectorMaster',true,'sector',case when electrical and mechanical then 'mista' when electrical then 'auto_eletrica' else 'mecanica' end);
 end if;return new;
end $$;
create trigger os_marcar_setores before insert or update on public.ordens_servico for each row execute function cortez_ae_private.marcar_os_mista();

create or replace function cortez_ae_private.sincronizar_projecao_os() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare projected jsonb; existing public.ae_ordens_servico%rowtype; next_number bigint; ae_vehicle uuid;
begin
 if not coalesce((new.dados_extras->>'sectorMaster')::boolean,false) then return new; end if;
 if not public.operador_dos_setores() then raise exception 'Acesso operacional não autorizado.' using errcode='42501'; end if;
 projected:=cortez_ae_private.projecao_os(to_jsonb(new),'auto_eletrica');
 insert into public.ae_clientes select c.* from public.clientes c where c.id=new.cliente_id on conflict(id) do nothing;
 select v.id into ae_vehicle from public.ae_veiculos v join public.veiculos original on original.placa=v.placa where original.id=new.veiculo_id limit 1;
 if ae_vehicle is null then insert into public.ae_veiculos select v.* from public.veiculos v where v.id=new.veiculo_id on conflict(id) do nothing;ae_vehicle:=new.veiculo_id;end if;
 projected:=projected||jsonb_build_object('veiculo_id',ae_vehicle);
 select * into existing from public.ae_ordens_servico where id=new.id for update;
 if existing.id is null then
  perform pg_advisory_xact_lock(hashtext('ae-order-number'));
  select coalesce(max(numero),0)+1 into next_number from public.ae_ordens_servico;
  projected:=projected||jsonb_build_object('numero',next_number);
  insert into public.ae_ordens_servico(id,numero,cliente_id,veiculo_id,reclamacao,diagnostico,observacoes,avarias,mecanico,status,mao_obra,valor_pecas,desconto,total,pagamento,checklist,fotos,dados_extras,data_entrada,entregue_em)
  select id,numero,cliente_id,veiculo_id,reclamacao,diagnostico,observacoes,avarias,mecanico,status,mao_obra,valor_pecas,desconto,total,pagamento,checklist,fotos,dados_extras,data_entrada,entregue_em from jsonb_populate_record(null::public.ae_ordens_servico,projected);
 else
  update public.ae_ordens_servico set cliente_id=new.cliente_id,veiculo_id=ae_vehicle,reclamacao=new.reclamacao,diagnostico=new.diagnostico,observacoes=new.observacoes,mecanico=new.mecanico,status=new.status,mao_obra=(projected->>'mao_obra')::numeric,valor_pecas=(projected->>'valor_pecas')::numeric,desconto=(projected->>'desconto')::numeric,total=(projected->>'total')::numeric,pagamento=new.pagamento,dados_extras=projected->'dados_extras',entregue_em=new.entregue_em where id=new.id;
 end if;return new;
end $$;
create trigger os_sincronizar_setores after insert or update on public.ordens_servico for each row execute function cortez_ae_private.sincronizar_projecao_os();

create or replace function public.salvar_os_setores(p_row jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare existing public.ordens_servico%rowtype; saved public.ordens_servico%rowtype; id_os uuid:=(p_row->>'id')::uuid; n bigint; mec_vehicle uuid; original_ae public.ae_ordens_servico%rowtype;
begin
 if not public.operador_dos_setores() or not public.usuario_tem_permissao('editOrders') then raise exception 'Sem permissão para salvar a O.S.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(id_os::text));
 select * into existing from public.ordens_servico where id=id_os for update;
 if existing.id is null then
  if p_source<>'auto_eletrica' or not exists(select 1 from public.ae_ordens_servico where id=id_os) then raise exception 'O.S. não encontrada'; end if;
  select * into original_ae from public.ae_ordens_servico where id=id_os for update;
  if original_ae.status in ('Pronto para entrega','Entregue') and original_ae.dados_extras->'budget' is distinct from p_row->'dados_extras'->'budget' then raise exception 'Reabra a O.S. antes de alterar os serviços.';end if;
  insert into public.clientes select c.* from public.ae_clientes c where c.id=(p_row->>'cliente_id')::uuid on conflict(id) do nothing;
  select v.id into mec_vehicle from public.veiculos v join public.ae_veiculos original on original.placa=v.placa where original.id=(p_row->>'veiculo_id')::uuid limit 1;
  if mec_vehicle is null then insert into public.veiculos select v.* from public.ae_veiculos v where v.id=(p_row->>'veiculo_id')::uuid on conflict(id) do nothing;mec_vehicle:=(p_row->>'veiculo_id')::uuid;end if;
  p_row:=p_row||jsonb_build_object('veiculo_id',mec_vehicle);
  perform pg_advisory_xact_lock(hashtext('mechanical-order-number'));
  select greatest(coalesce(max(numero),0)+1,coalesce((p_row->>'numero')::bigint,1)) into n from public.ordens_servico;
  p_row:=p_row||jsonb_build_object('numero',n);
  insert into public.ordens_servico(id,numero,cliente_id,veiculo_id,reclamacao,diagnostico,observacoes,avarias,mecanico,status,mao_obra,valor_pecas,desconto,total,pagamento,checklist,fotos,dados_extras,data_entrada)
  select id,numero,cliente_id,veiculo_id,reclamacao,diagnostico,observacoes,avarias,mecanico,status,mao_obra,valor_pecas,desconto,total,pagamento,checklist,fotos,dados_extras,data_entrada from jsonb_populate_record(null::public.ordens_servico,p_row) returning * into saved;
 else
  update public.ordens_servico set reclamacao=p_row->>'reclamacao',diagnostico=p_row->>'diagnostico',observacoes=p_row->>'observacoes',avarias=p_row->>'avarias',mecanico=p_row->>'mecanico',status=p_row->>'status',mao_obra=(p_row->>'mao_obra')::numeric,valor_pecas=(p_row->>'valor_pecas')::numeric,desconto=(p_row->>'desconto')::numeric,total=(p_row->>'total')::numeric,pagamento=p_row->>'pagamento',checklist=p_row->'checklist',dados_extras=p_row->'dados_extras' where id=id_os returning * into saved;
 end if;
 return to_jsonb(saved);
end $$;

create or replace function public.finalizar_os_mista(p_order_id uuid,p_order_number text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare root public.ordens_servico%rowtype; ae public.ae_ordens_servico%rowtype; mec_items jsonb; ae_items jsonb; result jsonb;
begin
 if not public.operador_dos_setores() or not public.usuario_tem_permissao('readyOrders') then raise exception 'Sem permissão para finalizar a O.S.' using errcode='42501'; end if;
 select * into root from public.ordens_servico where id=p_order_id and coalesce((dados_extras->>'sectorMaster')::boolean,false) for update;
 if root.id is null then raise exception 'O.S. dos setores não encontrada'; end if;
 select coalesce(jsonb_agg(item),'[]') into mec_items from jsonb_array_elements(coalesce(p_items,'[]')) item where coalesce(item->>'sector','mecanica')='mecanica';
 select coalesce(jsonb_agg(item),'[]') into ae_items from jsonb_array_elements(coalesce(p_items,'[]')) item where item->>'sector'='auto_eletrica';
 result:=public.finalizar_os_pronta(p_order_id,p_order_number,mec_items);
 perform cortez_ae_private.finalizar_os_pronta(p_order_id,p_order_number,ae_items);
 select * into ae from public.ae_ordens_servico where id=p_order_id;
 update public.lancamentos_financeiros set valor=case when coalesce((root.dados_extras->>'warranty')::boolean,false) then 0 else greatest(0,root.total-ae.total-coalesce((root.dados_extras->>'advance')::numeric,0)+coalesce((ae.dados_extras->>'advance')::numeric,0)) end where os_id=p_order_id and referencia='receber-os-'||p_order_id::text and status='Pendente';
 return result;
end $$;
create or replace function public.reabrir_os_mista(p_order_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$begin if lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Somente proprietário' using errcode='42501';end if;perform 1 from public.ordens_servico where id=p_order_id for update;perform cortez_ae_private.reabrir_os_pronta(p_order_id);return public.reabrir_os_pronta(p_order_id);end$$;
create or replace function public.estornar_os_mista(p_order_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$begin if lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Somente proprietário' using errcode='42501';end if;perform 1 from public.ordens_servico where id=p_order_id for update;perform cortez_ae_private.estornar_os_entregue(p_order_id);return public.estornar_os_entregue(p_order_id);end$$;

-- Apply client-generated, per-sector closing operations in ONE transaction.
create or replace function public.aplicar_fechamento_setores(p_order_id uuid,p_plan jsonb,p_receipt jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op jsonb; data jsonb; relation text; existing jsonb; id_record uuid; ref text; saved jsonb:='[]'; row_data jsonb;
begin
 if not public.operador_dos_setores() or not public.usuario_pode_fechar_os() then raise exception 'Sem permissão para fechar O.S.' using errcode='42501';end if;
 perform 1 from public.ordens_servico where id=p_order_id and coalesce((dados_extras->>'sectorMaster')::boolean,false) for update;
 if not found then raise exception 'O.S. dos setores não encontrada';end if;
 if p_plan is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan)>2000 then raise exception 'Plano inválido';end if;
 for op in select value from jsonb_array_elements(p_plan) loop
  if op->>'sector' is null or op->>'sector' not in ('mecanica','auto_eletrica') then raise exception 'Setor inválido';end if;
  relation:=case when op->>'sector'='auto_eletrica' then 'ae_lancamentos_financeiros' else 'lancamentos_financeiros' end;data:=op->'body';
  if op->>'method'='POST' then
   if data->>'os_id' is distinct from p_order_id::text or not coalesce(public.lancamento_pertence_fechamento_os(data->>'categoria',data->>'referencia',p_order_id),false) then raise exception 'Lançamento fora da O.S.';end if;
   execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,os_id,referencia,semana_inicio) select categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,os_id,referencia,semana_inicio from jsonb_populate_record(null::public.%I,$1) on conflict(referencia) where referencia is not null do nothing returning to_jsonb(%I.*)',relation,relation,relation) into row_data using data;
   if row_data is not null then saved:=saved||jsonb_build_array(row_data);end if;
  else
   id_record:=(op->>'id')::uuid;execute format('select to_jsonb(f) from public.%I f where id=$1 and os_id=$2 for update',relation) into existing using id_record,p_order_id;
   if existing is null or not public.lancamento_pertence_fechamento_os(existing->>'categoria',existing->>'referencia',p_order_id) then raise exception 'Lançamento não pertence ao fechamento';end if;
   if existing->>'status'='Realizado' then continue;end if;
   if op->>'method'='DELETE' then execute format('delete from public.%I where id=$1 and status<>''Realizado''',relation) using id_record;
   elsif op->>'method'='PATCH' then
    data:=existing||data;
    if data->>'os_id' is distinct from p_order_id::text or data->>'referencia' is distinct from existing->>'referencia' then raise exception 'Vínculo inválido';end if;
    execute format('update public.%I f set categoria=x.categoria,movimento=x.movimento,descricao=x.descricao,valor=x.valor,vencimento=x.vencimento,status=x.status,mecanico=x.mecanico,forma_pagamento=x.forma_pagamento,semana_inicio=x.semana_inicio from jsonb_populate_record(null::public.%I,$1) x where f.id=$2',relation,relation) using data,id_record;
   else raise exception 'Operação inválida';end if;
  end if;
 end loop;
 if p_receipt is not null then update public.ordens_servico set dados_extras=dados_extras||jsonb_build_object('closingReceipt',p_receipt) where id=p_order_id;end if;
 return saved;
end $$;
revoke all on all functions in schema cortez_ae_private from public,anon,authenticated;
revoke all on function public.salvar_os_setores(jsonb,text),public.finalizar_os_mista(uuid,text,jsonb),public.reabrir_os_mista(uuid),public.estornar_os_mista(uuid),public.aplicar_fechamento_setores(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.salvar_os_setores(jsonb,text),public.finalizar_os_mista(uuid,text,jsonb),public.reabrir_os_mista(uuid),public.estornar_os_mista(uuid),public.aplicar_fechamento_setores(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.adiantamento_os_setores(uuid,numeric,text,uuid),public.mecanico_os_mista(uuid,integer,text),public.os_tem_setor_restrito(text) from public,anon;
grant execute on function public.adiantamento_os_setores(uuid,numeric,text,uuid),public.mecanico_os_mista(uuid,integer,text),public.os_tem_setor_restrito(text) to authenticated;
notify pgrst,'reload schema';
commit;
