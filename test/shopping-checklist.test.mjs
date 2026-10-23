import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{approvedShoppingOrder,purchasedItem,shoppingGroups}from'../src/shopping-checklist-data.js';

test('lista de compras agrupa solicitações por O.S. e calcula o progresso',()=>{
  const requests=[
    {id:'r1',orderId:'o1',orderNumber:'127',createdAt:'2026-10-22T10:00:00Z',vehicle:{plate:'ABC1D23',model:'Gol'},requestedBy:{name:'Tony'},items:[{quantity:1,description:'Filtro',purchased:true},{quantity:2,description:'Óleo'}]},
    {id:'r2',orderId:'o1',orderNumber:'127',createdAt:'2026-10-23T10:00:00Z',requestedBy:{name:'Gustavo'},items:[{quantity:1,description:'Correia',purchasedAt:'2026-10-23T11:00:00Z'}]}
  ],orders=[{id:'o1',number:'127',status:'Em andamento',client:{name:'Cliente Teste'},vehicle:{plate:'ABC1D23',model:'Gol'}}],groups=shoppingGroups(requests,orders);
  assert.equal(groups.length,1);
  assert.equal(groups[0].client.name,'Cliente Teste');
  assert.equal(groups[0].total,3);
  assert.equal(groups[0].purchased,2);
  assert.equal(groups[0].pending,1);
  assert.equal(groups[0].items[2].requestId,'r2');
  assert.equal(purchasedItem(groups[0].items[1]),false);
});

test('Compras mostra somente O.S. aprovadas',()=>{
  assert.equal(approvedShoppingOrder({status:'Aguardando diagnóstico'}),false);
  assert.equal(approvedShoppingOrder({status:'Aguardando aprovação'}),false);
  assert.equal(approvedShoppingOrder({status:'Orçamento fora do pátio'}),false);
  assert.equal(approvedShoppingOrder({status:'Recusado'}),false);
  assert.equal(approvedShoppingOrder({status:'Em andamento'}),true);
  assert.equal(approvedShoppingOrder({status:'Aguardando peça'}),false);
  assert.equal(approvedShoppingOrder({status:'Pronto para entrega'}),false);
  assert.equal(approvedShoppingOrder({status:'Entregue'}),false);
  assert.equal(approvedShoppingOrder({status:'Em andamento',budget:{approved:false}}),false);
  assert.equal(approvedShoppingOrder({status:'Aguardando aprovação',budget:{approved:true}}),false);
  assert.equal(approvedShoppingOrder({status:'Em andamento',budget:{approved:true}}),true);
  const requests=[{id:'r1',orderId:'approved',items:[{description:'Filtro'}]},{id:'r2',orderId:'pending',items:[{description:'Óleo'}]}];
  const groups=shoppingGroups(requests,[{id:'approved',status:'Em andamento'},{id:'pending',status:'Aguardando aprovação'}]);
  assert.deepEqual(groups.map(group=>group.orderId),['approved']);
});

test('aba Compras e persistência do checklist são publicadas no aplicativo',async()=>{
  const[shopping,supabase,index,worker,style]=await Promise.all(['../src/shopping.js','../src/supabase.js','../index.html','../public/sw.js','../src/style.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const label of['Compras','Itens pendentes','Itens comprados','Pendentes','Concluídas','Todas'])assert.ok(shopping.includes(label));
  assert.match(shopping,/shopping-shortcut/);
  assert.match(shopping,/O\.S\. aprovadas em execução/);
  assert.match(shopping,/updatePurchaseChecklistItem\(requestId,itemIndex,checked\)/);
  assert.match(supabase,/export async function updatePurchaseChecklistItem/);
  assert.match(supabase,/purchasedAt:purchased\?now:null/);
  assert.match(supabase,/purchasedBy:purchased\?/);
  assert.match(index,/shopping\.js\?v=20261023-1/);
  assert.match(worker,/shopping-checklist-data\.js\?v=20261023-3/);
  assert.match(worker,/cortez-garage-v296-owner-order-requests/);
  assert.match(style,/\.shopping-order/);
});
