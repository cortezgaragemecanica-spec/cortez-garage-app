import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('painel permite controlar entrada, edição de O.S. e visualização financeira',async()=>{
  const [admin,supabase]=await Promise.all([read('src/admin.js'),read('src/supabase.js')]);
  for(const label of ['Registrar nova entrada','Alterar ordens de serviço','Visualizar Financeiro · somente leitura'])assert.ok(admin.includes(label));
  for(const permission of ['createEntries','editOrders','viewFinance'])assert.match(supabase,new RegExp(permission));
  assert.match(supabase,/isMarcelino[\s\S]*createEntries:false,editOrders:false,viewFinance:true/);
});

test('espectador não altera O.S. nem Financeiro',async()=>{
  const [main,access,admin,supabase]=await Promise.all([read('src/main.js'),read('src/access-control.js'),read('src/admin.js'),read('src/supabase.js')]);
  assert.match(main,/r==='entry'&&!hasPermission\('createEntries'\)/);
  assert.match(access,/!hasPermission\('editOrders'\)/);
  assert.match(access,/orderReadOnlyFields/);
  assert.match(admin,/financeVisible/);
  assert.match(admin,/applyFinanceReadOnly/);
  assert.match(admin,/Modo espectador/);
  assert.match(supabase,/path\.startsWith\('\/rest\/v1\/ordens_servico'\).*hasPermission\('editOrders'\)/);
  assert.match(supabase,/path\.startsWith\('\/rest\/v1\/lancamentos_financeiros'\).*currentEmail\(\)!==OWNER_EMAIL/);
});

test('Supabase libera somente leitura financeira conforme painel',async()=>{
  const sql=await read('supabase/permissoes-usuarios.sql');
  assert.match(sql,/usuario_tem_permissao\(p_permissao text\)/);
  assert.match(sql,/for select to authenticated/);
  assert.match(sql,/usuario_tem_permissao\('viewFinance'\)/);
  assert.match(sql,/"createEntries":false,"editOrders":false,"viewFinance":true/);
  assert.doesNotMatch(sql,/for (insert|update|delete)/i);
});

