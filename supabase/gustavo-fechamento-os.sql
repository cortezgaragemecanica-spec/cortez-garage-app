-- Libera somente o fechamento operacional de O.S. para as contas do Gustavo.
-- O Financeiro e o Administrativo continuam bloqueados na interface e nas
-- demais políticas. Nenhum dado existente é removido por esta migração.

create or replace function public.usuario_pode_fechar_os()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.usuario_tem_permissao('closeOrders')
    and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'cortezgaragemecanica@gmail.com',
    'gust.cribas@gmail.com',
    'gust.ribas@gmail.com',
    'gust.ribas@hotmail.com'
  )
$$;

revoke all on function public.usuario_pode_fechar_os() from public;
grant execute on function public.usuario_pode_fechar_os() to authenticated;

create or replace function public.lancamento_pertence_fechamento_os(
  p_categoria text,
  p_referencia text,
  p_os_id uuid
) returns boolean
language sql
immutable
set search_path = public
as $$
  select p_os_id is not null and (
    (p_categoria = 'Conta a receber' and coalesce(p_referencia, '') like 'receber-os-%') or
    (p_categoria = 'Fluxo de caixa' and coalesce(p_referencia, '') like 'caixa-os-%') or
    (p_categoria = 'Comissões' and coalesce(p_referencia, '') like 'comissao-os-%')
  )
$$;

revoke all on function public.lancamento_pertence_fechamento_os(text, text, uuid) from public;
grant execute on function public.lancamento_pertence_fechamento_os(text, text, uuid) to authenticated;

create policy financeiro_fechamento_os_select on public.lancamentos_financeiros
for select to authenticated
using (
  public.usuario_pode_fechar_os()
  and public.lancamento_pertence_fechamento_os(categoria, referencia, os_id)
);

create policy financeiro_fechamento_os_insert on public.lancamentos_financeiros
for insert to authenticated
with check (
  public.usuario_pode_fechar_os()
  and public.lancamento_pertence_fechamento_os(categoria, referencia, os_id)
);

create policy financeiro_fechamento_os_update on public.lancamentos_financeiros
for update to authenticated
using (
  public.usuario_pode_fechar_os()
  and public.lancamento_pertence_fechamento_os(categoria, referencia, os_id)
)
with check (
  public.usuario_pode_fechar_os()
  and public.lancamento_pertence_fechamento_os(categoria, referencia, os_id)
);

create policy financeiro_fechamento_os_delete on public.lancamentos_financeiros
for delete to authenticated
using (
  public.usuario_pode_fechar_os()
  and status <> 'Realizado'
  and public.lancamento_pertence_fechamento_os(categoria, referencia, os_id)
);

-- Persiste a permissão no painel de usuários já existente.
update public.sincronizacao configuracao
set dados = jsonb_set(
  configuracao.dados,
  '{users}',
  coalesce((
    select jsonb_agg(
      case
        when lower(coalesce(usuario ->> 'email', '')) in (
          'gust.cribas@gmail.com',
          'gust.ribas@gmail.com',
          'gust.ribas@hotmail.com'
        )
        then usuario || jsonb_build_object(
          'permissions',
          coalesce(usuario -> 'permissions', '{}'::jsonb) || '{"closeOrders":true,"viewFinance":false,"viewPartnerCommissions":false}'::jsonb
        )
        else usuario
      end
    )
    from jsonb_array_elements(coalesce(configuracao.dados -> 'users', '[]'::jsonb)) usuario
  ), '[]'::jsonb),
  true
)
where configuracao.entidade = 'configuracao'
  and configuracao.registro_id = 'usuarios-permissoes';

grant select, insert, update, delete on public.lancamentos_financeiros to authenticated;
