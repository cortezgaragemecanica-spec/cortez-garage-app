import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{allocateLuizinhoPayments,isLuizinhoPaymentDescription,previousLuizinhoWeek,luizinhoPaymentReference,luizinhoPaymentWeek,luizinhoPaymentIsApplied}from'../src/luizinho-payment.js';

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

test('Acerto Luizinho em qualquer valor é vinculado à semana anterior',()=>{
  for(const description of ['Acerto Luizinho','acerto do luizinho','ACERTO LUIZINHO parcial','Acerto Luiznho']){
    assert.equal(isLuizinhoPaymentDescription(description),true);
    const reference=luizinhoPaymentReference('', '2026-09-22',true,crypto.randomUUID());
    assert.equal(luizinhoPaymentWeek({descricao:description,valor:.01,vencimento:'2026-09-22',referencia:reference}),'2026-09-14');
    assert.equal(luizinhoPaymentWeek({descricao:description,valor:9999,vencimento:'2026-09-22',referencia:reference}),'2026-09-14');
  }
});

test('Acerto Luizinho baixa automaticamente e recalcula conta a pagar e acerto',async()=>{
  const[admin,supabase]=await Promise.all(['src/admin.js','src/supabase.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/if\(\/\\bacerto\\b\/\.test\(text\)&&\/\\bluizinho\\b\/\.test\(text\)\)return true/);
  assert.match(admin,/automaticCashExpense=.*isLuizinhoPaymentDescription\(text\)/);
  assert.match(supabase,/automaticCashExpense=.*isLuizinhoPaymentDescription\(text\)/);
  assert.match(supabase,/allocateLuizinhoPayments\(groups\.values\(\),cashRows\)/);
  assert.match(supabase,/balance=week\.balance/);
  assert.match(supabase,/valor:Number\(\(settled\?week\.total:balance\)\.toFixed\(2\)\)/);
});

test('pagamento do acerto fica vinculado à conta e contas antigas são reconciliadas',async()=>{
  const[admin,supabase]=await Promise.all(['src/admin.js','src/supabase.js'].map(file=>readFile(file,'utf8')));
  assert.match(supabase,/async function linkedLuizinhoPayable\(session,record\)/);
  assert.match(supabase,/referencia=like\.acerto-luizinho-/);
  assert.match(supabase,/rows\.find\(item=>item\.referencia===`acerto-luizinho-\$\{week\}`\)/);
  assert.match(supabase,/pagamento-conta-\$\{luizinhoPayable\.id\}/);
  assert.match(supabase,/export async function reconcileLuizinhoPayables\(\)/);
  assert.match(admin,/if\(financeOwner\(\)\)await reconcileLuizinhoPayables\(\)/);
  assert.match(admin,/luizinhoWeek\)\{const week=luizinhoLedger\(\)\.find/);
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
  const direct=luizinhoPaymentReference('', '2026-09-22',true,id,'2026-09-07');
  const editedDirect=luizinhoPaymentReference(direct,'2026-09-29',true,id);
  assert.equal(luizinhoPaymentWeek({descricao:'Acerto Luiznho',vencimento:'2026-09-29',referencia:editedDirect}),'2026-09-07');
});

test('pagamentos antigos sem marcador mantêm a baixa até serem corrigidos no caixa',()=>{
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:''}),'2026-09-07');
  const corrected=luizinhoPaymentReference('', '2026-09-15',false,id);
  assert.equal(luizinhoPaymentWeek({descricao:'Pago Luizinho',vencimento:'2026-09-15',referencia:corrected}),'');
});

test('pagamento identificado reduz a semana anterior mesmo quando o vínculo antigo aponta para uma semana inexistente',()=>{
  const weeks=[{start:'2026-09-07',total:500},{start:'2026-09-14',total:300}];
  const payment={descricao:'Acerto Luizinho',valor:200,vencimento:'2026-09-22',referencia:'pagamento-acerto-luizinho-2026-08-31-antigo'};
  const result=allocateLuizinhoPayments(weeks,[payment]).weeks;
  assert.deepEqual(result.map(week=>({start:week.start,paid:week.paid,balance:week.balance})),[
    {start:'2026-09-07',paid:200,balance:300},
    {start:'2026-09-14',paid:0,balance:300}
  ]);
});

