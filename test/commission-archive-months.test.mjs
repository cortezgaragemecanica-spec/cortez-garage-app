import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');

test('pagamentos arquivados de sócios são filtrados e totalizados por mês',()=>{
  assert.match(source,/partnerArchiveMonth/);
  assert.match(source,/id="partnerArchiveMonth"/);
  assert.match(source,/allArchived\.filter\(item=>commissionArchiveRecordMonth\(item\)===partnerArchiveMonth\)/);
  assert.match(source,/Total arquivado no mês/);
});

test('visão dos sócios mostra somente a semana vigente de segunda a sábado',()=>{
  assert.match(source,/partnerCommissionWeek\(localDateOnly\(new Date\(\)\)\)/);
  assert.match(source,/summarizePartnerCommissionWeek\(ledger,currentWeek\.start\)/);
  assert.match(source,/Semana vigente/);
  assert.match(source,/Semanas quitadas e arquivadas/);
  assert.match(source,/Gerado na semana/);
  assert.match(source,/Saldo da semana/);
  assert.doesNotMatch(source,/Outras semanas em aberto/);
});

test('comissões pagas dos mecânicos podem ser acessadas mês a mês',()=>{
  assert.match(source,/id="commissionArchiveMonth"/);
  assert.match(source,/archived\.filter\(record=>commissionArchiveRecordMonth\(record\)===commissionArchiveMonth\)/);
  assert.match(source,/Pago em \$\{esc\(costPlanMonthLabel\(commissionArchiveMonth\)\)\}/);
});
