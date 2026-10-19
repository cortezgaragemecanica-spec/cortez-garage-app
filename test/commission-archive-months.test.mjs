import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');

test('pagamentos arquivados de sócios são filtrados e totalizados por mês',()=>{
  assert.match(source,/partnerArchiveMonth/);
  assert.match(source,/id="partnerArchiveMonth"/);
  assert.match(source,/archived\.filter\(item=>commissionArchiveRecordMonth\(item\)===partnerArchiveMonth\)/);
  assert.match(source,/Total pago no período/);
});

test('visão dos sócios mostra somente comissões lançadas pelo acerto semanal',()=>{
  assert.match(source,/partnerSettlementRecords/);
  assert.match(source,/PARTNER_SETTLEMENT_PREFIX/);
  assert.match(source,/Somente valores lançados pela aba Acerto semanal/);
  assert.match(source,/Pagas e arquivadas/);
  assert.doesNotMatch(source,/if\(await rolloverExpiredPartnerCommissions\(\)\)/);
});

test('comissões pagas dos mecânicos podem ser acessadas mês a mês',()=>{
  assert.match(source,/id="commissionArchiveMonth"/);
  assert.match(source,/archived\.filter\(record=>commissionArchiveRecordMonth\(record\)===commissionArchiveMonth\)/);
  assert.match(source,/Pago em \$\{esc\(costPlanMonthLabel\(commissionArchiveMonth\)\)\}/);
});
