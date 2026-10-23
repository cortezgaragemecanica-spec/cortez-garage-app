import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{purchasedItem,shoppingGroups}from'../src/shopping-checklist-data.js';

test('lista de compras agrupa solicitações por O.S. e calcula o progresso',()=>{
  const requests=[
    {id:'r1',orderId:'o1',orderNumber:'127',createdAt:'2026-10-22T10:00:00Z',vehicle:{plate:'ABC1D23',model:'Gol'},requestedBy:{name:'Tony'},items:[{quantity:1,description:'Filtro',purchased:true},{quantity:2,description:'Óleo'}]},
    {id:'r2',orderId:'o1',orderNumber:'127',createdAt:'2026-10-23T10:00:00Z',requestedBy:{name:'Gustavo'},items:[{quantity:1,description:'Correia',purchasedAt:'2026-10-23T11:00:00Z'}]}
  ],orders=[{id:'o1',number:'127',client:{name:'Cliente Teste'},vehicle:{plate:'ABC1D23',model:'Gol'}}],groups=shoppingGroups(requests,orders);
  assert.equal(groups.length,1);
  assert.equal(groups[0].client.name,'Cliente Teste');
  assert.equal(groups[0].total,3);
  assert.equal(groups[0].purchased,2);
  assert.equal(groups[0].pending,1);
  assert.equal(groups[0].items[2].requestId,'r2');
  assert.equal(purchasedItem(groups[0].items[1]),false);
});

test('aba Compras e persistência do checklist são publicadas no aplicativo',async()=>{
  const[shopping,supabase,index,worker,style]=await Promise.all(['../src/shopping.js','../src/supabase.js','../index.html','../public/sw.js','../src/style.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const label of['Compras','Itens pendentes','Itens comprados','Pendentes','Concluídas','Todas'])assert.ok(shopping.includes(label));
  assert.match(shopping,/updatePurchaseChecklistItem\(requestId,itemIndex,checked\)/);
  assert.match(supabase,/export async function updatePurchaseChecklistItem/);
  assert.match(supabase,/purchasedAt:purchased\?now:null/);
  assert.match(supabase,/purchasedBy:purchased\?/);
  assert.match(index,/shopping\.js\?v=20261023-1/);
  assert.match(worker,/shopping-checklist-data\.js\?v=20261023-1/);
  assert.match(worker,/cortez-garage-v293-shopping-checklist/);
  assert.match(style,/\.shopping-order/);
});
