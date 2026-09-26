import test from 'node:test';
import assert from 'node:assert/strict';
import {activePartnerConferences,deliveredPartnerEvents,excludedPartnerCommissions,partnerCommissionReceiptDate,reconciledPartnerLedger} from '../src/partner-reconciliation.js';
const event=(id,date,commission)=>({record:{id},order:{number:id},date,commission,real:commission*4});
const payout=(id,dueDate,amount)=>({id,dueDate,amount});
test('saldos confirmados substituem o passado sem descontar fechamento anterior novamente',()=>{
  const events=[event('antiga','2026-09-18',9999),event('nova','2026-09-24',100)];
  const fabiano=reconciledPartnerLedger(events,[payout('f','2026-09-20',1890.68)],'Fabiano');
  const marcelino=reconciledPartnerLedger(events,[payout('m','2026-09-19',1090.02)],'Marcelino');
  assert.equal(fabiano.outstandingTotal,100);assert.equal(marcelino.outstandingTotal,398);
  assert.equal(fabiano.paidTotal,0);assert.equal(fabiano.issues.length,0);
});
test('novo pagamento reduz saldo e não é confundido com pagamento do fechamento',()=>{
  const result=reconciledPartnerLedger([event('nova','2026-09-24',100)],[payout('m','2026-09-19',1090.02),payout('novo','2026-09-25',200)],'Marcelino');
  assert.equal(result.outstandingTotal,198);assert.equal(result.paidTotal,200);
});
test('recebimento desta semana pertence à semana mesmo com O.S. antiga',()=>{
  const row=event('antiga','2026-09-24',100);row.order.created='2026-08-01';
  const result=reconciledPartnerLedger([row],[payout('f','2026-09-20',1890.68)],'Fabiano');
  assert.equal(result.events[0].date,'2026-09-24');assert.equal(result.outstandingTotal,100);
});
test('valor conferido fica preservado quando a origem muda ou desaparece',()=>{
  const saved=event('os1','2026-09-24',100),changed=event('os1','2026-09-24',180);
  for(const events of [[changed],[]]){const result=reconciledPartnerLedger(events,[payout('f','2026-09-20',1890.68)],'Fabiano',[saved]);assert.equal(result.outstandingTotal,100);assert.equal(result.issues.length,1)}
});
test('recebimento repetido não gera comissão duas vezes',()=>{
  const row=event('os1','2026-09-24',100),result=reconciledPartnerLedger([row,row],[payout('f','2026-09-20',1890.68)],'Fabiano');
  assert.equal(result.outstandingTotal,100);assert.equal(result.issues.length,1);
});
test('cancelamento reabre a conferência sem apagar o histórico',()=>{
  const saved={partner:'Fabiano',event:event('os1','2026-09-24',100),confirmedAt:'2026-09-25T10:00:00Z'};
  const canceled={partner:'Fabiano',eventKey:'os1',canceledAt:'2026-09-25T11:00:00Z'};
  assert.equal(activePartnerConferences([saved],'Fabiano').length,1);
  assert.equal(activePartnerConferences([saved,canceled],'Fabiano').length,0);
  const reconfirmed={...saved,confirmedAt:'2026-09-25T12:00:00Z'};
  assert.equal(activePartnerConferences([saved,canceled,reconfirmed],'Fabiano').length,1);
});
test('exclusão individual pode ser restaurada e mantém o histórico',()=>{
  const saved=event('os2','2026-09-24',80),excluded={partner:'Marcelino',eventKey:'os2',event:saved,excludedAt:'2026-09-25T13:00:00Z'};
  const restored={partner:'Marcelino',eventKey:'os2',event:saved,restoredAt:'2026-09-25T14:00:00Z'};
  assert.deepEqual(excludedPartnerCommissions([excluded],'Marcelino').map(item=>item.eventKey),['os2']);
  assert.equal(excludedPartnerCommissions([excluded,restored],'Marcelino').length,0);
});
test('comissão de sócio considera somente O.S. entregue, inclusive em valores protegidos',()=>{
  const events=[event('entregue','2026-09-25',100),event('aberta','2026-09-25',80)];
  events[0].order.id='os-entregue';events[1].order.id='os-aberta';
  const orders=[{id:'os-entregue',number:'entregue',status:'Entregue'},{id:'os-aberta',number:'aberta',status:'Em andamento'}];
  assert.deepEqual(deliveredPartnerEvents(events,orders).map(item=>item.record.id),['entregue']);
});
test('adiantamento ainda não comissionado entra na data da entrega',()=>{
  const advance={...event('adiantamento','2026-09-15',100),advance:true,deliveryDate:'2026-09-24'};
  assert.equal(partnerCommissionReceiptDate(advance),'2026-09-24');
  assert.equal(partnerCommissionReceiptDate(advance,new Set(['adiantamento'])),'2026-09-15');
});
test('parcela recebida depois da entrega permanece na semana do recebimento',()=>{
  const credit={...event('credito','2026-09-25',100),advance:false,deliveryDate:'2026-09-24'};
  assert.equal(partnerCommissionReceiptDate(credit),'2026-09-25');
});


