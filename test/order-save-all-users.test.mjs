import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('todo usuário autenticado pode criar editar e concluir O.S.',async()=>{
  const[supabase,access,main,budget,sql]=await Promise.all([
    read('src/supabase.js'),read('src/access-control.js'),read('src/main.js'),
    read('src/budget-order.js'),read('supabase/liberar-salvamento-os-todos-usuarios.sql')
  ]);
  assert.doesNotMatch(supabase,/path\.startsWith\('\/rest\/v1\/ordens_servico'\).*somente para visualizar/);
  assert.match(supabase,/export function canSaveOrders\(\)/);
  assert.match(supabase,/ORDER_SAVE_PERMISSIONS=new Set\(\['createEntries','editOrders','readyOrders'\]\)/);
  assert.match(supabase,/export async function saveSupabase\(localDb\)[\s\S]*await writeDatabase\(session\.access_token,localDb\)/);
  assert.match(supabase,/body=\{reclamacao:[\s\S]*diagnostico:[\s\S]*observacoes:/);
  assert.match(supabase,/export async function saveOrderValues\(order\)[\s\S]*body=\{reclamacao:[\s\S]*diagnostico:[\s\S]*observacoes:[\s\S]*mecanico:/);
  assert.doesNotMatch(access,/if\(save&&!owner\)save\.remove\(\)/);
  assert.match(access,/function restricted\(\)\{return!canSaveOrders\(\)\}/);
  assert.match(main,/canSaveOrders as canManageServices/);
  assert.match(main,/async function createOrder\(\)[\s\S]*await saveOrderValues\(o\)/);
  assert.match(main,/queueOrderSave=snapshot[\s\S]*await saveOrderValues\(target\)/);
  assert.doesNotMatch(main,/restrictedProgress=!canManageServices\(\)/);
  assert.match(budget,/canSaveOrders as canManageServices/);
  assert.match(sql,/auth\.uid\(\) is null then false/);
  assert.match(sql,/p_permissao in \('createEntries', 'editOrders', 'readyOrders'\) then true/);
  assert.match(sql,/usuario_tem_permissao\('editOrders'\)/);
  assert.doesNotMatch(sql,/drop table|truncate|delete from/i);
});

test('permissões financeiras e administrativas continuam independentes',async()=>{
  const[supabase,sql]=await Promise.all([read('src/supabase.js'),read('supabase/liberar-salvamento-os-todos-usuarios.sql')]);
  assert.doesNotMatch(sql,/p_permissao in \([^)]*viewFinance/);
  assert.match(supabase,/function requireFinanceViewing\(\)\{if\(!hasPermission\('viewFinance'\)\)/);
  assert.match(supabase,/function requireFinanceEditing\(\)\{if\(currentEmail\(\)!==OWNER_EMAIL\)/);
});
