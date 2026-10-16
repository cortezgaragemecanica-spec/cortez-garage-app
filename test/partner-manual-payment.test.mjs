import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{allocatePartnerCommission}from'../src/partner-commission-ledger.js';

test('baixa manual abate primeiro as comissões mais antigas sem alterar a origem',()=>{
  const events=[
    {date:'2026-10-01',commission:100,record:{id:'primeira'}},
    {date:'2026-10-08',commission:80,record:{id:'segunda'}},
    {date:'2026-10-10',commission:90,record:{id:'terceira'}}
  ];
  const payment={
    dueDate:'2026-10-15',
    amount:230,
    description:'Baixa manual comissão Fabiano',
    reference:'partner-commission-manual-v1-fabiano-teste'
  };
  const result=allocatePartnerCommission(events,[payment]);
  assert.equal(result.paidTotal,230);
  assert.equal(result.outstandingTotal,40);
  assert.equal(result.events[0].remaining,0);
  assert.equal(result.events[1].remaining,0);
  assert.equal(result.events[2].remaining,40);
  assert.equal(result.events.filter(item=>item.paid>0&&item.remaining>0).length,1);
  assert.equal(events[0].commission,100);
  assert.equal(events[1].commission,80);
  assert.equal(events[2].commission,90);
});

test('API de baixa manual é exclusiva do proprietário, idempotente e registra saída realizada',async()=>{
  const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(source,/export async function savePartnerCommissionManualPayment/);
  assert.match(source,/currentEmail\(\)!==OWNER_EMAIL/);
  assert.match(source,/partner-commission-manual-v1-/);
  assert.match(source,/referencia=eq\.\$\{encodeURIComponent\(paymentReference\)\}/);
  assert.match(source,/categoria:'Fluxo de caixa',movimento:'Saída'/);
  assert.match(source,/status:'Realizado'/);
  assert.match(source,/forma_pagamento:account/);
  assert.match(source,/registerCash=true/);
  assert.match(source,/Sem movimentação de caixa/);
});

test('interface oferece baixa manual com valor, data, caixa e validação do saldo',async()=>{
  const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
  assert.match(source,/Dar baixa manual/);
  assert.match(source,/id="partnerManualAmount"/);
  assert.match(source,/id="partnerManualDate"/);
  assert.match(source,/id="partnerManualAccount"/);
  assert.match(source,/id="partnerManualRegisterCash"/);
  assert.match(source,/accountField\.hidden=!registerCash\.checked/);
  assert.match(source,/return'Sem movimentação de caixa'/);
  assert.match(source,/amount>currentBalance\+\.009/);
  assert.match(source,/savePartnerCommissionManualPayment\(\{partner,amount/);
});
