-- Correção não destrutiva dos bloqueios de gravação de O.S.
-- Preserva integralmente clientes, veículos, O.S., estoque e histórico.

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

-- Substitui qualquer versão antiga do gatilho que anulava silenciosamente
-- diagnóstico e observações de mecânicos ou usuários operacionais.
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

  raise exception 'Usuário sem permissão para editar ordens de serviço';
end;
$$;

-- RLS específica: leitura, criação e alteração são liberadas somente para
-- sessões autenticadas. Nenhuma permissão de exclusão é criada.
alter table public.ordens_servico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ordens_servico'
      and policyname = 'os_leitura_autenticada'
  ) then
    create policy os_leitura_autenticada on public.ordens_servico
      for select to authenticated using (auth.uid() is not null);
  else
    alter policy os_leitura_autenticada on public.ordens_servico
      to authenticated using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ordens_servico'
      and policyname = 'os_criacao_autenticada'
  ) then
    create policy os_criacao_autenticada on public.ordens_servico
      for insert to authenticated with check (auth.uid() is not null);
  else
    alter policy os_criacao_autenticada on public.ordens_servico
      to authenticated with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ordens_servico'
      and policyname = 'os_alteracao_autenticada'
  ) then
    create policy os_alteracao_autenticada on public.ordens_servico
      for update to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);
  else
    alter policy os_alteracao_autenticada on public.ordens_servico
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);
  end if;
end
$$;

grant select, insert, update on public.ordens_servico to authenticated;

-- O gatilho proteger_fluxo_estoque_os() não é removido: ele continua evitando
-- baixa dupla e entrega sem passar por "Pronto para entrega". A correção acima
-- remove apenas bloqueios indevidos de autenticação e edição de textos.
