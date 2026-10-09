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

test('falha visual na inicialização recupera a tela sem desconectar o usuário',async()=>{
  const main=await read('src/main.js');
  assert.match(main,/const recoverInterface=error=>/);
  assert.match(main,/catch\(error\)\{if\(!getSession\(\)\)return renderLogin\(start\);recoverInterface\(error\)\}/);
  assert.doesNotMatch(main,/catch\(error\)\{alert\(error\.message\);signOut\(\)\}/);
});
