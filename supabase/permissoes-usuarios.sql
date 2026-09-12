-- Permissões configuráveis do painel administrativo.
-- A função lê o cadastro salvo em sincronizacao/usuarios-permissoes.
create or replace function public.usuario_tem_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'cortezgaragemecanica@gmail.com' then true
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

-- Aplica o perfil solicitado ao Marcelino já cadastrado, preservando as demais permissões.
update public.sincronizacao configuracao
set dados = jsonb_set(
  configuracao.dados,
  '{users}',
  coalesce((
    select jsonb_agg(
      case
        when lower(coalesce(usuario ->> 'name', '')) ~ '(^|[[:space:]])marcelino([[:space:]]|$)'
        then usuario || jsonb_build_object(
          'permissions',
          coalesce(usuario -> 'permissions', '{}'::jsonb) || '{"createEntries":false,"editOrders":false,"viewFinance":true}'::jsonb
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

drop policy if exists financeiro_visualizacao_liberada on public.lancamentos_financeiros;
create policy financeiro_visualizacao_liberada on public.lancamentos_financeiros
for select to authenticated
using (public.usuario_tem_permissao('viewFinance'));
