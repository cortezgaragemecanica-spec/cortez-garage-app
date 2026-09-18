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
