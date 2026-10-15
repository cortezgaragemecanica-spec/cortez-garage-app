import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('salvamento usa a versão recém-lida e tenta novamente sem falso conflito',async()=>{
  const source=await read('src/supabase.js');
  assert.match(source,/const expected=row\?\.atualizado_em\|\|''/);
  assert.match(source,/async function patchOrderRow/);
  assert.match(source,/const latest=await findOrderRow\(token,order\)/);
  assert.doesNotMatch(source,/A O\.S\. #[^`]+foi alterada em outro aparelho\. Reabra a O\.S\. e salve novamente/);
});

test('migração libera INSERT e UPDATE autenticados sem apagar dados',async()=>{
  const sql=await read('supabase/corrigir-bloqueios-salvamento-os-2026-10-15.sql');
  assert.match(sql,/p_permissao in \('createEntries', 'editOrders', 'readyOrders'\)/);
  assert.match(sql,/create policy os_criacao_autenticada/);
  assert.match(sql,/create policy os_alteracao_autenticada/);
  assert.match(sql,/grant select, insert, update on public\.ordens_servico to authenticated/);
  assert.doesNotMatch(sql,/\b(delete from|truncate|drop table)\b/i);
  assert.match(sql,/proteger_fluxo_estoque_os\(\) não é removido/);
});
