import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{appendOrderItemsOnly}from'../src/add-order-items.js';

const base={parts:[{description:'Filtro',code:'F1',quantity:1,cost:100,margin:30,value:130,refused:false}],services:[{description:'Diagnóstico',mechanic:'Fabio',value:200,refused:false}],paymentTerms:'Pix',warrantyTerms:'30 dias',approved:false};

test('Kauã pode anexar peça e serviço com valores sem modificar os existentes',()=>{
  const candidate={...base,parts:[...base.parts,{description:'Óleo',quantity:2,cost:0,margin:0,value:50,stockMode:'budget'}],services:[...base.services,{description:'Troca de óleo',mechanic:'Kaua',value:100}]};
  const result=appendOrderItemsOnly(base,candidate,20);
  assert.equal(result.partsTotal,230);
  assert.equal(result.servicesTotal,300);
  assert.equal(result.total,510);
  assert.deepEqual(result.budget.parts[0],base.parts[0]);
});

test('inclusão não libera exclusão, alteração de item anterior nem estoque',()=>{
  assert.throws(()=>appendOrderItemsOnly(base,{...base,parts:[]},0),/não permite excluir/);
  assert.throws(()=>appendOrderItemsOnly(base,{...base,parts:[{...base.parts[0],value:200},{description:'Óleo',quantity:1,value:50}]},0),/não permite alterar itens/);
  assert.throws(()=>appendOrderItemsOnly(base,{...base,parts:[...base.parts,{description:'Óleo',quantity:1,value:50,stockMode:'include'}]},0),/Inclusão no estoque não está liberada/);
  assert.throws(()=>appendOrderItemsOnly(base,{...base,paymentTerms:'A prazo',services:[...base.services,{description:'Serviço',value:50}]},0),/apenas incluir/);
});

test('peça antiga sem campos de custo e quantidade continua intacta',()=>{
  const old={parts:[{description:'Peça antiga',value:100}],services:[],approved:false};
  const edited={...old,parts:[{description:'Peça antiga',cost:100,margin:0,quantity:1,value:100},{description:'Nova peça',quantity:1,value:30}],services:[]};
  const result=appendOrderItemsOnly(old,edited,0);
  assert.equal(result.total,130);
  assert.deepEqual(result.budget.parts[0],old.parts[0]);
});

test('cadastros Kauã possuem só a permissão de inclusão e a gravação protege status e desconto',async()=>{
  const[supabase,admin,access,budget]=await Promise.all(['src/supabase.js','src/admin.js','src/access-control.js','src/budget-order.js'].map(file=>readFile(file,'utf8')));
  for(const email of['kaugg490@gmail.com','kauavinicius.cortez@gmail.com','kauavinicius.cortezz@gmail.com'])assert.match(supabase,new RegExp(`${email.replace(/\./g,'\\.')}.*manageValues:false,addOrderItems:true`));
  assert.match(supabase,/saveAddedOrderItems/);
  assert.match(supabase,/order\.status!==remote\.status/);
  assert.match(supabase,/order\.discount\|\|0/);
  assert.match(supabase,/atualizado_em=eq/);
  assert.match(supabase,/permissionMigrations\?\.kauaAddItems20260915/);
  assert.match(supabase,/dados:\{\.\.\.current\?\.dados,users:normalized/);
  assert.match(admin,/addOrderItems:'Adicionar peças e serviços com valores'/);
  assert.match(admin,/Sem agenda individual/);
  assert.doesNotMatch(admin,/if\(email!==FINANCE_EMAIL&&!agenda\)/);
  assert.match(access,/tr:not\(\[data-new\]\)/);
  assert.match(budget,/row\('part',item,0,true\)/);
  assert.match(budget,/row\('service',\{\},0,true\)/);
});
