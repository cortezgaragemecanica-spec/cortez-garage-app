import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('totais da O.S. ignoram uma seção removida durante a troca de tela',async()=>{
  const budget=await read('src/budget-order.js');
  assert.match(budget,/if\(!section\|\|!partsLabel\|\|!servicesLabel\|\|!totalLabel\)return/);
  assert.match(budget,/if\(!section\.isConnected\)return/);
  assert.doesNotMatch(budget,/querySelector\('#partsTotal'\)\.textContent/);
});

test('falha visual ou demora do banco não prende o aplicativo no carregamento',async()=>{
  const[main,supabase,boot]=await Promise.all([read('src/main.js'),read('src/supabase.js'),read('src/boot.js')]);
  assert.match(main,/const recoverInterface=error=>/);
  assert.match(main,/catch\(error\)\{if\(!getSession\(\)\)return renderLogin\(start\);recoverInterface\(error\)\}/);
  assert.match(main,/try\{route='dashboard';shell\(\)/);
  assert.match(main,/Aplicativo aberto com os dados deste aparelho/);
  assert.match(main,/id="retryInterface"/);
  assert.match(supabase,/const REQUEST_TIMEOUT_MS=20000/);
  assert.match(supabase,/controller\.abort\(\)/);
  assert.match(boot,/id="retryAppBoot"/);
  assert.doesNotMatch(main,/catch\(error\)\{alert\(error\.message\);signOut\(\)\}/);
});
