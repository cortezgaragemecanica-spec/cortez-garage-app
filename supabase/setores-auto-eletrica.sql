-- Isolamento aditivo. Não copia nem altera registros históricos.
-- As tabelas ae_* são novas; o schema privado guarda cópias das rotinas
-- operacionais instaladas, redirecionadas exclusivamente às novas tabelas.
begin;
set local check_function_bodies = off;
create schema if not exists cortez_ae_private;
revoke all on schema cortez_ae_private from public, anon, authenticated;

do $migration$
declare
  tables constant text[] := array['clientes','veiculos','ordens_servico','itens_os','estoque','agendamentos','lancamentos_financeiros','sincronizacao','conferencia_comissoes_mecanicos'];
  names constant text[] := array['alterar_mecanico_servico_entregue','comissoes_semana_mecanico','conferir_comissoes_semana_mecanico','estornar_os_entregue','finalizar_os_pronta','historico_conferencia_comissoes_mecanicos','inicio_semana_comissao_mecanico','kaua_salvar_acerto_luizinho','lancamento_pertence_fechamento_os','mecanico_atual_do_usuario','owner_delete_agendamento','owner_save_agendamento','proteger_fluxo_estoque_os','proteger_revisao_ordem_mecanico','reabrir_os_pronta','registrar_data_entrega_os','set_atualizado_em','sincronizar_conta_compras_os','usuario_pode_fechar_os','usuario_tem_permissao'];
  apis constant text[] := array['alterar_mecanico_servico_entregue','comissoes_semana_mecanico','conferir_comissoes_semana_mecanico','estornar_os_entregue','finalizar_os_pronta','historico_conferencia_comissoes_mecanicos','kaua_salvar_acerto_luizinho','owner_delete_agendamento','owner_save_agendamento','reabrir_os_pronta','sincronizar_conta_compras_os'];
  t text; other text; n text; definition text; signature text; args text; result text; body text; f record; r record;
