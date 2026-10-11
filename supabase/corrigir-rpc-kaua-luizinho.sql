-- Corrige de forma não destrutiva a gravação do Acerto Luizinho pelo Kauã.
-- Preserva todos os registros existentes e recarrega o cache de funções do PostgREST.

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
    raise exception 'Usuário sem acesso ao Acerto Luizinho';
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

revoke all on function public.kaua_salvar_acerto_luizinho(jsonb, jsonb) from public, anon;
grant execute on function public.kaua_salvar_acerto_luizinho(jsonb, jsonb) to authenticated;

-- Alternativa segura usada pelo aplicativo se o cache da função demorar a atualizar.
drop policy if exists sincronizacao_kaua_luizinho_update on public.sincronizacao;
create policy sincronizacao_kaua_luizinho_update on public.sincronizacao
for update to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and entidade = 'configuracao'
  and registro_id = 'acerto-fornecedores'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and origem = 'app'
  and entidade = 'configuracao'
  and registro_id = 'acerto-fornecedores'
);

drop policy if exists sincronizacao_kaua_luizinho_config_insert on public.sincronizacao;
create policy sincronizacao_kaua_luizinho_config_insert on public.sincronizacao
for insert to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'kaugg490@gmail.com',
    'kauavinicius.cortez@gmail.com',
    'kauavinicius.cortezz@gmail.com'
  )
  and origem = 'app'
  and entidade = 'configuracao'
  and registro_id = 'acerto-fornecedores'
);

grant select, insert, update on public.sincronizacao to authenticated;

notify pgrst, 'reload schema';
