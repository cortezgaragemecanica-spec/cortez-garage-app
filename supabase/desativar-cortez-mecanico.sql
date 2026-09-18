update public.sincronizacao configuracao
set dados = jsonb_set(
  configuracao.dados,
  '{items}',
  coalesce((
    select jsonb_agg(
      case
        when lower(coalesce(item ->> 'name', item #>> '{}')) = 'cortez'
          then case
            when jsonb_typeof(item) = 'string'
              then jsonb_build_object('name', item #>> '{}', 'active', false)
            else item || jsonb_build_object('active', false)
          end
        else item
      end
    )
    from jsonb_array_elements(coalesce(configuracao.dados -> 'items', '[]'::jsonb)) item
  ), '[]'::jsonb),
  true
)
where configuracao.entidade = 'configuracao'
  and configuracao.registro_id = 'mecanicos';
