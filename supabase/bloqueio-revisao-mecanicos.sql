-- Execute depois de permissoes-usuarios.sql.
-- O bloqueio fica no banco: mesmo uma requisição manual de um mecânico não
-- consegue alterar diagnóstico ou observação sem a revisão do proprietário.
create or replace function public.proteger_revisao_ordem_mecanico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.usuario_tem_permissao('manageValues') then
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

drop trigger if exists proteger_revisao_ordem_mecanico on public.ordens_servico;
create trigger proteger_revisao_ordem_mecanico
before update on public.ordens_servico
for each row execute function public.proteger_revisao_ordem_mecanico();