begin
  -- Fail closed on rerun: a deployment must never rebuild an active sector.
  if to_regclass('public.ae_ordens_servico') is not null then
    raise exception 'Auto elétrica já instalada. Use uma migração incremental.';
  end if;
  foreach t in array tables loop
    execute format('create table public.%I (like public.%I including all)', 'ae_'||t,t);
    execute format('revoke all on public.%I from public, anon, authenticated','ae_'||t);
    execute format('alter table public.%I enable row level security','ae_'||t);
    execute format('alter table public.%I force row level security','ae_'||t);
    execute format('create policy ae_owner on public.%I for all to authenticated using (auth.uid() is not null and lower(coalesce(auth.jwt()->>''email'',''''))=''cortezgaragemecanica@gmail.com'') with check (auth.uid() is not null and lower(coalesce(auth.jwt()->>''email'',''''))=''cortezgaragemecanica@gmail.com'')','ae_'||t);
    execute format('grant select,insert,update,delete on public.%I to authenticated','ae_'||t);
    -- LIKE copies independent identity sequences, but not foreign keys.
    for r in select conname,pg_get_constraintdef(oid) as def from pg_constraint where conrelid=('public.'||t)::regclass and contype='f' loop
      definition:=r.def;
      foreach other in array tables loop
        definition:=regexp_replace(definition,'REFERENCES (public\.)?'||other||'\M','REFERENCES public.ae_'||other,'g');
      end loop;
      execute format('alter table public.%I add constraint %I %s','ae_'||t,'ae_'||r.conname,definition);
    end loop;
  end loop;
  -- No functions are inherited from extensions or unrelated application code.
  foreach n in array names loop
    for f in select p.*,pg_get_functiondef(p.oid) as def,pg_get_function_identity_arguments(p.oid) as ident from pg_proc p where pronamespace='public'::regnamespace and proname=n loop
      definition:=f.def;
      foreach other in array tables loop
        definition:=replace(definition,'public.'||other,'public.ae_'||other);
        -- Handle bare relations in older SQL bodies without modifying JSON keys.
        definition:=regexp_replace(definition,'\m(FROM|JOIN|UPDATE|INTO)\s+'||other||'\M','\1 public.ae_'||other,'gi');
      end loop;
      foreach other in array names loop
        definition:=replace(definition,'public.'||other,'cortez_ae_private.'||other);
      end loop;
      execute definition;
      signature:=format('cortez_ae_private.%I(%s)',n,f.ident);
      execute 'alter function '||signature||' set search_path = cortez_ae_private, public, pg_temp';
      execute 'revoke all on function '||signature||' from public, anon, authenticated';
      if n=any(apis) then
        select string_agg(format('%I',a),' , ' order by ord) into args from unnest(f.proargnames[1:f.pronargs]) with ordinality x(a,ord);
        result:=pg_get_function_result(f.oid);
        body:=case when f.proretset then 'return query select * from ' when f.prorettype='void'::regtype then 'perform ' else 'return ' end||format('cortez_ae_private.%I(%s);',n,coalesce(args,''));
        execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path=pg_catalog,public as %L','ae_'||n,pg_get_function_arguments(f.oid),result,
          'begin if auth.uid() is null or lower(coalesce(auth.jwt()->>''email'',''''))<>''cortezgaragemecanica@gmail.com'' then raise exception ''Acesso restrito ao proprietário.'' using errcode=''42501''; end if; '||body||' end');
        signature:=format('public.%I(%s)','ae_'||n,f.ident);
        execute 'revoke all on function '||signature||' from public, anon';
        execute 'grant execute on function '||signature||' to authenticated';
      end if;
    end loop;
  end loop;
  foreach t in array tables loop
    for r in select tgname,pg_get_triggerdef(oid) as def from pg_trigger where tgrelid=('public.'||t)::regclass and not tgisinternal loop
      definition:=replace(r.def,' ON public.'||t,' ON public.ae_'||t);
      foreach n in array names loop
        definition:=replace(definition,'FUNCTION public.'||n||'(','FUNCTION cortez_ae_private.'||n||'(');
        definition:=replace(definition,'FUNCTION '||n||'(','FUNCTION cortez_ae_private.'||n||'(');
      end loop;
      if definition not like '%cortez_ae_private.%' then raise exception 'Trigger não auditado: %',r.tgname; end if;
      execute definition;
    end loop;
  end loop;
end
$migration$;

alter table public.ae_lancamentos_financeiros add column base_comissao_socios numeric(14,2);
alter table public.ae_lancamentos_financeiros add constraint ae_sem_comissao_marcelino check (categoria<>'Comissões' or lower(coalesce(mecanico,''))<>'marcelino');
alter table public.ae_lancamentos_financeiros add constraint ae_fabiano_45 check (
  referencia not like 'partner-weekly-v2-%' or (
    categoria='Comissões' and mecanico='Fabiano' and base_comissao_socios is not null and base_comissao_socios>=0 and valor=round(base_comissao_socios*0.45,2)
  )
);

-- Atomic, idempotent commission payment. Sector determines the ledger; the
-- same beneficiary in the other sector can never be included in this payment.
create or replace function public.pagar_comissoes_setor(p_setor text,p_ids uuid[],p_caixa text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare
  relation text; beneficiary text; total numeric(14,2); selected jsonb; cash jsonb; ref text; count_selected integer;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Acesso restrito ao proprietário.' using errcode='42501'; end if;
  if p_setor not in ('mecanica','auto_eletrica') or p_setor is null then raise exception 'Setor inválido'; end if;
  if p_caixa not in ('Banco do Brasil','Mercado Livre','Dinheiro') or p_caixa is null then raise exception 'Caixa inválido'; end if;
  if coalesce(cardinality(p_ids),0)=0 or array_position(p_ids,null) is not null then raise exception 'Selecione comissões'; end if;
  relation:=case when p_setor='auto_eletrica' then 'ae_lancamentos_financeiros' else 'lancamentos_financeiros' end;
  execute format('select min(mecanico),count(distinct mecanico),jsonb_agg(to_jsonb(f)) from public.%I f where id=any($1) and categoria=''Comissões''',relation) into beneficiary,count_selected,selected using p_ids;
  if count_selected<>1 or beneficiary is null or jsonb_array_length(selected)<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'Selecione comissões da mesma pessoa e setor'; end if;
  perform pg_advisory_xact_lock(hashtext('comissoes:'||p_setor||':'||beneficiary));
  execute format('select id from public.%I where id=any($1) order by id for update',relation) using p_ids;
  execute format('select count(*),jsonb_agg(to_jsonb(f)) from public.%I f where id=any($1) and categoria=''Comissões'' and mecanico=$2',relation) into count_selected,selected using p_ids,beneficiary;
  if count_selected<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'As comissões foram alteradas. Atualize a lista.'; end if;
  select 'pagamento-comissoes-setor-v1-'||md5(string_agg(id::text,',' order by id)) into ref from (select distinct unnest(p_ids) id) x;
  execute format('select to_jsonb(f) from public.%I f where referencia=$1',relation) into cash using ref;
  if cash is not null then return jsonb_build_object('records',selected,'cash',cash,'total',(cash->>'valor')::numeric,'sector',p_setor); end if;
  execute format('select coalesce(sum(valor),0) from public.%I where id=any($1) and status<>''Realizado''',relation) into total using p_ids;
  if total>0 then
    execute format('insert into public.%I (categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,referencia) values (''Fluxo de caixa'',''Saída'',$1,$2,timezone(''America/Sao_Paulo'',now())::date,''Realizado'',$3,$4,$5) returning to_jsonb(%I.*)',relation,relation)
      into cash using 'Pagamento consolidado de comissões '||beneficiary,total,beneficiary,p_caixa,ref;
    execute format('update public.%I set status=''Realizado'',forma_pagamento=$2 where id=any($1) and status<>''Realizado''',relation) using p_ids,p_caixa;
  end if;
  execute format('select jsonb_agg(to_jsonb(f)) from public.%I f where id=any($1)',relation) into selected using p_ids;
  return jsonb_build_object('records',selected,'cash',cash,'total',total,'sector',p_setor);
