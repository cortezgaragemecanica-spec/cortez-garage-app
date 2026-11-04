begin;
update public.sincronizacao s set dados=jsonb_set(s.dados,'{users}',(
  select jsonb_agg(case when u->>'email'='cortezgaragemotorcycles@gmail.com' then
    jsonb_set(u,'{permissions}',(select g->'permissions' from jsonb_array_elements(s.dados->'users') g where g->>'email'='gust.cribas@gmail.com' limit 1))
    else u end)
  from jsonb_array_elements(s.dados->'users') u
)) where s.entidade='configuracao' and s.registro_id='usuarios-permissoes'
and exists(select 1 from jsonb_array_elements(s.dados->'users') g where g->>'email'='gust.cribas@gmail.com');
create or replace function public.usuario_pode_fechar_os()
returns boolean language sql stable security definer set search_path=public as $$
select public.usuario_tem_permissao('closeOrders') and lower(coalesce(auth.jwt()->>'email','')) in (
 'cortezgaragemecanica@gmail.com','gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com'
)
$$;
notify pgrst,'reload schema';
commit;
