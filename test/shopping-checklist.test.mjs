import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{approvedShoppingOrder,purchasedItem,quotedPartForItem,quotedPurchaseItem,shoppingGroups}from'../src/shopping-checklist-data.js';

test('lista de compras agrupa solicitações por O.S. e calcula o progresso',()=>{
  const requests=[
    {id:'r1',orderId:'o1',orderNumber:'127',createdAt:'2026-10-22T10:00:00Z',vehicle:{plate:'ABC1D23',model:'Gol'},requestedBy:{name:'Tony'},items:[{quantity:1,description:'Filtro',purchased:true},{quantity:2,description:'Óleo'}]},
    {id:'r2',orderId:'o1',orderNumber:'127',createdAt:'2026-10-23T10:00:00Z',requestedBy:{name:'Gustavo'},items:[{quantity:1,description:'Correia',purchasedAt:'2026-10-23T11:00:00Z'}]}
  ],orders=[{id:'o1',number:'127',status:'Em andamento',client:{name:'Cliente Teste'},vehicle:{plate:'ABC1D23',model:'Gol'},budget:{parts:[{description:'Filtro',supplier:'Luizinho',cost:30},{description:'Óleo',supplier:'Auto Peças Sul',cost:25,quantity:2},{description:'Correia',supplier:'Distribuidora Centro',cost:80}]}}],groups=shoppingGroups(requests,orders);
  assert.equal(groups.length,1);
  assert.equal(groups[0].client.name,'Cliente Teste');
  assert.equal(groups[0].total,3);
  assert.equal(groups[0].purchased,2);
  assert.equal(groups[0].pending,1);
  assert.equal(groups[0].totalCost,160);
  assert.equal(groups[0].purchasedCost,110);
  assert.equal(groups[0].pendingCost,50);
  assert.equal(groups[0].items[0].supplier,'Luizinho');
  assert.equal(groups[0].items[1].costTotal,50);
  assert.equal(groups[0].items[2].requestId,'r2');
  assert.equal(purchasedItem(groups[0].items[1]),false);
});

test('Compras localiza fornecedor e custo orçados e sinaliza peça sem correspondência',()=>{
  const order={budget:{parts:[{code:'ABC-1',description:'Filtro de óleo',supplier:'Fornecedor A',cost:12.5},{description:'Peça recusada',supplier:'Fornecedor B',cost:90,refused:true}]}};
  assert.equal(quotedPartForItem({description:'Filtro de oleo'},order)?.supplier,'Fornecedor A');
  assert.deepEqual(quotedPurchaseItem({description:'Filtro de óleo',quantity:2},order),{description:'Filtro de óleo',quantity:2,supplier:'Fornecedor A',unitCost:12.5,costTotal:25,costIdentified:true});
  const missing=quotedPurchaseItem({description:'Peça recusada'},order);
  assert.equal(missing.supplier,'Fornecedor não informado');
  assert.equal(missing.costIdentified,false);
  assert.equal(missing.costTotal,0);
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
  for(const label of['Compras','Itens pendentes','Itens comprados','Pendentes','Concluídas','Todas','Fornecedor orçado','Custo total','Já comprado','Saldo de custo','Excluir compra'])assert.ok(shopping.includes(label));
  assert.match(shopping,/shopping-shortcut/);
  assert.match(shopping,/O\.S\. aprovadas em execução/);
  assert.match(shopping,/updatePurchaseChecklistItem\(requestId,itemIndex,checked\)/);
  assert.match(shopping,/deletePurchaseChecklistItem\(requestId,itemIndex\)/);
  assert.match(supabase,/export async function updatePurchaseChecklistItem/);
  assert.match(supabase,/export async function deletePurchaseChecklistItem/);
  assert.match(supabase,/items\.splice\(itemIndex,1\)/);
  assert.match(supabase,/deletedRequest:true/);
  assert.match(supabase,/purchasedAt:purchased\?now:null/);
  assert.match(supabase,/purchasedBy:purchased\?/);
  assert.match(index,/shopping\.js\?v=20261023-7/);
  assert.match(worker,/shopping-checklist-data\.js\?v=20261023-6/);
  assert.match(worker,/cortez-garage-v299-shopping-delete/);
  assert.match(style,/\.shopping-order/);
  assert.match(style,/\.shopping-cost-summary/);
  assert.match(style,/\.shopping-item-supplier/);
  assert.match(style,/\.shopping-delete-item/);
});