end
$fn$;
revoke all on function public.pagar_comissoes_setor(text,uuid[],text) from public,anon;
grant execute on function public.pagar_comissoes_setor(text,uuid[],text) to authenticated;

create or replace function public.resumo_caixas_setores()
returns table(sector text,account text,balance numeric) language plpgsql security definer set search_path=pg_catalog,public as $fn$
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Acesso restrito ao proprietário.' using errcode='42501'; end if;
 return query select 'mecanica'::text,forma_pagamento,sum(case when movimento='Entrada' then valor else -valor end) from public.lancamentos_financeiros where categoria='Fluxo de caixa' and status='Realizado' and forma_pagamento in ('Banco do Brasil','Mercado Livre','Dinheiro') group by forma_pagamento
 union all select 'auto_eletrica'::text,forma_pagamento,sum(case when movimento='Entrada' then valor else -valor end) from public.ae_lancamentos_financeiros where categoria='Fluxo de caixa' and status='Realizado' and forma_pagamento in ('Banco do Brasil','Mercado Livre','Dinheiro') group by forma_pagamento;
end $fn$;

create or replace function public.transferir_caixa_setores(p_origem text,p_caixa text,p_valor numeric,p_descricao text,p_referencia uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare source_table text; target_table text; ref text:='transferencia-setor-'||p_referencia::text; available numeric; existing record; today date:=timezone('America/Sao_Paulo',now())::date;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Acesso restrito ao proprietário.' using errcode='42501'; end if;
 if p_origem is null or p_origem not in ('mecanica','auto_eletrica') or p_caixa is null or p_caixa not in ('Banco do Brasil','Mercado Livre','Dinheiro') or p_valor is null or p_valor<>round(p_valor,2) or p_valor<=0 or p_referencia is null or length(trim(coalesce(p_descricao,'')))=0 then raise exception 'Transferência inválida'; end if;
 source_table:=case when p_origem='mecanica' then 'lancamentos_financeiros' else 'ae_lancamentos_financeiros' end;
 target_table:=case when p_origem='mecanica' then 'ae_lancamentos_financeiros' else 'lancamentos_financeiros' end;
 perform pg_advisory_xact_lock(hashtext('transferencia-setores:'||p_caixa));
 execute format('select valor,forma_pagamento from public.%I where referencia=$1',source_table) into existing using ref;
 if existing.valor is not null then
   if existing.valor<>p_valor or existing.forma_pagamento<>p_caixa then raise exception 'Referência já usada com outros valores'; end if;
   return jsonb_build_object('confirmed',true,'repeated',true);
 end if;
 execute format('select coalesce(sum(case when movimento=''Entrada'' then valor else -valor end),0) from public.%I where categoria=''Fluxo de caixa'' and status=''Realizado'' and forma_pagamento=$1',source_table) into available using p_caixa;
 if available<p_valor then raise exception 'Saldo insuficiente no caixa de origem'; end if;
 execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento,referencia) values(''Fluxo de caixa'',''Saída'',$1,$2,$3,''Realizado'',$4,$5)',source_table) using 'Transferência entre setores · '||p_descricao,p_valor,today,p_caixa,ref;
 execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento,referencia) values(''Fluxo de caixa'',''Entrada'',$1,$2,$3,''Realizado'',$4,$5)',target_table) using 'Transferência entre setores · '||p_descricao,p_valor,today,p_caixa,ref;
 return jsonb_build_object('confirmed',true,'amount',p_valor);
