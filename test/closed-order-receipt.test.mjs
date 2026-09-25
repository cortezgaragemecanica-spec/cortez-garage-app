import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {closedOrderReceiptData} from '../src/closed-order-receipt-data.js';

test('recibo quitado mostra o total efetivamente pago',()=>{
  const data=closedOrderReceiptData({total:1200,advance:200,payment:'Pix BB',closingReceipt:{receivedNow:1000,creditAmount:0,paymentType:'Pix BB',closedAt:'2026-09-16T12:00:00Z'}});
  assert.equal(data.paidTotal,1200);
  assert.equal(data.receivedNow,1000);
  assert.equal(data.creditAmount,0);
});

test('recibo de fechamento a prazo não declara quitação integral',()=>{
  const data=closedOrderReceiptData({total:1200,advance:200,payment:'Pagamento a prazo',closingReceipt:{receivedNow:400,creditAmount:600,creditDue:'2026-10-16',paymentType:'Pix BB'}});
  assert.equal(data.paidTotal,600);
  assert.equal(data.creditAmount,600);
  assert.equal(data.creditDue,'2026-10-16');
});

test('registro antigo a prazo sem detalhamento não inventa valor pago',()=>{
  const data=closedOrderReceiptData({total:1200,payment:'Pagamento a prazo'});
  assert.equal(data.paidTotal,null);
  assert.equal(data.receivedNow,null);
  assert.equal(data.unknownCredit,true);
});

test('botão de recibo aparece depois do fechamento e persiste os dados',async()=>{
  const [receipt,workflow,supabase,index,worker]=await Promise.all([
    readFile(new URL('../src/closed-order-receipt.js',import.meta.url),'utf8'),
    readFile(new URL('../src/order-workflow.js',import.meta.url),'utf8'),
    readFile(new URL('../src/supabase.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8')
  ]);
  assert.match(receipt,/order\.status!==['"]Entregue['"]/);
  assert.match(receipt,/id='closedOrderReceipt'|button\.id='closedOrderReceipt'/);
  assert.match(receipt,/Salvar \/ compartilhar recibo/);
  assert.match(receipt,/%PDF-1\.4/);
  assert.match(workflow,/cortez:order-delivered/);
  assert.match(supabase,/closingReceipt/);
  assert.match(supabase,/dados_extras:\{\.\.\.\(orderRow\.dados_extras\|\|\{\}\),closingReceipt,warranty,warrantyPayCommissions/);
  assert.match(index,/closed-order-receipt\.js\?v=20260916-1/);
  assert.match(worker,/closed-order-receipt\.js\?v=20260916-1/);
});
