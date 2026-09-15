import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{isLuizinhoPaymentDescription,previousLuizinhoWeek,luizinhoPaymentReference,luizinhoPaymentWeek,luizinhoPaymentIsApplied}from'../src/luizinho-payment.js';

const id='b6d20a7b-0389-46b1-a129-5e57e9fced54';

test('pagamento Luizinho identificado só abate acerto com confirmação',()=>{
  assert.equal(isLuizinhoPaymentDescription('Pago boleto Luizinho'),true);
  assert.equal(previousLuizinhoWeek('2026-09-15'),'2026-09-07');
  const accepted=luizinhoPaymentReference('', '2026-09-15',true,id);
  const declined=luizinhoPaymentReference('', '2026-09-15',false,id);
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:accepted}),'2026-09-07');
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:declined}),'');
  assert.equal(luizinhoPaymentIsApplied({description:'Pago Luizinho',dueDate:'2026-09-15',reference:declined}),false);
});

test('dívida antiga fica fora do acerto mesmo sendo paga pela aba Contas a pagar',()=>{
  const oldPayable=luizinhoPaymentReference(`pagamento-conta-${id}-abc`,'2026-09-15',false,id);
  assert.match(oldPayable,new RegExp(`^pagamento-conta-${id}-fora-acerto-luizinho-`));
  assert.equal(luizinhoPaymentWeek({descricao:'Pagamento Luizinho antigo',vencimento:'2026-09-15',referencia:oldPayable}),'');
});

test('acerto em atraso continua vinculado à semana das notas, não à data do pagamento',()=>{
  const reference=luizinhoPaymentReference(`pagamento-conta-${id}-abc`,'2026-09-22',true,id,'2026-09-07');
  assert.equal(luizinhoPaymentWeek({descricao:'Pagamento Acerto Luizinho',vencimento:'2026-09-22',referencia:reference}),'2026-09-07');
  const edited=luizinhoPaymentReference(reference,'2026-09-29',true,id);
  assert.equal(luizinhoPaymentWeek({descricao:'Pagamento Acerto Luizinho',vencimento:'2026-09-29',referencia:edited}),'2026-09-07');
});

test('pagamentos antigos sem marcador mantêm a baixa até serem corrigidos no caixa',()=>{
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:''}),'2026-09-07');
  const corrected=luizinhoPaymentReference('', '2026-09-15',false,id);
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:corrected}),'');
});

test('caixa pergunta antes de salvar e painel de acertos respeita a resposta',async()=>{
  const[admin,supabase]=await Promise.all(['src/admin.js','src/supabase.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/confirmLuizinhoSettlement\(description\.value,amount\)/);
  assert.match(admin,/confirmLuizinhoSettlement\(description\.value,amount,true\)/);
  assert.match(admin,/confirmLuizinhoSettlement\(description,amount\)/);
  assert.match(admin,/if\(luizinhoSettlement===null\)return/);
  assert.match(admin,/luizinhoLedger\(\).*luizinhoPaymentWeek/s);
  assert.match(supabase,/typeof record\.luizinhoSettlement!=='boolean'/);
  assert.match(supabase,/!luizinho\?await matchingPayable/);
  assert.match(supabase,/select=descricao,valor,vencimento,referencia/);
});