end $fn$;

create or replace function public.ratear_despesa_setores(p_valor numeric,p_percentual_eletrica numeric,p_descricao text,p_vencimento date,p_referencia uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare electric numeric; mechanical numeric; ref text:='despesa-rateada-'||p_referencia::text;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Acesso restrito ao proprietário.' using errcode='42501'; end if;
 if p_valor is null or p_valor<=0 or p_valor<>round(p_valor,2) or p_percentual_eletrica is null or p_percentual_eletrica<0 or p_percentual_eletrica>100 or p_vencimento is null or p_referencia is null or length(trim(coalesce(p_descricao,'')))=0 then raise exception 'Rateio inválido'; end if;
 perform pg_advisory_xact_lock(hashtext(ref));
 electric:=round(p_valor*p_percentual_eletrica/100,2);mechanical:=p_valor-electric;
 if exists(select 1 from public.lancamentos_financeiros where referencia=ref) or exists(select 1 from public.ae_lancamentos_financeiros where referencia=ref) then return jsonb_build_object('confirmed',true,'repeated',true); end if;
 if mechanical>0 then insert into public.lancamentos_financeiros(categoria,movimento,descricao,valor,vencimento,status,referencia) values('Conta a pagar','Saída','Despesa rateada · '||p_descricao,mechanical,p_vencimento,'Pendente',ref); end if;
 if electric>0 then insert into public.ae_lancamentos_financeiros(categoria,movimento,descricao,valor,vencimento,status,referencia) values('Conta a pagar','Saída','Despesa rateada · '||p_descricao,electric,p_vencimento,'Pendente',ref); end if;
 return jsonb_build_object('confirmed',true,'mecanica',mechanical,'auto_eletrica',electric);
end $fn$;
revoke all on function public.resumo_caixas_setores() from public,anon;
revoke all on function public.transferir_caixa_setores(text,text,numeric,text,uuid) from public,anon;
revoke all on function public.ratear_despesa_setores(numeric,numeric,text,date,uuid) from public,anon;
grant execute on function public.resumo_caixas_setores() to authenticated;
grant execute on function public.transferir_caixa_setores(text,text,numeric,text,uuid) to authenticated;
grant execute on function public.ratear_despesa_setores(numeric,numeric,text,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
