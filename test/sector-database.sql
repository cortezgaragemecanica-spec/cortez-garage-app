-- Append to the migration before COMMIT, and terminate the combined script
-- with ROLLBACK. These assertions never persist test records.
do $tests$
declare item record;
begin
 for item in select * from (values ('BB','Banco do Brasil'),('Banco do Brasil','Banco do Brasil'),('ML','Mercado Livre'),('Cartão de crédito','Mercado Livre'),('cartao debito','Mercado Livre'),('Pix','Dinheiro'),('Dinheiro','Dinheiro'),(null,'Dinheiro'),('Sem movimentação de caixa',null),('Transferido para contas a pagar',null)) cases(payment,account) loop
  if cortez_ae_private.caixa_lancamento(item.payment) is distinct from item.account then raise exception 'Caixa legado incorreto: %',item.payment; end if;
 end loop;
end $tests$;
create temp table sector_existing_snapshot as select 'ordens_servico' as relation,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) as fingerprint from public.ordens_servico t
union all select 'clientes',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.clientes t
union all select 'veiculos',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.veiculos t
union all select 'estoque',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.estoque t
union all select 'lancamentos_financeiros',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.lancamentos_financeiros t
union all select 'sincronizacao',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.sincronizacao t;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"cortezgaragemecanica@gmail.com","role":"authenticated"}',true);
set local role authenticated;
do $tests$
declare
 c uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); stock uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); result jsonb; qty numeric; ref uuid:=gen_random_uuid(); mc uuid:=gen_random_uuid(); before_balance numeric;
begin
 insert into public.ae_clientes(id,nome) values(c,'Teste isolado');
 insert into public.ae_veiculos(id,cliente_id,placa,modelo) values(v,c,'TESTE-AE','Veículo isolado');
 insert into public.ae_estoque(id,codigo,descricao,quantidade,valor_unitario) values(stock,'TESTE-AE','Peça',3,100);
 insert into public.ae_ordens_servico(id,numero,cliente_id,veiculo_id,reclamacao,diagnostico,observacoes,mecanico,status,mao_obra,valor_pecas,desconto,total,pagamento,dados_extras)
 values(o,999999,c,v,'Reclamação','Diagnóstico',repeat('Observação longa ',1000),'Tony','Em andamento',200,100,10,290,'Pix',jsonb_build_object('budget',jsonb_build_object('services',jsonb_build_array(jsonb_build_object('description',repeat('Serviço longo ',1000),'value',200,'mechanic','Tony','commissionRate',0.5)),'parts',jsonb_build_array(jsonb_build_object('description','Peça','value',100,'cost',50,'quantity',1)))));
 update public.ae_ordens_servico set diagnostico='Diagnóstico atualizado',observacoes=observacoes||' Salvo' where id=o;
 if not exists(select 1 from public.ae_ordens_servico where id=o and total=290 and diagnostico='Diagnóstico atualizado' and length(observacoes)>10000 and dados_extras->'budget'->'services'->0->>'description'=repeat('Serviço longo ',1000)) then raise exception 'Falha de persistência'; end if;
 if (select count(*) from public.ae_ordens_servico where id=o)<>1 then raise exception 'O.S. duplicada'; end if;
 perform public.ae_finalizar_os_pronta(o,'999999',jsonb_build_array(jsonb_build_object('stockId',stock,'description','Peça','quantity',1,'saleValue',100)));
 perform public.ae_finalizar_os_pronta(o,'999999',jsonb_build_array(jsonb_build_object('stockId',stock,'description','Peça','quantity',1,'saleValue',100)));
 select quantidade into qty from public.ae_estoque where id=stock;
 if qty<>2 then raise exception 'Baixa duplicada ou não aplicada: %',qty; end if;
 update public.ae_ordens_servico set status='Entregue' where id=o;
 if not exists(select 1 from public.ae_ordens_servico where id=o and status='Entregue' and cliente_id=c and veiculo_id=v and pagamento='Pix') then raise exception 'Entrega não persistida'; end if;
 insert into public.ae_lancamentos_financeiros(id,categoria,movimento,descricao,valor,status,mecanico,referencia,base_comissao_socios,vencimento)
 values(a,'Comissões','Saída','Fabiano',45,'Pendente','Fabiano','partner-weekly-v2-fabiano-test-'||o,100,current_date),
       (b,'Comissões','Saída','Tony',100,'Pendente','Tony','comissao-test-'||o,null,current_date);
 begin
   insert into public.ae_lancamentos_financeiros(categoria,movimento,descricao,valor,mecanico,vencimento) values('Comissões','Saída','Proibido',10,'Marcelino',current_date);
   raise exception 'ACEITOU MARCELINO';
 exception when check_violation then null; end;
 begin
   update public.ae_lancamentos_financeiros set valor=46 where id=a;
   raise exception 'ACEITOU PERCENTUAL ERRADO';
 exception when check_violation then null; end;
 result:=public.pagar_comissoes_setor('auto_eletrica',array[a],'Dinheiro');
 if (result->>'total')::numeric<>45 then raise exception 'Valor consolidado incorreto'; end if;
 result:=public.pagar_comissoes_setor('auto_eletrica',array[a],'Dinheiro');
 if (select count(*) from public.ae_lancamentos_financeiros where categoria='Fluxo de caixa')<>1 then raise exception 'Pagamento duplicado'; end if;
 perform public.pagar_comissoes_setor('auto_eletrica',array[b],'Banco do Brasil');
 if not exists(select 1 from public.ae_lancamentos_financeiros where id=b and status='Realizado') then raise exception 'Mecânico sem baixa'; end if;
 -- Exercise mechanical payments, shared expenses and transfers in a nested
 -- rollback: no synthetic row or movement survives in the original ledger.
 begin
  insert into public.lancamentos_financeiros(id,categoria,movimento,descricao,valor,vencimento,status,mecanico) values(mc,'Comissões','Saída','TESTE ISOLADO',12,current_date,'Pendente','Tony');
  result:=public.pagar_comissoes_setor('mecanica',array[mc],'Dinheiro');
  if (result->>'total')::numeric<>12 or (select count(*) from public.ae_lancamentos_financeiros where categoria='Fluxo de caixa')<>2 then raise exception 'Mecânico pago no setor errado'; end if;
  insert into public.ae_lancamentos_financeiros(categoria,movimento,descricao,valor,vencimento,status,forma_pagamento) values('Fluxo de caixa','Entrada','TESTE APORTE',1000,current_date,'Realizado','Dinheiro');
  select sum(balance) into before_balance from public.resumo_caixas_setores();
  perform public.transferir_caixa_setores('auto_eletrica','Dinheiro',10.01,'TESTE',ref);
  perform public.transferir_caixa_setores('auto_eletrica','Dinheiro',10.01,'TESTE',ref);
  if (select sum(balance) from public.resumo_caixas_setores())<>before_balance then raise exception 'Transferência alterou consolidado'; end if;
  if (select count(*) from public.ae_lancamentos_financeiros where referencia='transferencia-setor-'||ref::text)<>1 then raise exception 'Transferência duplicada'; end if;
  ref:=gen_random_uuid();
  result:=public.ratear_despesa_setores(100.01,33.33,'TESTE',current_date,ref);
  if (result->>'mecanica')::numeric+(result->>'auto_eletrica')::numeric<>100.01 then raise exception 'Perda de centavos'; end if;
  perform public.ratear_despesa_setores(100.01,33.33,'TESTE',current_date,ref);
  if (select count(*) from public.ae_lancamentos_financeiros where referencia='despesa-rateada-'||ref::text)<>1 then raise exception 'Rateio duplicado'; end if;
  raise exception 'ROLLBACK_TESTE_OK';
 exception when raise_exception then if sqlerrm<>'ROLLBACK_TESTE_OK' then raise; end if; end;
 begin
   perform public.pagar_comissoes_setor('mecanica',array[a],'Dinheiro');
   raise exception 'ACEITOU OUTRO SETOR';
 exception when raise_exception then if sqlerrm='ACEITOU OUTRO SETOR' then raise; end if; end;
