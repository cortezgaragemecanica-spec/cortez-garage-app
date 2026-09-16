import test from 'node:test';
import assert from 'node:assert/strict';
import {isExecutionPdf,servicePdfSection,budgetObservation} from '../src/pdf-order-sections.js';

const formatMoney=value=>`R$ ${Number(value||0).toFixed(2)}`;
const order={status:'Aguardando aprovação',mechanic:'Gustavo',services:'Troca de óleo',budget:{services:[{description:'Troca de óleo',mechanic:'Fabio',value:150}]}};

test('orçamento e aguardando aprovação mostram apenas serviços orçados sem mecânico',()=>{
  for(const status of ['Orçamento','Orçamento fora do pátio','Aguardando aprovação']){
    const section=servicePdfSection({...order,status},formatMoney);
    assert.equal(isExecutionPdf({...order,status}),false);
    assert.equal(section.title,'Serviços orçados');
    assert.deepEqual(section.headers,['Serviço','Valor']);
    assert.deepEqual(section.rows,[['Troca de óleo','R$ 150.00']]);
  }
  assert.equal(budgetObservation(order),'');
});

test('serviço aprovado ou executado mostra peças e serviços executados com mecânico',()=>{
  for(const status of ['Em andamento','Aguardando peça','Aguardando peças','Pronto para entrega','Entregue']){
    const section=servicePdfSection({...order,status},formatMoney);
    assert.equal(isExecutionPdf({...order,status}),true);
    assert.equal(section.title,'Serviços executados');
    assert.deepEqual(section.headers,['Serviço','Mecânico','Valor']);
    assert.deepEqual(section.rows,[['Troca de óleo','Fabio','R$ 150.00']]);
  }
});

test('observação independente não é apagada no orçamento',()=>{
  assert.equal(budgetObservation({...order,services:'Cliente pede contato antes da troca'}),'Cliente pede contato antes da troca');
});
