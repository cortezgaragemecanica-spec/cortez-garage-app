begin;

create or replace function public.acertar_piso_gustavo(p_caixa text default null,p_previa jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 hoje date:=timezone('America/Sao_Paulo',now())::date;
 semana date:=date_trunc('week',hoje-case when extract(isodow from hoje)=7 then 1 else 0 end)::date;
 gerado numeric; pago numeric; anterior numeric; base_anterior numeric; ids_m uuid[]; ids_e uuid[];
 saldo_m numeric; saldo_e numeric; total numeric; eletrica numeric;
 piso boolean; previa jsonb; ref text;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email',''))<>'cortezgaragemecanica@gmail.com' then
  raise exception 'Acesso restrito ao proprietário.' using errcode='42501';
 end if;
 if p_caixa is not null and p_caixa not in ('Banco do Brasil','Mercado Livre','Dinheiro') then raise exception 'Caixa inválido.'; end if;
 perform pg_advisory_xact_lock(hashtext('acerto-piso-gustavo'));
 if p_caixa is not null then
  lock table public.lancamentos_financeiros,public.ae_lancamentos_financeiros in share row exclusive mode;
 end if;
 select coalesce(sum(valor),0),max(split_part(referencia,':',2)::numeric) into pago,base_anterior from (
  select valor,referencia,semana_inicio from public.lancamentos_financeiros
  union all select valor,referencia,semana_inicio from public.ae_lancamentos_financeiros
 ) f where semana_inicio=semana and referencia like 'piso-gustavo-v1-%';
 with comissoes as (
  select valor,status,coalesce(semana_inicio,vencimento) as dia from public.lancamentos_financeiros where categoria='Comissões' and lower(trim(mecanico))='gustavo'
  union all
  select valor,status,coalesce(semana_inicio,vencimento) from public.ae_lancamentos_financeiros where categoria='Comissões' and lower(trim(mecanico))='gustavo'
 )
 select coalesce(sum(valor) filter(where dia between semana and semana+5),0),
        coalesce(sum(valor) filter(where dia between semana and semana+5 and status='Realizado'),0)
 into gerado,anterior from comissoes;
 -- A primeira baixa anterior à implantação já conta para atingir o piso.
 base_anterior:=coalesce(base_anterior,anterior);
 pago:=pago+base_anterior;
 piso:=gerado<1100 and pago<1100;
 select coalesce(array_agg(id order by id),'{}'),coalesce(sum(valor),0) into ids_m,saldo_m
 from public.lancamentos_financeiros
 where categoria='Comissões' and lower(trim(mecanico))='gustavo' and status<>'Realizado'
 and coalesce(semana_inicio,vencimento)<=semana+5
 and ((piso and vencimento<=hoje) or coalesce(semana_inicio,vencimento)>=semana);
 select coalesce(array_agg(id order by id),'{}'),coalesce(sum(valor),0) into ids_e,saldo_e
 from public.ae_lancamentos_financeiros
 where categoria='Comissões' and lower(trim(mecanico))='gustavo' and status<>'Realizado'
 and coalesce(semana_inicio,vencimento)<=semana+5
 and ((piso and vencimento<=hoje) or coalesce(semana_inicio,vencimento)>=semana);
 total:=greatest(0,greatest(1100,gerado)-pago);
 eletrica:=case when saldo_m+saldo_e>total and saldo_m+saldo_e>0 then round(total*saldo_e/(saldo_m+saldo_e),2) else least(total,saldo_e) end;
 previa:=jsonb_build_object('week',semana,'earned',gerado,'paid',pago,'total',total,'floor',piso,'electrical',eletrica,'mechanical',total-eletrica,'count',cardinality(ids_m)+cardinality(ids_e),'revision',md5(ids_m::text||ids_e::text||saldo_m::text||':'||saldo_e::text));
 if p_caixa is null then return previa; end if;
 if previa is distinct from p_previa then raise exception 'O acerto mudou. Abra a conferência do Gustavo novamente.'; end if;
 if total=0 and cardinality(ids_m)+cardinality(ids_e)=0 then return previa; end if;
 ref:='piso-gustavo-v1-'||semana||'-'||gen_random_uuid()||':'||base_anterior;
 if total>eletrica then
  insert into public.lancamentos_financeiros(categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,referencia,semana_inicio)
  values('Fluxo de caixa','Saída','Acerto semanal de comissões Gustavo',total-eletrica,hoje,'Realizado','Gustavo',p_caixa,ref,semana);
 end if;
 if eletrica>0 then
  insert into public.ae_lancamentos_financeiros(categoria,movimento,descricao,valor,vencimento,status,mecanico,forma_pagamento,referencia,semana_inicio)
  values('Fluxo de caixa','Saída','Acerto semanal de comissões Gustavo',eletrica,hoje,'Realizado','Gustavo',p_caixa,ref,semana);
 end if;
 update public.lancamentos_financeiros set status='Realizado',forma_pagamento=p_caixa where id=any(ids_m);
 update public.ae_lancamentos_financeiros set status='Realizado',forma_pagamento=p_caixa where id=any(ids_e);
 return previa;
end $$;
revoke all on function public.acertar_piso_gustavo(text,jsonb) from public,anon;
grant execute on function public.acertar_piso_gustavo(text,jsonb) to authenticated;
do $guard$
declare definition text:=pg_get_functiondef('public.pagar_comissoes_setor(text,uuid[],text)'::regprocedure);
begin
 if position('perform pg_advisory_xact_lock' in definition)=0 then raise exception 'Função de pagamentos incompatível.'; end if;
 execute replace(definition,'perform pg_advisory_xact_lock','if lower(trim(beneficiary))=''gustavo'' then raise exception ''Use o Acerto semanal do Gustavo.''; end if; perform pg_advisory_xact_lock');
end $guard$;
commit;