end
$tests$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","email":"marcelino-teste@example.invalid","role":"authenticated"}',true);
do $tests$
begin
 if exists(select 1 from public.ae_ordens_servico) or exists(select 1 from public.ae_clientes) or exists(select 1 from public.ae_veiculos) or exists(select 1 from public.ae_estoque) or exists(select 1 from public.ae_lancamentos_financeiros) or exists(select 1 from public.ae_sincronizacao) or exists(select 1 from public.ae_agendamentos) then raise exception 'Vazamento de informações'; end if;
 begin
  insert into public.ae_clientes(nome) values('Intruso'); raise exception 'ACEITOU INSERT';
 exception when insufficient_privilege then null; end;
 begin
  perform public.ae_sincronizar_conta_compras_os(gen_random_uuid(),true); raise exception 'ACEITOU RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform public.pagar_comissoes_setor('auto_eletrica',array[gen_random_uuid()],'Dinheiro'); raise exception 'ACEITOU PAGAMENTO';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.ae_ordens_servico)<>0 then raise exception 'Atualização externa visível'; end if;
end
$tests$;
reset role;
do $tests$
declare item record; actual text;
begin
 for item in select * from sector_existing_snapshot loop
  execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,'''' order by id),'''')) from public.%I t',item.relation) into actual;
  if actual<>item.fingerprint then raise exception 'Dado existente alterado em %',item.relation; end if;
 end loop;
end $tests$;
select 'PASSOU: persistência, textos longos, reabertura, status, estoque único, comissão 45%, pagamento único e isolamento por API' as resultado;
