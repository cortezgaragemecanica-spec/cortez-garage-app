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
  assert.match(admin,/partner-settlement-list/);
  assert.match(admin,/partner-settlement-order/);
  assert.match(admin,/partner-settlement-breakdown/);
  assert.match(admin,/Total recebido/);
  assert.doesNotMatch(admin,/partner-settlement-table/);
  assert.match(admin,/data-launch-partner="Fabiano"/);
  assert.match(admin,/data-launch-partner="Marcelino"/);
  assert.match(admin,/partners:\[partner\]/);
  assert.match(admin,/saveWeeklyPartnerSettlement/);
  assert.doesNotMatch(admin,/if\(await rolloverExpiredPartnerCommissions\(\)\)/);
});

test('acerto semanal usa cartões fluidos no desktop sem tabela horizontal cortada',async()=>{
  const[admin,style,index,worker]=await Promise.all(['src/admin.js','src/style.css','index.html','public/sw.js'].map(read));
  assert.match(admin,/class="partner-settlement-order"/);
  assert.match(admin,/class="partner-settlement-breakdown"/);
  assert.match(style,/\.partner-settlement-breakdown\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(style,/\.partner-settlement-order footer\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(style,/@media\(max-width:1180px\)\{\.partner-settlement-order footer\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(style,/@media\(max-width:760px\)[\s\S]*\.partner-settlement-breakdown\{grid-template-columns:1fr/);
  assert.match(index,/admin\.js\?v=20261024-2/);
  assert.match(index,/style\.css\?v=20261024-2/);
  assert.match(worker,/cortez-garage-v304-payable-month-partner-history/);
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
