import test from'node:test';
import assert from'node:assert/strict';
import{allocatePartnerCommission,isFullPartnerCommissionPayment,revalueOpenPartnerCommission}from'../src/partner-commission-ledger.js';

test('carrega comissão antiga não paga para o saldo em aberto',()=>{
  const ledger=allocatePartnerCommission([
    {date:'2026-09-05',commission:100,week:'anterior'},
    {date:'2026-09-12',commission:200,week:'atual'}
  ],[]);
  assert.equal(ledger.outstandingTotal,300);
  assert.deepEqual(ledger.open.map(item=>item.week),['anterior','atual']);
});

test('pagamento parcial arquiva o pago e mantém o restante acumulado',()=>{
  const payment={dueDate:'2026-09-18',amount:80,description:'Comissões Fabiano pago'};
  const ledger=allocatePartnerCommission([
    {date:'2026-09-05',commission:100,week:'anterior'},
    {date:'2026-09-12',commission:200,week:'atual'}
  ],[payment]);
  assert.equal(ledger.paidTotal,80);
  assert.equal(ledger.payments[0].amount,80);
  assert.equal(ledger.open[0].remaining,20);
  assert.equal(ledger.outstandingTotal,220);
});

test('mudança de percentual recalcula o aberto sem alterar pagamento arquivado',()=>{
  const payment={dueDate:'2026-09-18',amount:80,description:'Comissões Marcelino'};
  const before=allocatePartnerCommission([{date:'2026-09-12',real:800,commission:200}],[payment]);
  const after=revalueOpenPartnerCommission(before,.15);
  assert.equal(before.paidTotal,80);
  assert.equal(after.paidTotal,80);
  assert.equal(before.outstandingTotal,120);
  assert.equal(after.outstandingTotal,40);
  assert.equal(after.payments[0].amount,80);
});

test('mudança de percentual não reabre comissão que já foi totalmente paga',()=>{
  const paid=allocatePartnerCommission([{date:'2026-09-05',real:400,commission:100}],[{dueDate:'2026-09-12',amount:100}]);
  const after=revalueOpenPartnerCommission(paid,.5);
  assert.equal(after.outstandingTotal,0);
  assert.equal(after.paidTotal,100);
});

test('mudança de percentual preserva saldo inicial confirmado sem O.S. de origem',()=>{
  const before=allocatePartnerCommission([{date:'2026-09-18',commission:298,real:0,opening:true}],[]);
  const after=revalueOpenPartnerCommission(before,.1);
  assert.equal(after.outstandingTotal,298);
});

test('pagamento integral após a alteração não deixa resíduo entre lançamentos',()=>{
  const events=[
    {date:'2026-09-24',real:400,commission:100},
    {date:'2026-09-25',real:400,commission:100}
  ];
  const payment={dueDate:'2026-09-26',amount:160};
  const allocated=allocatePartnerCommission(events,[payment]);
  const after=revalueOpenPartnerCommission(allocated,.2,'2026-09-26');
  assert.equal(after.paidTotal,160);
  assert.equal(after.outstandingTotal,0);
  assert.equal(after.unappliedCredit,0);
});

test('quitação integral impede que lançamento anterior sincronizado depois reabra o saldo',()=>{
  const events=[
    {date:'2026-09-24',real:400,commission:88,record:{id:'antigo'}},
    {date:'2026-09-25',real:1688.14,commission:371.39,record:{id:'sincronizado-depois'}}
  ];
  const payment={dueDate:'2026-09-26',amount:88,description:'pago comissões fabiano'};
  const result=allocatePartnerCommission(events,[payment]);
  assert.equal(result.paidTotal,88);
  assert.equal(result.settlementAdjustment,371.39);
  assert.equal(result.outstandingTotal,0);
  assert.equal(result.open.length,0);
});

test('pagamento parcial não fecha lançamentos além do valor pago',()=>{
  const result=allocatePartnerCommission([
    {date:'2026-09-24',commission:100},
    {date:'2026-09-25',commission:80}
  ],[{dueDate:'2026-09-26',amount:100,description:'pagamento parcial comissão Fabiano'}]);
  assert.equal(result.outstandingTotal,80);
  assert.equal(result.settlementAdjustment,0);
});

test('identifica somente descrições de quitação integral de comissão',()=>{
  assert.equal(isFullPartnerCommissionPayment({description:'pago comissões fabiano'}),true);
  assert.equal(isFullPartnerCommissionPayment({description:'Comissão Marcelino quitada'}),true);
  assert.equal(isFullPartnerCommissionPayment({description:'pagamento parcial comissão Fabiano'}),false);
});

test('arredonda geração e abatimento por lançamento em centavos',()=>{
  const result=allocatePartnerCommission([
    {date:'2026-09-24',commission:10.005},
    {date:'2026-09-25',commission:19.995}
  ],[{dueDate:'2026-09-26',amount:30,description:'pagamento parcial comissão Fabiano'}]);
  assert.equal(result.generatedTotal,30.01);
  assert.equal(result.outstandingTotal,.01);
});


