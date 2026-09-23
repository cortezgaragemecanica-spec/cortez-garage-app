-- Execute depois de permissoes-usuarios.sql e financeiro.sql.
-- Somente o proprietário ou quem pode concluir O.S. pode criar/alterar
-- a conta a receber automática de uma ordem.
drop policy if exists financeiro_os_insert on public.lancamentos_financeiros;
drop policy if exists financeiro_os_update on public.lancamentos_financeiros;

create policy financeiro_os_insert on public.lancamentos_financeiros
for insert to authenticated
with check (
  public.usuario_tem_permissao('readyOrders')
  and categoria = 'Conta a receber'
  and movimento = 'Entrada'
  and referencia like 'receber-os-%'
  and os_id is not null
);

create policy financeiro_os_update on public.lancamentos_financeiros
for update to authenticated
using (
  public.usuario_tem_permissao('readyOrders')
  and categoria = 'Conta a receber'
  and referencia like 'receber-os-%'
)
with check (
  public.usuario_tem_permissao('readyOrders')
  and categoria = 'Conta a receber'
  and movimento = 'Entrada'
  and referencia like 'receber-os-%'
  and os_id is not null
);
