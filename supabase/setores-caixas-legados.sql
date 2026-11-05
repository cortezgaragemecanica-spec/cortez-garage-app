-- Correção incremental: somente rotinas de cálculo, sem alterar lançamentos.
begin;
create or replace function cortez_ae_private.caixa_lancamento(p_forma text)
returns text language sql immutable set search_path=pg_catalog as $account$
 select case
 when lower(coalesce(p_forma,'')) like any(array['%sem movimentação%','%sem movimentacao%','%transferido para contas a pagar%']) then null
 when lower(coalesce(p_forma,'')) like any(array['%bb%','%banco do brasil%']) then 'Banco do Brasil'
 when lower(coalesce(p_forma,'')) like any(array['%ml%','%mercado%','%cartão%','%cartao%']) then 'Mercado Livre'
 else 'Dinheiro' end
$account$;
revoke all on function cortez_ae_private.caixa_lancamento(text) from public,anon,authenticated;

create or replace function public.resumo_caixas_setores()
returns table(sector text,account text,balance numeric) language plpgsql security definer set search_path=pg_catalog,public as $fn$
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then raise exception 'Acesso restrito ao proprietário.' using errcode='42501'; end if;
 return query select 'mecanica'::text,cortez_ae_private.caixa_lancamento(forma_pagamento),sum(case when movimento='Entrada' then valor else -valor end) from public.lancamentos_financeiros where categoria='Fluxo de caixa' and status='Realizado' and cortez_ae_private.caixa_lancamento(forma_pagamento) is not null group by cortez_ae_private.caixa_lancamento(forma_pagamento)
 union all select 'auto_eletrica'::text,cortez_ae_private.caixa_lancamento(forma_pagamento),sum(case when movimento='Entrada' then valor else -valor end) from public.ae_lancamentos_financeiros where categoria='Fluxo de caixa' and status='Realizado' and cortez_ae_private.caixa_lancamento(forma_pagamento) is not null group by cortez_ae_private.caixa_lancamento(forma_pagamento);
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
 execute format('select coalesce(sum(case when movimento=''Entrada'' then valor else -valor end),0) from public.%I where categoria=''Fluxo de caixa'' and status=''Realizado'' and cortez_ae_private.caixa_lancamento(forma_pagamento)=$1',source_table) into available using p_caixa;
 if available<p_valor then raise exception 'Saldo insuficiente no caixa de origem'; end if;
 execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento,referencia) values(''Fluxo de caixa'',''Saída'',$1,$2,$3,''Realizado'',$4,$5)',source_table) using 'Transferência entre setores · '||p_descricao,p_valor,today,p_caixa,ref;
 execute format('insert into public.%I(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento,referencia) values(''Fluxo de caixa'',''Entrada'',$1,$2,$3,''Realizado'',$4,$5)',target_table) using 'Transferência entre setores · '||p_descricao,p_valor,today,p_caixa,ref;
 return jsonb_build_object('confirmed',true,'amount',p_valor);
end $fn$;


notify pgrst,'reload schema';
commit;
