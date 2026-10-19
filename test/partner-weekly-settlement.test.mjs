import test from'node:test';
import assert from'node:assert/strict';
import{weeklySettlementRows,settlementTotals}from'../src/partner-weekly-settlement.js';

const order={id:'os-1',number:'150',total:1000,vehicle:{plate:'ABC1D23'},budget:{parts:[{description:'Peça A',cost:100,quantity:2}],services:[{description:'Mão de obra',value:400,commissionRate:.5}]}};
const event={order,week:{start:'2026-10-19',end:'2026-10-24'},grossOrderValue:1000,orderValue:1000,partsCost:200,laborCommission:200,cardFee:0};

test('acerto semanal lista O.S. recebida com peças, serviço líquido e comissão dos sócios',()=>{
  const[row]=weeklySettlementRows([event],'2026-10-19');
  assert.equal(row.parts[0].cost,200);
  assert.deepEqual(row.services[0],{description:'Mão de obra',value:400,commission:200,net:200});
  assert.equal(row.totalCost,400);
  assert.equal(row.grossProfit,600);
  assert.equal(row.base,600);
  assert.equal(row.commissions.Fabiano,150);
  assert.equal(row.commissions.Marcelino,120);
});

test('custo de peça e percentuais podem ser alterados antes do lançamento',()=>{
  const drafts=new Map([['os-1',{partCosts:{'Peça A':250},rates:{Fabiano:30,Marcelino:10}}]]),[row]=weeklySettlementRows([event],'2026-10-19',drafts);
  assert.equal(row.partsCost,250);
  assert.equal(row.totalCost,450);
  assert.equal(row.grossProfit,550);
  assert.equal(row.base,550);
  assert.equal(row.commissions.Fabiano,165);
  assert.equal(row.commissions.Marcelino,55);
  assert.deepEqual(settlementTotals([row]),{received:1000,parts:250,services:200,cost:450,base:550,Fabiano:165,Marcelino:55});
});
