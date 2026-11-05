-- Execute after the migration, in its transaction, before ROLLBACK.
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"cortezgaragemecanica@gmail.com","role":"authenticated"}',true);
create temp table test_mixed_ids as select gen_random_uuid() order_id,gen_random_uuid() client_id,gen_random_uuid() vehicle_id,gen_random_uuid() mechanical_stock,gen_random_uuid() electrical_stock;
grant select on test_mixed_ids to authenticated;
set local role authenticated;
do $tests$
declare fixture record; data jsonb; result jsonb; plan jsonb; entry_id uuid:=gen_random_uuid(); commission_id uuid;
begin
 select * into fixture from test_mixed_ids;
 insert into public.clientes(id,nome) values(fixture.client_id,'TESTE MISTO');
 insert into public.veiculos(id,cliente_id,placa,modelo) values(fixture.vehicle_id,fixture.client_id,'MISTO-TESTE','Veículo de teste');
 insert into public.estoque(id,codigo,descricao,quantidade,valor_unitario) values(fixture.mechanical_stock,'MEC-TESTE','Peça Mecânica',3,100);
 insert into public.ae_estoque(id,codigo,descricao,quantidade,valor_unitario) values(fixture.electrical_stock,'AE-TESTE','Peça elétrica',4,200);
 insert into public.ordens_servico(id,numero,cliente_id,veiculo_id,status,mao_obra,valor_pecas,total,dados_extras) values(fixture.order_id,999998,fixture.client_id,fixture.vehicle_id,'Em andamento',700,300,1000,jsonb_build_object('budget',jsonb_build_object('parts',jsonb_build_array(jsonb_build_object('description','Peça Mecânica','value',100,'cost',50,'quantity',1,'sector','mecanica','stockId',fixture.mechanical_stock,'stockMode','stock'),jsonb_build_object('description','Peça elétrica','value',200,'cost',100,'quantity',1,'sector','auto_eletrica','stockId',fixture.electrical_stock,'stockMode','stock')),'services',jsonb_build_array(jsonb_build_object('description','Freio','value',300,'mechanic','Tony','commissionRate',0.5,'sector','mecanica'),jsonb_build_object('description','Alternador','value',400,'mechanic','Gustavo','commissionRate',0.5,'sector','auto_eletrica')))));
 if not exists(select 1 from public.ordens_servico where id=fixture.order_id and dados_extras->>'sector'='mista' and (dados_extras->>'sectorMaster')::boolean and total=1000) then raise exception 'Documento completo não preservado';end if;
 if not exists(select 1 from public.ae_ordens_servico where id=fixture.order_id and total=600 and mao_obra=400 and valor_pecas=200 and jsonb_array_length(dados_extras->'budget'->'services')=1) then raise exception 'Projeção elétrica incorreta';end if;
 perform public.adiantamento_os_setores(fixture.order_id,100,'Dinheiro',entry_id);
 perform public.adiantamento_os_setores(fixture.order_id,100,'Dinheiro',entry_id);
 if (select sum(valor) from public.lancamentos_financeiros where os_id=fixture.order_id and categoria='Fluxo de caixa')<>40 or (select sum(valor) from public.ae_lancamentos_financeiros where os_id=fixture.order_id and categoria='Fluxo de caixa')<>60 then raise exception 'Adiantamento sem rateio ou duplicado';end if;
 result:=public.finalizar_os_mista(fixture.order_id,'999998',jsonb_build_array(jsonb_build_object('stockId',fixture.mechanical_stock,'description','Peça Mecânica','quantity',1,'sector','mecanica'),jsonb_build_object('stockId',fixture.electrical_stock,'description','Peça elétrica','quantity',1,'sector','auto_eletrica')));
 perform public.finalizar_os_mista(fixture.order_id,'999998',jsonb_build_array(jsonb_build_object('stockId',fixture.mechanical_stock,'description','Peça Mecânica','quantity',1,'sector','mecanica'),jsonb_build_object('stockId',fixture.electrical_stock,'description','Peça elétrica','quantity',1,'sector','auto_eletrica')));
 if (select quantidade from public.estoque where id=fixture.mechanical_stock)<>2 or (select quantidade from public.ae_estoque where id=fixture.electrical_stock)<>3 then raise exception 'Baixa incorreta ou duplicada';end if;
 if (select valor from public.lancamentos_financeiros where os_id=fixture.order_id and categoria='Conta a receber')<>360 or (select valor from public.ae_lancamentos_financeiros where os_id=fixture.order_id and categoria='Conta a receber')<>540 then raise exception 'Contas a receber fora do setor';end if;
 plan:=jsonb_build_array(
 jsonb_build_object('sector','mecanica','method','POST','body',jsonb_build_object('categoria','Fluxo de caixa','movimento','Entrada','descricao','TESTE MEC','valor',360,'vencimento',current_date,'status','Realizado','forma_pagamento','Dinheiro','os_id',fixture.order_id,'referencia','caixa-os-'||fixture.order_id)),
 jsonb_build_object('sector','auto_eletrica','method','POST','body',jsonb_build_object('categoria','Fluxo de caixa','movimento','Entrada','descricao','TESTE AE','valor',540,'vencimento',current_date,'status','Realizado','forma_pagamento','Dinheiro','os_id',fixture.order_id,'referencia','caixa-os-'||fixture.order_id)),
 jsonb_build_object('sector','mecanica','method','POST','body',jsonb_build_object('categoria','Comissões','movimento','Saída','descricao','Tony · Freio','valor',150,'vencimento',current_date,'status','Pendente','mecanico','Tony','os_id',fixture.order_id,'referencia','comissao-os-'||fixture.order_id||'-servico-1')),
 jsonb_build_object('sector','auto_eletrica','method','POST','body',jsonb_build_object('categoria','Comissões','movimento','Saída','descricao','Gustavo · Alternador','valor',200,'vencimento',current_date,'status','Pendente','mecanico','Gustavo','os_id',fixture.order_id,'referencia','comissao-os-'||fixture.order_id||'-servico-2')));
 perform public.aplicar_fechamento_setores(fixture.order_id,plan,jsonb_build_object('total',1000,'receivedNow',1000,'netReceived',1000));
 perform public.aplicar_fechamento_setores(fixture.order_id,plan,jsonb_build_object('total',1000,'receivedNow',1000,'netReceived',1000));
 if (select count(*) from public.lancamentos_financeiros where os_id=fixture.order_id and referencia='caixa-os-'||fixture.order_id::text)<>1 or (select count(*) from public.ae_lancamentos_financeiros where os_id=fixture.order_id and referencia='caixa-os-'||fixture.order_id::text)<>1 then raise exception 'Caixa duplicado';end if;
 if (select sum(valor) from public.lancamentos_financeiros where os_id=fixture.order_id and categoria='Comissões')<>150 or (select sum(valor) from public.ae_lancamentos_financeiros where os_id=fixture.order_id and categoria='Comissões')<>200 then raise exception 'Comissões no setor errado';end if;
 update public.ordens_servico set status='Entregue' where id=fixture.order_id;
 if not exists(select 1 from public.ae_ordens_servico where id=fixture.order_id and status='Entregue') then raise exception 'Status divergente';end if;
 perform public.mecanico_os_mista(fixture.order_id,1,'Fabio');
 if not exists(select 1 from public.ae_lancamentos_financeiros where os_id=fixture.order_id and mecanico='Fabio' and valor=200) then raise exception 'Troca do mecânico não acompanhou o setor';end if;
 select id into commission_id from public.ae_lancamentos_financeiros where os_id=fixture.order_id and categoria='Comissões';
 perform public.pagar_comissoes_setor('auto_eletrica',array[commission_id],'Dinheiro');
 perform public.mecanico_os_mista(fixture.order_id,1,'Gustavo');
 if not exists(select 1 from public.ae_lancamentos_financeiros where id=commission_id and mecanico='Fabio' and status='Realizado') then raise exception 'Pagamento antigo modificado';end if;
