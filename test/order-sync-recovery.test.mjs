import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('nova O.S. só informa sucesso depois da confirmação do banco',async()=>{
  const main=await read('src/main.js');
  assert.match(main,/async function createOrder\(\)/);
  assert.match(main,/button\.textContent='Salvando no banco…'/);
  assert.match(main,/clearTimeout\(syncTimer\);try\{await pushMovement\(\)/);
  assert.match(main,/salva e confirmada no banco de dados/);
  assert.match(main,/ficou salva neste aparelho, mas o banco ainda não confirmou/);
  assert.match(main,/setTimeout\(\(\)=>pushMovement\(\)/);
});

test('O.S. local ausente no banco é localizada pelo número e recuperada',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/async function findOrderRow\(token,order/);
  assert.match(supabase,/ordens_servico\?numero=eq\.\$\{number\}/);
  assert.match(supabase,/async function ensureOrderRow\(token,order\)/);
  assert.match(supabase,/const recovery=\{clients:\[order\.client\],vehicles:\[order\.vehicle\],orders:\[order\],counter:number\+1\}/);
  assert.match(supabase,/await writeDatabase\(token,recovery\)/);
  assert.match(supabase,/await ensureOrderRow\(session\.access_token,order\)/);
});

test('atualização de progresso exige confirmação de linha gravada',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/export async function saveOrderProgress/);
  assert.match(supabase,/prefer:'return=representation'/);
  assert.match(supabase,/if\(!saved\.length\)throw new Error\(`O banco não confirmou a atualização da O\.S\./);
});

test('mecânico descarta banco local pendente e sempre baixa a O.S. atual',async()=>{
  const[main,supabase]=await Promise.all([read('src/main.js'),read('src/supabase.js')]);
  assert.match(main,/if\(pending&&canManageServices\(\)\)await pushMovement\(\);else\{if\(pending\)localStorage\.removeItem\(PENDING_DB_KEY\);db=normalizeDatabase\(await syncSupabase\(db\)\)/);
  assert.match(supabase,/if\(!canManageServices\(\)\)return readDatabase\(session\.access_token\)/);
  assert.doesNotMatch(supabase,/if\(!canManageServices\(\)\)\{const remote=.*?await writeDatabase\(session\.access_token,localDb\)/s);
});

test('publicação invalida o cache dos módulos corrigidos',async()=>{
  const [index,worker]=await Promise.all([read('index.html'),read('public/sw.js')]);
  assert.match(index,/main\.js\?v=20261007-4/);
  assert.match(worker,/main\.js\?v=20261007-4&w=17/);
  assert.match(worker,/supabase\.js\?v=20261008-2/);
  assert.match(worker,/cortez-garage-v263-budget-parts/);
});
