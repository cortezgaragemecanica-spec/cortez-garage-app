import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');

test('pagamentos arquivados de sócios são filtrados e totalizados por mês',()=>{
  assert.match(source,/partnerArchiveMonth/);
  assert.match(source,/id="partnerArchiveMonth"/);
  assert.match(source,/allArchived\.filter\(item=>commissionArchiveRecordMonth\(item\)===partnerArchiveMonth\)/);
  assert.match(source,/Total pago no mês/);
});

test('pago após o saldo confirmado mostra somente o mês vigente',()=>{
  assert.match(source,/paidCurrentMonth=ledger\.payments\.filter\(item=>commissionArchiveRecordMonth\(item\)===currentMonth\)/);
  assert.match(source,/Pago após o saldo confirmado/);
  assert.match(source,/Somente \$\{esc\(costPlanMonthLabel\(currentMonth\)\)\}/);
});

test('comissões pagas dos mecânicos podem ser acessadas mês a mês',()=>{
  assert.match(source,/id="commissionArchiveMonth"/);
  assert.match(source,/archived\.filter\(record=>commissionArchiveRecordMonth\(record\)===commissionArchiveMonth\)/);
  assert.match(source,/Pago em \$\{esc\(costPlanMonthLabel\(commissionArchiveMonth\)\)\}/);
});