end $tests$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","email":"gust.ribas@hotmail.com","role":"authenticated"}',true);
do $tests$
declare fixture record;
begin
 select * into fixture from test_mixed_ids;
 if not public.operador_dos_setores() then raise exception 'Gustavo sem acesso operacional';end if;
 if not exists(select 1 from public.ordens_servico where id=fixture.order_id) or not exists(select 1 from public.ae_ordens_servico where id=fixture.order_id) then raise exception 'Gustavo não enxerga os dois setores';end if;
 if public.usuario_tem_permissao('viewFinance') then raise exception 'Gustavo recebeu financeiro';end if;
end $tests$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","email":"marcelinocortez2910@gmail.com","role":"authenticated"}',true);
do $tests$
declare fixture record;
begin
 select * into fixture from test_mixed_ids;
 if public.operador_dos_setores() then raise exception 'Marcelino recebeu acesso operacional';end if;
 if exists(select 1 from public.ordens_servico where id=fixture.order_id) or exists(select 1 from public.ae_ordens_servico where id=fixture.order_id) then raise exception 'Documento misto exposto';end if;
 begin perform public.salvar_os_setores('{}','mecanica');raise exception 'ACEITOU';exception when insufficient_privilege then null;end;
 begin perform public.sincronizar_conta_compras_os(fixture.order_id,false);raise exception 'ACEITOU RPC RESTRITA';exception when insufficient_privilege then null;end;
 begin insert into public.sincronizacao(origem,entidade,registro_id,dados) values('app','configuracao','usuarios-permissoes','{}');raise exception 'ACEITOU PROMOCAO';exception when insufficient_privilege then null;end;
end $tests$;
reset role;
select 'PASSOU: O.S. única, setores por item, projeções, estoque, recebimento e comissões separados, Gustavo operacional e Marcelino protegido' as resultado;
