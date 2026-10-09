-- Libera criação, edição e conclusão de O.S. para todo usuário autenticado.
-- Mantém as permissões independentes de Financeiro, estoque e administração.
create or replace function public.usuario_tem_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when p_permissao in ('createEntries', 'editOrders', 'readyOrders') then true
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

-- Diagnóstico e observações passam a seguir a permissão geral de edição da O.S.
-- O trigger é mantido, mas não bloqueia usuários autenticados autorizados a editar.
create or replace function public.proteger_revisao_ordem_mecanico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.usuario_tem_permissao('editOrders') then
    return new;
  end if;

  new.diagnostico := old.diagnostico;
  new.observacoes := old.observacoes;
  if old.dados_extras ? 'services' then
    new.dados_extras := jsonb_set(
      coalesce(new.dados_extras, '{}'::jsonb),
      '{services}',
      old.dados_extras -> 'services',
      true
    );
  else
    new.dados_extras := coalesce(new.dados_extras, '{}'::jsonb) - 'services';
  end if;
  return new;
end;
$$;
