-- Libera ao Kauã somente o Acerto Luizinho e a inclusão de contas a pagar pendentes.
-- Mantém caixa, contas a receber, comissões, pagamentos e demais configurações protegidos.

update public.sincronizacao configuracao
set dados = jsonb_set(
  configuracao.dados,
  '{users}',
  coalesce((
    select jsonb_agg(
      case
        when lower(coalesce(usuario ->> 'email', '')) in (
          'kaugg490@gmail.com',
          'kauavinicius.cortez@gmail.com',
          'kauavinicius.cortezz@gmail.com'
        )
        then usuario || jsonb_build_object(
          'permissions',
          coalesce(usuario -> 'permissions', '{}'::jsonb) || '{"viewFinance":true}'::jsonb
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

create or replace function public.kaua_salvar_acerto_luizinho(
  p_luizinho jsonb,
  p_devolucoes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  email_atual text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if email_atual not in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  ) then
    raise exception 'Somente Kauã pode usar esta gravação operacional';
  end if;

  update public.sincronizacao
  set dados = jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(dados, '{}'::jsonb), '{luizinho}', coalesce(p_luizinho, '[]'::jsonb), true),
      '{luizinhoReturns}', coalesce(p_devolucoes, '[]'::jsonb), true
    ),
    '{updatedAt}', to_jsonb(now()), true
  ),
  origem = 'app'
  where entidade = 'configuracao'
    and registro_id = 'acerto-fornecedores';

  if not found then
    insert into public.sincronizacao(origem, entidade, registro_id, dados)
    values (
      'app',
      'configuracao',
      'acerto-fornecedores',
      jsonb_build_object(
        'luizinho', coalesce(p_luizinho, '[]'::jsonb),
        'retifica', '[]'::jsonb,
        'luizinhoReturns', coalesce(p_devolucoes, '[]'::jsonb),
        'updatedAt', now()
      )
    );
  end if;
end
$$;

revoke all on function public.kaua_salvar_acerto_luizinho(jsonb, jsonb) from public;
grant execute on function public.kaua_salvar_acerto_luizinho(jsonb, jsonb) to authenticated;

drop policy if exists financeiro_kaua_conta_pagar_insert on public.lancamentos_financeiros;
create policy financeiro_kaua_conta_pagar_insert on public.lancamentos_financeiros
for insert to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and categoria = 'Conta a pagar'
  and movimento = 'Saída'
  and status = 'Pendente'
  and os_id is null
);

drop policy if exists sincronizacao_kaua_luizinho_select on public.sincronizacao;
create policy sincronizacao_kaua_luizinho_select on public.sincronizacao
for select to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and (
    (entidade = 'configuracao' and registro_id = 'acerto-fornecedores')
    or (entidade = 'configuracao' and registro_id like 'conta-categoria-%')
    or entidade = 'historico_devolucao_luizinho'
  )
);

drop policy if exists sincronizacao_kaua_luizinho_insert on public.sincronizacao;
create policy sincronizacao_kaua_luizinho_insert on public.sincronizacao
for insert to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and origem = 'app'
  and (
    (entidade = 'configuracao' and registro_id like 'conta-categoria-%')
    or entidade = 'historico_devolucao_luizinho'
  )
);

drop policy if exists sincronizacao_kaua_luizinho_update on public.sincronizacao;

grant select, insert on public.sincronizacao to authenticated;
grant select, insert on public.lancamentos_financeiros to authenticated;
