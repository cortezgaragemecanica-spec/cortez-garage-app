-- Execute after piso-semanal-gustavo.sql in an isolated test database.
begin;
do $test$
declare
 today date:=timezone('America/Sao_Paulo',now())::date;
 week_start date:=(public.acertar_piso_gustavo()->>'week')::date;
 preview jsonb;
begin
 preview:=public.acertar_piso_gustavo();
 if (preview->>'total')::numeric<>1100 or (preview->>'count')::int<>0 then raise exception 'Piso com zero serviços'; end if;
 insert into public.lancamentos_financeiros(categoria,valor,vencimento,status,mecanico,semana_inicio) values
  ('Comissões',400,today,'Pendente','Gustavo',week_start),
  ('Comissões',100,week_start-3,'Pendente','Gustavo',week_start-7),
  ('Comissões',45,today,'Pendente','Tony',week_start);
 insert into public.ae_lancamentos_financeiros(categoria,valor,vencimento,status,mecanico,semana_inicio) values
  ('Comissões',300,today,'Pendente','Gustavo',week_start);
 preview:=public.acertar_piso_gustavo();
 if (preview->>'total')::numeric<>1100 or (preview->>'earned')::numeric<>700 or (preview->>'electrical')::numeric<>300 or (preview->>'count')::int<>3 then raise exception 'Prévia incorreta: %',preview; end if;
 perform public.acertar_piso_gustavo('Dinheiro',preview);
 if exists(select 1 from public.lancamentos_financeiros where categoria='Comissões' and mecanico='Gustavo' and status<>'Realizado')
 or exists(select 1 from public.ae_lancamentos_financeiros where categoria='Comissões' and mecanico='Gustavo' and status<>'Realizado')
 or not exists(select 1 from public.lancamentos_financeiros where mecanico='Tony' and status='Pendente') then raise exception 'Baixa incorreta'; end if;
 if (public.acertar_piso_gustavo()->>'total')::numeric<>0 then raise exception 'Pagamento duplicado'; end if;
 begin
  perform public.acertar_piso_gustavo('Dinheiro',preview);
  raise exception using errcode='XX000', message='Aceitou prévia antiga';
 exception when raise_exception then null;
 end;
 insert into public.ae_lancamentos_financeiros(categoria,valor,vencimento,status,mecanico,semana_inicio)
 values('Comissões',600,today,'Pendente','Gustavo',week_start);
 preview:=public.acertar_piso_gustavo();
 if (preview->>'total')::numeric<>200 then raise exception 'Diferença acima do piso incorreta: %',preview; end if;
 perform public.acertar_piso_gustavo('Dinheiro',preview);
 if (public.acertar_piso_gustavo()->>'total')::numeric<>0 then raise exception 'Saldo após complemento incorreto'; end if;
end $test$;
rollback;
begin;
do $test$
declare
 today date:=timezone('America/Sao_Paulo',now())::date;
 week_start date:=(public.acertar_piso_gustavo()->>'week')::date;
 preview jsonb;
begin
 insert into public.lancamentos_financeiros(categoria,valor,vencimento,status,mecanico,semana_inicio) values
  ('Comissões',1250,today,'Pendente','Gustavo',week_start);
 preview:=public.acertar_piso_gustavo();
 if (preview->>'total')::numeric<>1250 or (preview->>'floor')::boolean then raise exception 'Pagamento acima do piso incorreto'; end if;
 perform public.acertar_piso_gustavo('Dinheiro',preview);
 perform set_config('test.email','mecanico@example.test',true);
 begin
  perform public.acertar_piso_gustavo();
  raise exception 'Usuário sem permissão conseguiu acessar';
 exception when insufficient_privilege then null;
 end;
end $test$;
rollback;