test('pagamento parcial e excedente percorrem os acertos abertos sem duplicar o valor',()=>{
  const weeks=[{start:'2026-09-07',total:100},{start:'2026-09-14',total:150}];
  const payment={descricao:'Pagamento acerto Luizinho',valor:180,vencimento:'2026-09-22',referencia:''};
  const result=allocateLuizinhoPayments(weeks,[payment]);
  assert.equal(result.weeks.find(week=>week.start==='2026-09-14').paid,150);
  assert.equal(result.weeks.find(week=>week.start==='2026-09-07').paid,30);
  assert.equal(result.allocations.reduce((sum,item)=>sum+item.amount,0),180);
});

test('lançamento marcado como fora do acerto não altera nenhuma semana',()=>{
  const result=allocateLuizinhoPayments([{start:'2026-09-14',total:300}],[{descricao:'Acerto Luizinho',valor:100,vencimento:'2026-09-22',referencia:'pagamento-fora-acerto-luizinho-id'}]);
  assert.equal(result.weeks[0].paid,0);
  assert.equal(result.weeks[0].balance,300);
});

test('caixa pergunta antes de salvar e painel de acertos respeita a resposta',async()=>{
  const[admin,supabase]=await Promise.all(['src/admin.js','src/supabase.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/confirmLuizinhoSettlement\(description\.value,amount\)/);
  assert.match(admin,/confirmLuizinhoSettlement\(description\.value,amount,true\)/);
  assert.match(admin,/confirmLuizinhoSettlement\(description,amount\)/);
  assert.match(admin,/if\(luizinhoSettlement===null\)return/);
  assert.match(admin,/luizinhoLedger\(\).*allocateLuizinhoPayments/s);
  assert.match(supabase,/typeof record\.luizinhoSettlement!=='boolean'/);
  assert.match(supabase,/!luizinho\?await matchingPayable/);
  assert.match(supabase,/select=descricao,valor,vencimento,referencia/);
});

test('acerto Luizinho separa notas por semana e mostra os totais de cada período',async()=>{
  const[admin,style,index,worker]=await Promise.all(['src/admin.js','src/style.css','index.html','public/sw.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/function separateLuizinhoWeeks\(target\)/);
  assert.match(admin,/Semana: \$\{esc\(label\)\}/);
  assert.match(admin,/Total das notas: <strong>\$\{money\(week\.total\)\}/);
  assert.match(admin,/Pago: <strong>\$\{money\(week\.paid\)\}/);
  assert.match(admin,/week\.settled\?'Quitada':'Saldo'/);
  assert.match(admin,/if\(activeSupplier==='luizinho'\)separateLuizinhoWeeks\(target\)/);
  assert.match(style,/\.luizinho-week-heading td/);
  assert.match(style,/\.luizinho-week-grouped>thead th:first-child/);
  assert.match(index,/style\.css\?v=20260924-3/);
  assert.match(index,/admin\.js\?v=20260923-4/);
  assert.match(worker,/cortez-garage-v226/);
});

test('nota do Luizinho usa tabela no computador e cartões completos no celular',async()=>{
  const [admin,style,index,worker]=await Promise.all(['src/admin.js','src/style.css','index.html','public/sw.js'].map(file=>readFile(file,'utf8')));
  assert.match(admin,/supplier-note-editor-popup/);
  for(const label of ['Código','Marca','Quantidade','Descrição','Valor unitário','Valor total'])assert.ok(admin.includes(`data-label="${label}"`));
  assert.match(style,/\.supplier-note-items table\{min-width:940px\}/);
  assert.match(style,/@media\(max-width:640px\)[\s\S]*\.supplier-note-editor-popup \.supplier-note-popup\{[\s\S]*height:100dvh/);
  assert.match(style,/\.supplier-note-editor-popup \.supplier-note-items tr\{display:grid/);
  assert.match(style,/\.supplier-note-editor-popup \.supplier-note-items thead\{display:none\}/);
  assert.match(style,/\.note-description\{grid-column:1\/-1\}/);
  assert.match(index,/style\.css\?v=20260924-3/);
  assert.match(index,/admin\.js\?v=20260923-4/);
  assert.match(worker,/cortez-garage-v226/);
});
