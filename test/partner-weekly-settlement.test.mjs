import test from'node:test';
import assert from'node:assert/strict';
import{weeklySettlementRows,settlementTotals}from'../src/partner-weekly-settlement.js';

const order={id:'os-1',number:'150',total:1000,vehicle:{plate:'ABC1D23'},budget:{parts:[{description:'Peça A',cost:100,value:200,quantity:2}],services:[{description:'Mão de obra',value:400,commissionRate:.5}]}};
const event={order,week:{start:'2026-10-19',end:'2026-10-24'},grossOrderValue:1000,orderValue:1000,partsCost:200,laborCommission:200,cardFee:0};

test('acerto semanal lista O.S. recebida com peças, serviço líquido e comissão dos sócios',()=>{
  const[row]=weeklySettlementRows([event],'2026-10-19');
  assert.equal(row.parts[0].cost,200);
  assert.deepEqual(row.services[0],{description:'Mão de obra',value:400,commission:200,net:200});
  assert.equal(row.totalCost,400);
  assert.equal(row.grossProfit,600);
  assert.equal(row.base,600);
  assert.equal(row.commissionablePartsProfit,200);
  assert.equal(row.otherBase,400);
  assert.deepEqual(row.partsRates,{Fabiano:25,Marcelino:20});
  assert.equal(row.commissions.Fabiano,150);
  assert.equal(row.commissions.Marcelino,120);
});

test('percentuais do lucro das peças podem ser definidos separadamente para cada sócio',()=>{
  const drafts=new Map([['os-1',{rates:{Fabiano:10,Marcelino:20},partsRates:{Fabiano:50,Marcelino:30}}]]),[row]=weeklySettlementRows([event],'2026-10-19',drafts);
  assert.equal(row.commissionablePartsProfit,200);
  assert.equal(row.otherBase,400);
  assert.deepEqual(row.commissionDetails.Fabiano,{other:40,parts:100,total:140});
  assert.deepEqual(row.commissionDetails.Marcelino,{other:80,parts:60,total:140});
  assert.equal(row.commissions.Fabiano,140);
  assert.equal(row.commissions.Marcelino,140);
});

test('percentuais globais dos sócios substituem os campos individuais de todas as O.S.',()=>{
  const drafts=new Map([['os-1',{rates:{Fabiano:1,Marcelino:1},partsRates:{Fabiano:1,Marcelino:1}}]]),[row]=weeklySettlementRows([event],'2026-10-19',drafts,{rates:{Fabiano:30,Marcelino:10},partsRates:{Fabiano:40,Marcelino:20}});
  assert.deepEqual(row.rates,{Fabiano:30,Marcelino:10});
  assert.deepEqual(row.partsRates,{Fabiano:40,Marcelino:20});
  assert.deepEqual(row.commissionDetails.Fabiano,{other:120,parts:80,total:200});
  assert.deepEqual(row.commissionDetails.Marcelino,{other:40,parts:40,total:80});
});

test('margem de reserva global reduz o lucro das peças antes das comissões',()=>{
  const[row]=weeklySettlementRows([event],'2026-10-19',new Map(),{reserveRate:25});
  assert.equal(row.partsProfitBeforeReserve,200);
  assert.equal(row.reserveRate,25);
  assert.equal(row.reserveAmount,50);
  assert.equal(row.commissionablePartsProfit,150);
  assert.equal(row.baseBeforeReserve,600);
  assert.equal(row.base,550);
  assert.equal(row.otherBase,400);
  assert.equal(row.commissions.Fabiano,137.5);
  assert.equal(row.commissions.Marcelino,110);
});

test('custo de peça e percentuais podem ser alterados antes do lançamento',()=>{
  const drafts=new Map([['os-1',{partCosts:{'Peça A':250},rates:{Fabiano:30,Marcelino:10}}]]),[row]=weeklySettlementRows([event],'2026-10-19',drafts);
  assert.equal(row.partsCost,250);
  assert.equal(row.totalCost,450);
  assert.equal(row.grossProfit,550);
  assert.equal(row.base,550);
  assert.equal(row.commissions.Fabiano,165);
  assert.equal(row.commissions.Marcelino,55);
  assert.deepEqual(settlementTotals([row]),{received:1000,parts:250,services:200,cost:450,gross:550,partsProfit:150,reserve:0,base:550,Fabiano:165,Marcelino:55});
});

test('integração reserva o lucro de peças e retífica fora das comissões dos sócios',()=>{
  const integratedOrder={...order,deliveredAt:'2026-10-20T12:00:00Z',budget:{...order.budget,parts:[{description:'Peça A',cost:100,value:200,quantity:2},{description:'Plaina cabeçote',cost:50,value:100,quantity:1}]}},integratedEvent={...event,order:integratedOrder,partsCost:250};
  const[row]=weeklySettlementRows([integratedEvent],'2026-10-19',new Map(),{commissionIntegration:true,recoveryStartDate:'2026-10-01'});
  assert.equal(row.grossProfit,550);
  assert.deepEqual(row.recovery,{parts:200,retifica:50,total:250});
  assert.equal(row.base,300);
  assert.equal(row.commissionablePartsProfit,0);
  assert.equal(row.otherBase,300);
  assert.equal(row.commissions.Fabiano,75);
  assert.equal(row.commissions.Marcelino,60);
});
