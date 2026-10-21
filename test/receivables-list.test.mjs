import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('contas a receber lista todas as pendentes e arquiva as realizadas',async()=>{
  const admin=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
  assert.match(admin,/const pending=all\.filter\(record=>record\.status!=='Realizado'\)/);
  assert.match(admin,/archived=all\.filter\(record=>record\.status==='Realizado'\)/);
  assert.match(admin,/showReceivedArchive\?archived:pending/);
  assert.match(admin,/Total de todas as contas em aberto/);
  assert.match(admin,/Recebidas arquivadas/);
  assert.match(admin,/Recebida · Arquivada/);
  assert.doesNotMatch(admin,/pending=all\.filter\(record=>record\.status!=='Realizado'&&readyReceivable/);
});

test('contas a receber em aberto podem ser editadas sem alterar as já recebidas',async()=>{
  const admin=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
  assert.match(admin,/class="secondary edit-receivable"/);
  assert.match(admin,/function openReceivableEditPopup\(id\)/);
  assert.match(admin,/item\.category==='Conta a receber'&&item\.status!=='Realizado'/);
  assert.match(admin,/EDITAR CONTA A RECEBER/);
  assert.match(admin,/category:'Conta a receber',kind:'Entrada'/);
  assert.match(admin,/renderArea\('Conta a receber'\)/);
  assert.match(admin,/\.edit-receivable/);
});

test('contas a receber aceitam baixa parcial e preservam o saldo restante',async()=>{
  const [admin,supabase]=await Promise.all(['../src/admin.js','../src/supabase.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  for(const label of ['Valor original','Recebido','Saldo','Valor recebido agora','Registrar recebimento parcial','Recebimento parcial registrado'])assert.ok(admin.includes(label));
  assert.match(admin,/function receivablePaymentInfo\(record\)/);
  assert.match(admin,/await settleReceivable\(record\.id,account,amount\)/);
  assert.match(admin,/supabase\.js\?v=20261021-1/);
  assert.match(supabase,/export async function settleReceivable\(id,paymentType,amount\)/);
  assert.match(supabase,/status:settled\?'Realizado':'Pendente'/);
  assert.match(supabase,/valor:settled\?Number\(amount\.toFixed\(2\)\):Number\(remaining\.toFixed\(2\)\)/);
  assert.match(supabase,/A conta foi alterada em outro aparelho/);
  assert.match(supabase,/cashId.*method:'DELETE'/);
});
