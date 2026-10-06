import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('fase 3 organiza a barra da O.S. sem remover as acoes principais',async()=>{
  const[layout,index,worker]=await Promise.all([read('src/order-layout.js'),read('index.html'),read('public/sw.js')]);
  assert.match(layout,/onUiUpdated\(decorateOrder\)/);
  assert.match(layout,/orderMoreActions/);
  for(const id of ['editOsIdentity','advanceOs','releaseOrderCommissions','toggleOrderChecklist','requestParts','savedEntryReceipt','requestServiceQuote','openTechnicalReport','deleteOs'])assert.match(layout,new RegExp(id));
  assert.match(layout,/print:'Gerar PDF da ordem de serviço'/);
  assert.match(layout,/openClosing:'Abrir fechamento/);
  assert.match(index,/order-layout\.js\?v=20261006-1/);
  assert.match(worker,/order-layout\.js\?v=20261006-1/);
});

test('fase 3 melhora toque, foco e leitura no celular',async()=>{
  const[layout,style,index,worker]=await Promise.all([read('src/order-layout.js'),read('src/style.css'),read('index.html'),read('public/sw.js')]);
  assert.match(layout,/Status da ordem de serviço/);
  assert.match(layout,/Assinatura do cliente/);
  assert.match(style,/\.order-command-bar\{position:sticky/);
  assert.match(style,/\.order-more-actions-menu/);
  assert.match(style,/min-height:44px/);
  assert.match(style,/summary:focus-visible/);
  assert.match(index,/style\.css\?v=20261006-3&amp;w=12/);
  assert.match(worker,/cortez-garage-v251-luizinho-check/);
});
