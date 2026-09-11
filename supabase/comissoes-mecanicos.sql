-- Visão protegida das comissões da semana para cada mecânico.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.conferencia_comissoes_mecanicos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  email text not null,
  mecanico text not null,
  semana_inicio date not null,
  conferido_em timestamptz not null default now(),
  unique (usuario_id, semana_inicio)
);

alter table public.conferencia_comissoes_mecanicos enable row level security;
revoke all on public.conferencia_comissoes_mecanicos from anon, authenticated;

create or replace function public.mecanico_atual_do_usuario()
returns text language sql stable security definer set search_path = public
as $$
  select nullif(trim(usuario ->> 'agendaMechanic'), '')
  from public.sincronizacao configuracao
  cross join lateral jsonb_array_elements(coalesce(configuracao.dados -> 'users', '[]'::jsonb)) usuario
  where configuracao.entidade = 'configuracao'
    and configuracao.registro_id = 'usuarios-permissoes'
    and lower(usuario ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce((usuario ->> 'active')::boolean, true)
  limit 1;
$$;

revoke all on function public.mecanico_atual_do_usuario() from public, anon;
grant execute on function public.mecanico_atual_do_usuario() to authenticated;

create or replace function public.comissoes_semana_mecanico()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_semana date;
  fim_semana date;
  mecanico_atual text;
  conferido timestamptz;
  itens jsonb;
  total numeric(12,2);
begin
  inicio_semana := agora_local::date - (extract(isodow from agora_local)::integer - 1);
  fim_semana := inicio_semana + 4;
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;

  select c.conferido_em into conferido
  from public.conferencia_comissoes_mecanicos c
  where c.usuario_id = auth.uid() and c.semana_inicio = inicio_semana limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'date', f.vencimento,
      'orderNumber', lpad(coalesce(o.numero::text, regexp_replace(f.descricao, '^.*#([0-9]+).*$', '\1')), 4, '0'),
      'vehicle', concat_ws(' · ', nullif(v.placa, ''), nullif(v.modelo, '')),
      'service', coalesce(nullif((
        select string_agg(nullif(trim(servico ->> 'description'), ''), ', ')
        from jsonb_array_elements(coalesce(o.dados_extras -> 'budget' -> 'services', '[]'::jsonb)) servico
        where lower(coalesce(nullif(servico ->> 'mechanic', ''), o.mecanico, '')) = lower(mecanico_atual)
          and coalesce(servico ->> 'refused', 'false') <> 'true'
      ), ''), 'Serviço da O.S.'),
      'amount', f.valor
    ) order by f.vencimento desc, o.numero desc), '[]'::jsonb),
    coalesce(sum(f.valor), 0)
  into itens, total
  from public.lancamentos_financeiros f
  left join public.ordens_servico o on o.id = f.os_id
  left join public.veiculos v on v.id = o.veiculo_id
  where f.categoria = 'Comissões'
    and f.status <> 'Realizado'
    and lower(trim(coalesce(f.mecanico, ''))) = lower(trim(mecanico_atual))
    and coalesce(f.semana_inicio, f.vencimento - (extract(isodow from f.vencimento)::integer - 1)) = inicio_semana;

  return jsonb_build_object(
    'mechanic', mecanico_atual, 'weekStart', inicio_semana, 'weekEnd', fim_semana,
    'total', total, 'items', itens, 'confirmedAt', conferido,
    'canConfirm', conferido is null and extract(isodow from agora_local) = 5
      and agora_local::time >= time '17:00' and agora_local::time <= time '21:00'
      and jsonb_array_length(itens) > 0
  );
end;
$$;

revoke all on function public.comissoes_semana_mecanico() from public, anon;
grant execute on function public.comissoes_semana_mecanico() to authenticated;

create or replace function public.conferir_comissoes_semana_mecanico()
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare
  agora_local timestamp := timezone('America/Sao_Paulo', now());
  inicio_semana date;
  mecanico_atual text;
  confirmado timestamptz;
begin
  inicio_semana := agora_local::date - (extract(isodow from agora_local)::integer - 1);
  mecanico_atual := public.mecanico_atual_do_usuario();
  if mecanico_atual is null then raise exception 'Este usuário não possui um mecânico vinculado.'; end if;
  if extract(isodow from agora_local) <> 5 or agora_local::time < time '17:00' or agora_local::time > time '21:00' then
    raise exception 'A conferência fica disponível somente na sexta-feira, das 17h às 21h.';
  end if;
  if not exists (
    select 1 from public.lancamentos_financeiros f
    where f.categoria = 'Comissões' and f.status <> 'Realizado'
      and lower(trim(coalesce(f.mecanico, ''))) = lower(trim(mecanico_atual))
      and coalesce(f.semana_inicio, f.vencimento - (extract(isodow from f.vencimento)::integer - 1)) = inicio_semana
  ) then raise exception 'Não há comissões pendentes nesta semana para conferir.'; end if;

  insert into public.conferencia_comissoes_mecanicos (usuario_id, email, mecanico, semana_inicio)
  values (auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), mecanico_atual, inicio_semana)
  on conflict (usuario_id, semana_inicio) do update
    set conferido_em = public.conferencia_comissoes_mecanicos.conferido_em
  returning conferido_em into confirmado;
  return confirmado;
end;
$$;

revoke all on function public.conferir_comissoes_semana_mecanico() from public, anon;
grant execute on function public.conferir_comissoes_semana_mecanico() to authenticated;

create or replace function public.historico_conferencia_comissoes_mecanicos()
returns table (
  confirmation_id uuid,
  user_email text,
  mechanic text,
  week_start date,
  confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'cortezgaragemecanica@gmail.com' then
    raise exception 'Somente o proprietário pode consultar este histórico.';
  end if;

  return query
  select c.id, c.email, c.mecanico, c.semana_inicio, c.conferido_em
  from public.conferencia_comissoes_mecanicos c
  order by c.semana_inicio desc, c.conferido_em desc;
end;
$$;

revoke all on function public.historico_conferencia_comissoes_mecanicos() from public, anon;
grant execute on function public.historico_conferencia_comissoes_mecanicos() to authenticated;
