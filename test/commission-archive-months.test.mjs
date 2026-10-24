import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');

test('pagamentos arquivados de sócios são filtrados e totalizados por mês',()=>{
  assert.match(source,/partnerArchiveMonth/);
  assert.match(source,/id="partnerArchiveMonth"/);
  assert.match(source,/historySource\.filter\(item=>commissionArchiveRecordMonth\(item\)===partnerArchiveMonth\)/);
  assert.match(source,/Total no período/);
});

test('visão dos sócios mostra somente comissões lançadas pelo acerto semanal',()=>{
  assert.match(source,/partnerSettlementRecords/);
  assert.match(source,/PARTNER_SETTLEMENT_PREFIX/);
  assert.match(source,/Consulta dos lançamentos dos sócios/);
  assert.match(source,/Pagas e arquivadas/);
  assert.doesNotMatch(source,/if\(await rolloverExpiredPartnerCommissions\(\)\)/);
});

test('histórico dos pagamentos dos sócios fica em uma consulta separada',()=>{
  assert.match(source,/const partnerPaymentRecords=/);
  assert.match(source,/data-partner-view="payments"/);
  assert.match(source,/Histórico de pagamentos/);
  assert.match(source,/\^comiss\(\?:ao\|oes\)\\b/);
  assert.match(source,/!\/\^partner-week-rollover-/);
});

test('comissões pagas dos mecânicos podem ser acessadas mês a mês',()=>{
  assert.match(source,/id="commissionArchiveMonth"/);
  assert.match(source,/archived\.filter\(record=>commissionArchiveRecordMonth\(record\)===commissionArchiveMonth\)/);
  assert.match(source,/Pago em \$\{esc\(costPlanMonthLabel\(commissionArchiveMonth\)\)\}/);
});
