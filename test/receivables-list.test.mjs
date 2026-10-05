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
