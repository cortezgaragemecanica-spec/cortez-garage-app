-- Permite que rotinas autorizadas ajustem dados de uma O.S. que já está
-- entregue, sem confundir a edição com uma nova tentativa de entrega.
create or replace function public.proteger_fluxo_estoque_os()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Pronto para entrega'
     and old.status is distinct from 'Pronto para entrega'
     and coalesce(current_setting('cortez.finalizando_pronto', true), '') <> 'on' then
    raise exception 'Use o fluxo seguro para colocar a O.S. como pronta';
  end if;

  if old.status = 'Pronto para entrega'
     and new.status not in ('Pronto para entrega', 'Entregue')
     and coalesce(current_setting('cortez.reabrindo_pronto', true), '') <> 'on' then
    raise exception 'Use a reabertura com estorno para alterar esta O.S.';
  end if;

  if new.status = 'Entregue'
     and old.status is distinct from 'Entregue'
     and old.status <> 'Pronto para entrega' then
    raise exception 'Coloque a O.S. como pronta para entrega antes de entregá-la';
  end if;

  if old.status in ('Pronto para entrega', 'Entregue') and (
    new.mao_obra is distinct from old.mao_obra
    or new.valor_pecas is distinct from old.valor_pecas
    or new.desconto is distinct from old.desconto
    or new.total is distinct from old.total
    or new.dados_extras->'budget' is distinct from old.dados_extras->'budget'
  ) and coalesce(current_setting('cortez.trocando_mecanico', true), '') <> 'on' then
    raise exception 'Reabra a O.S. com estorno antes de alterar peças ou valores';
  end if;

  return new;
end;
$$;
