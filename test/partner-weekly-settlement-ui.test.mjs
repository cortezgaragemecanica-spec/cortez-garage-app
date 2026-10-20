import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('acerto semanal é exclusivo do proprietário e substitui o cálculo automático dos sócios',async()=>{
  const admin=await read('src/admin.js');
  assert.match(admin,/settlementButton=financeOwner\(\)\?'<button data-finance-area="Acerto semanal"/);
  assert.match(admin,/if\(\['Acerto semanal','Recuperação financeira'\]\.includes\(area\)&&!financeOwner\(\)\)area='Fluxo de caixa'/);
  assert.match(admin,/partnerButton=canViewPartnerCommissions\(\)\?'<button data-finance-area="Comissões sócios"/);
  assert.match(admin,/if\(area==='Comissões sócios'&&!canViewPartnerCommissions\(\)\)area='Fluxo de caixa'/);
  assert.match(admin,/function partnerSettlementReceiptEvents\(\)/);
  assert.match(admin,/function partnerSettlementHtml\(\)/);
  assert.match(admin,/<th>O\.S\.<\/th><th>Cliente<\/th><th>Carro<\/th><th>Peças e custos<\/th><th>Serviços e valores<\/th><th>Total custo<\/th><th>Lucro bruto<\/th><th>Fabiano<\/th><th>Marcelino<\/th>/);
  assert.match(admin,/data-launch-partner="Fabiano"/);
  assert.match(admin,/data-launch-partner="Marcelino"/);
  assert.match(admin,/partners:\[partner\]/);
  assert.match(admin,/saveWeeklyPartnerSettlement/);
  assert.doesNotMatch(admin,/if\(await rolloverExpiredPartnerCommissions\(\)\)/);
});

test('lançamento semanal grava somente registros explícitos e não duplica comissão paga',async()=>{
  const supabase=await read('src/supabase.js');
  const start=supabase.indexOf('export async function saveWeeklyPartnerSettlement'),end=supabase.indexOf('\nexport ',start+20),block=supabase.slice(start,end);
  assert.match(supabase,/export async function saveWeeklyPartnerSettlement/);
  assert.match(supabase,/Somente o proprietário pode lançar o acerto semanal dos sócios/);
  assert.match(supabase,/partner-weekly-v2-/);
  assert.match(block,/partners=\['Fabiano','Marcelino'\]/);
  assert.match(block,/for\(const partner of selected\)/);
  assert.match(supabase,/if\(existing\?\.status==='Realizado'\)continue/);
  assert.match(block,/if\(existing\)await request/);
  assert.match(block,/method:'PATCH'/);
  assert.match(block,/method:'POST'/);
  assert.doesNotMatch(block,/method:'DELETE'/);
});

test('fechamento mensal usa apenas as comissões lançadas no novo acerto',async()=>{
  const closing=await read('src/monthly-closing.js');
  assert.match(closing,/startsWith\('partner-weekly-v2-'\)/);
  assert.match(closing,/record\.mechanic===name/);
});
