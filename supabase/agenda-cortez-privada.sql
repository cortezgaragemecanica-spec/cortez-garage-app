-- Ativa o mecânico Cortez e protege sua agenda de atendimento externo.
-- Execute no SQL Editor do projeto Supabase.

update public.sincronizacao configuracao
set dados = jsonb_set(
  configuracao.dados,
  '{items}',
  case
    when exists (
      select 1
      from jsonb_array_elements(coalesce(configuracao.dados -> 'items', '[]'::jsonb)) item
      where lower(coalesce(item ->> 'name', item #>> '{}')) = 'cortez'
    ) then coalesce((
      select jsonb_agg(
        case
          when lower(coalesce(item ->> 'name', item #>> '{}')) = 'cortez'
            then case
              when jsonb_typeof(item) = 'string'
                then jsonb_build_object('name', item #>> '{}', 'active', true)
              else item || jsonb_build_object('active', true)
            end
          else item
        end
      )
      from jsonb_array_elements(coalesce(configuracao.dados -> 'items', '[]'::jsonb)) item
    ), '[]'::jsonb)
    else coalesce(configuracao.dados -> 'items', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('name', 'Cortez', 'active', true))
  end,
  true
)
where configuracao.entidade = 'configuracao'
  and configuracao.registro_id = 'mecanicos';

drop policy if exists "agenda leitura" on public.agendamentos;
create policy "agenda leitura" on public.agendamentos
for select to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'cortezgaragemecanica@gmail.com'
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
);

drop policy if exists "agenda equipe conclui" on public.agendamentos;
create policy "agenda equipe conclui" on public.agendamentos
for update to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'cortezgaragemecanica@gmail.com'
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'cortezgaragemecanica@gmail.com'
  or lower(trim(coalesce(mecanico, ''))) <> 'cortez'
);
