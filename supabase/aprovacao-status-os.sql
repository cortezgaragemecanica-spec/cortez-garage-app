begin;
create table public.solicitacoes_status_os (
 id uuid primary key default gen_random_uuid(),
 os_id uuid not null,
 setor text not null check(setor in ('mecanica','auto_eletrica')),
 destino text not null check(destino in ('Pronto para entrega','Entregue')),
 pagamento jsonb,
 versao timestamptz not null,
 solicitado_por uuid not null default auth.uid(),
 criado_em timestamptz not null default now(),
 status text not null default 'Pendente' check(status in ('Pendente','Aprovado','Recusado'))
);
alter table public.solicitacoes_status_os enable row level security;
create policy status_os_owner on public.solicitacoes_status_os for all to authenticated
 using(lower(auth.jwt()->>'email')='cortezgaragemecanica@gmail.com')
 with check(lower(auth.jwt()->>'email')='cortezgaragemecanica@gmail.com');
grant select,update on public.solicitacoes_status_os to authenticated;
create or replace function public.solicitar_status_os(p_order_id uuid,p_setor text,p_status text,p_pagamento jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare row_data jsonb; saved public.solicitacoes_status_os;
begin
 if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) not in ('gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com')
 or not public.usuario_tem_permissao('editOrders') then raise exception 'Acesso não autorizado.' using errcode='42501';end if;
 if p_setor not in ('mecanica','auto_eletrica') or p_status not in ('Pronto para entrega','Entregue') then raise exception 'Solicitação inválida.';end if;
 if p_setor='mecanica' then select to_jsonb(o) into row_data from public.ordens_servico o where id=p_order_id;
 else select to_jsonb(o) into row_data from public.ae_ordens_servico o where id=p_order_id;end if;
 if row_data is null or row_data->>'status'='Entregue' then raise exception 'O.S. indisponível para solicitação.';end if;
 if p_status='Entregue' and (row_data->>'status'<>'Pronto para entrega' or nullif(p_pagamento->>'cashPayment','') is null) then raise exception 'Confirme a O.S. pronta e informe o recebimento.';end if;
 perform pg_advisory_xact_lock(hashtext('solicitar-status:'||p_order_id::text));
 if exists(select 1 from public.solicitacoes_status_os where os_id=p_order_id and setor=p_setor and status='Pendente') then raise exception 'Esta O.S. já aguarda conferência do proprietário.';end if;
 insert into public.solicitacoes_status_os(os_id,setor,destino,pagamento,versao)
 values(p_order_id,p_setor,p_status,p_pagamento,(row_data->>'atualizado_em')::timestamptz) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.solicitar_status_os(uuid,text,text,jsonb) from public,anon;
grant execute on function public.solicitar_status_os(uuid,text,text,jsonb) to authenticated;

create or replace function public.conferir_status_solicitado_os()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if lower(coalesce(auth.jwt()->>'email','')) in ('gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com') and new.status in ('Pronto para entrega','Entregue') and (tg_op='INSERT' or old.status is distinct from new.status) then
 raise exception 'Solicite a conferência do proprietário antes de alterar este status.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger conferir_status_solicitado before insert or update on public.ordens_servico for each row execute function public.conferir_status_solicitado_os();
create trigger conferir_status_solicitado before insert or update on public.ae_ordens_servico for each row execute function public.conferir_status_solicitado_os();
-- O proprietário executa os lançamentos após revisar a solicitação.
create or replace function public.usuario_pode_fechar_os() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and lower(auth.jwt()->>'email')='cortezgaragemecanica@gmail.com'
$$;

create or replace function cortez_ae_private.caixa_lancamento(p_forma text)
returns text language sql immutable set search_path=pg_catalog as $cash$
 select case
 when lower(coalesce(p_forma,'')) like any(array['%sem movimentação%','%sem movimentacao%','%transferido para contas a pagar%']) then null
 when lower(coalesce(p_forma,'')) like '%rede card%' or lower(p_forma)='luizinho' then 'Luizinho'
 when lower(coalesce(p_forma,'')) like any(array['%bb%','%banco do brasil%','%cielo%']) then 'Banco do Brasil'
 when lower(coalesce(p_forma,'')) like any(array['%ml%','%mercado%','%cartão%','%cartao%']) then 'Mercado Livre'
 else 'Dinheiro' end
$cash$;
do $accounts$
declare f record;
begin
 for f in select pg_get_functiondef(oid) definition from pg_proc where pronamespace in ('public'::regnamespace,'cortez_ae_private'::regnamespace) and proname in ('pagar_comissoes_setor','transferir_caixa_setores','ratear_despesa_setores','acertar_piso_gustavo') loop
  execute replace(f.definition,'''Banco do Brasil'',''Mercado Livre'',''Dinheiro''','''Banco do Brasil'',''Mercado Livre'',''Dinheiro'',''Luizinho''');
 end loop;
end $accounts$;

do $advance$
declare definition text:=pg_get_functiondef('public.adiantamento_os_setores(uuid,numeric,text,uuid)'::regprocedure);
begin
 definition:=replace(definition,'p_account not in (''Banco do Brasil'',''Mercado Livre'',''Dinheiro'')',
 'p_account not in (''Banco do Brasil'',''Mercado Livre'',''Dinheiro'',''Pix BB'',''Pix ML'',''Cartão máquina Cielo · Débito'',''Cartão máquina Cielo · Crédito'',''Cartão máquina Mercado Livre · Débito'',''Cartão máquina Mercado Livre · Crédito'',''Cartão máquina Rede Card (Luizinho) · Débito'',''Cartão máquina Rede Card (Luizinho) · Crédito'')');
 definition:=replace(definition,'(amounts->>sector)::numeric,p_account,p_order_id,ref',
 'round((amounts->>sector)::numeric*(1-case when p_account like ''%Rede Card%Débito'' then 0.015 when p_account like ''%Rede Card%Crédito'' then 0.05 when p_account like ''Cartão máquina%Débito'' then 0.025 when p_account like ''Cartão máquina%Crédito'' then 0.10 else 0 end),2),p_account,p_order_id,ref');
 execute definition;
end $advance$;
notify pgrst,'reload schema';
commit;
