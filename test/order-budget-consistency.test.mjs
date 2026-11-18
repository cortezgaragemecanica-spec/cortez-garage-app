import test from'node:test';
import assert from'node:assert/strict';
import{repairBudgetAgainstOrderTotals,sameSavedBudget}from'../src/order-budget-consistency.js';

test('recupera a diferença de peças quando o total foi salvo sem o detalhamento',()=>{
  const repaired=repairBudgetAgainstOrderTotals({parts:[{description:'Junta homocinética',quantity:1,value:306.25}],services:[{description:'Mão de obra',value:320}]},{valor_pecas:500.19,mao_obra:320,desconto:0});
  assert.equal(repaired.parts.length,2);
  assert.equal(repaired.parts[1].value,193.94);
  assert.equal(repaired.partsTotal,500.19);
  assert.equal(repaired.total,820.19);
});

test('não cria diferença quando o detalhamento já confere',()=>{
  const source={parts:[{description:'Peça',quantity:2,value:50}],services:[{description:'Serviço',value:80}]};
  const repaired=repairBudgetAgainstOrderTotals(source,{valor_pecas:100,mao_obra:80,desconto:10});
  assert.equal(repaired.parts.length,1);
  assert.equal(repaired.services.length,1);
  assert.equal(repaired.total,170);
});

test('compara o orçamento salvo sem depender da ordem das chaves',()=>{
  assert.equal(sameSavedBudget({parts:[{description:'Peça',value:10}],total:10},{total:10,parts:[{value:10,description:'Peça'}]}),true);
  assert.equal(sameSavedBudget({parts:[{description:'Peça',value:10}]},{parts:[{description:'Peça',value:11}]}),false);
});

test('totais agregados antigos não acrescentam itens quando o detalhamento salvo está consistente',()=>{
 const source={parts:[{description:'Lâmpada H7',quantity:2,value:25}],partsTotal:50,services:[{description:'Troca das lâmpadas',value:30}],servicesTotal:30};
 const result=repairBudgetAgainstOrderTotals(source,{valor_pecas:100,mao_obra:60,desconto:0});
 assert.equal(result.parts.length,1);
 assert.equal(result.services.length,1);
 assert.equal(result.parts[0].description,'Lâmpada H7');
 assert.equal(result.services[0].description,'Troca das lâmpadas');
 assert.equal(result.total,80);
 assert.deepEqual(result.aggregateMismatch,{parts:true,services:true});
});

test('itens recusados não voltam ao orçamento como diferenças recuperadas',()=>{
 const source={parts:[{description:'Peça aprovada',quantity:1,value:40},{description:'Peça recusada',quantity:1,value:60,refused:true}],partsTotal:100,services:[{description:'Serviço recusado',value:30,refused:true}],servicesTotal:30};
 const result=repairBudgetAgainstOrderTotals(source,{valor_pecas:100,mao_obra:30,desconto:0});
 assert.equal(result.parts.length,2);
 assert.equal(result.services.length,1);
 assert.equal(result.total,40);
 assert.equal(result.parts[1].refused,true);
});

test('valores antigos sem itens preservam o montante e usam a descrição original disponível',()=>{
 const result=repairBudgetAgainstOrderTotals({parts:[],services:[],partsTotal:0,servicesTotal:0},{valor_pecas:200,mao_obra:100,dados_extras:{parts:'Bomba de combustível',services:'Substituição da bomba'}});
 assert.equal(result.parts[0].description,'Bomba de combustível');
 assert.equal(result.services[0].description,'Substituição da bomba');
 assert.equal(result.total,300);
 assert.equal(result.undetailedParts,0);
});

test('linhas genéricas já salvas mantêm o valor e indicam o detalhamento pendente',()=>{
 const source={parts:[{description:'Peças e materiais — diferença recuperada',quantity:1,value:50,cost:50,recovered:true}],services:[{description:'Mão de obra — diferença recuperada',mechanic:'Fabio',value:40,recovered:true}]};
 const first=repairBudgetAgainstOrderTotals(source,{valor_pecas:50,mao_obra:40}),second=repairBudgetAgainstOrderTotals(first,{valor_pecas:50,mao_obra:40});
 assert.equal(first.parts[0].description,'Peças e materiais — detalhamento pendente');
 assert.equal(first.services[0].description,'Mão de obra — detalhamento pendente');
 assert.equal(first.total,90);
 assert.equal(second.parts.length,1);
 assert.equal(second.services.length,1);
 assert.equal(second.total,90);
 assert.equal(source.parts[0].description,'Peças e materiais — diferença recuperada');
});
