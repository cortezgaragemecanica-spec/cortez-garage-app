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
