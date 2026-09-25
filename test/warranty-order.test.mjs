import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{summarizeMonthlyClosing}from'../src/monthly-closing.js';
import{closedOrderReceiptData}from'../src/closed-order-receipt-data.js';

const deliveredOrder=overrides=>({
  id:'warranty-1',number:'0100',status:'Entregue',deliveredAt:'2026-09-25T12:00:00.000Z',created:'2026-09-20T12:00:00.000Z',
  warranty:true,warrantyPayCommissions:false,total:500,labor:300,partsValue:200,mechanic:'Tony',
  client:{id:'client-1',name:'Cliente'},
  budget:{services:[{description:'Troca',mechanic:'Tony',value:300,commissionRate:.5}],parts:[{description:'Peça',supplier:'Fornecedor X',cost:100,quantity:1,value:200}]},
  ...overrides
});

test('fechamento mensal trata garantia como custo sem faturamento',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',orders:[deliveredOrder()],partnerNames:[]});
  assert.equal(result.deliveredCount,1);
  assert.equal(result.billed,0);
  assert.equal(result.ticketAverage,0);
  assert.equal(result.totalProfit,-100);
  assert.equal(result.partsProfit,-100);
  assert.equal(result.laborProfit,0);
  assert.equal(result.mechanics[0].billing,0);
  assert.equal(result.mechanics[0].commission,0);
  assert.deepEqual(result.purchases,[{name:'Fornecedor X',amount:100,credits:0}]);
});

test('garantia pode gerar comissão quando o proprietário escolher',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',orders:[deliveredOrder({warrantyPayCommissions:true})],partnerNames:[]});
  assert.equal(result.billed,0);
  assert.equal(result.totalProfit,-250);
  assert.equal(result.partsProfit,-100);
  assert.equal(result.laborProfit,-150);
  assert.equal(result.mechanics[0].commission,150);
});

test('recibo de garantia preserva o custo da O.S. e zera a cobrança',()=>{
  const data=closedOrderReceiptData(deliveredOrder({closingReceipt:{warranty:true,total:500,receivedNow:0}}));
  assert.equal(data.total,500);
  assert.equal(data.receivedNow,0);
  assert.equal(data.paidTotal,0);
  assert.equal(data.creditAmount,0);
  assert.equal(data.paymentCondition,'Garantia · sem cobrança');
});

test('fluxo e persistência incluem as regras da O.S. de garantia',()=>{
  const workflow=fs.readFileSync(new URL('../src/order-workflow.js',import.meta.url),'utf8');
  const supabase=fs.readFileSync(new URL('../src/supabase.js',import.meta.url),'utf8');
  const receipt=fs.readFileSync(new URL('../src/closed-order-receipt-data.js',import.meta.url),'utf8');
  assert.match(workflow,/O\.S\. de garantia/);
  assert.match(workflow,/warrantyPayCommissions/);
  assert.match(workflow,/sem valor a receber/);
  assert.match(supabase,/order\?\.warranty\?0/);
  assert.match(supabase,/garantia sem cobrança/);
  assert.match(supabase,/pendingIds/);
  assert.match(receipt,/warranty\?'Garantia · sem cobrança'/);
});
