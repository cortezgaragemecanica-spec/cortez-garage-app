import test from'node:test';
import assert from'node:assert/strict';
import{allocatePartnerCommission}from'../src/partner-commission-ledger.js';

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
  const before=allocatePartnerCommission([{date:'2026-09-12',commission:200}],[payment]);
  const after=allocatePartnerCommission([{date:'2026-09-12',commission:150}],[payment]);
  assert.equal(before.paidTotal,80);
  assert.equal(after.paidTotal,80);
  assert.equal(before.outstandingTotal,120);
  assert.equal(after.outstandingTotal,70);
});
