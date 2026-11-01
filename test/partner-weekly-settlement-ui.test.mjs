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
  assert.match(admin,/data-launch-partner="\$\{partner\}"/);
  assert.match(admin,/launchCard\('Fabiano'\)/);
  assert.match(admin,/launchCard\('Marcelino'\)/);
  assert.match(admin,/data-cancel-partner="\$\{partner\}"/);
  assert.match(admin,/cancelWeeklyPartnerSettlement/);
  assert.match(admin,/Comissões já pagas não serão alteradas/);
  assert.match(admin,/data-global-settlement-rate/);
  assert.match(admin,/data-global-settlement-parts-rate/);
  assert.match(admin,/PERCENTUAIS PARA TODAS AS O\.S\./);
  assert.doesNotMatch(admin,/data-settlement-rate data-order-id/);
  assert.doesNotMatch(admin,/data-settlement-parts-rate data-order-id/);
  assert.match(admin,/Lucro das peças/);
  assert.match(admin,/id="partnerSettlementReserveRate"/);
  assert.match(admin,/Margem de reserva sobre o lucro das peças/);
  assert.match(admin,/reserveRate:partnerSettlementReserveRate/);
  assert.match(admin,/reserveAmount:row\.reserveAmount/);
  assert.match(admin,/partsRates:row\.partsRates/);
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
  assert.match(style,/\.partner-settlement-controls\{[^}]*grid-template-columns:/);
  assert.match(style,/\.partner-settlement-global-rates\{[^}]*grid-column:1\/-1/);
  assert.match(style,/\.settlement-partner-result\{[^}]*display:grid/);
  assert.match(style,/@media\(max-width:1180px\)\{\.partner-settlement-order footer\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(style,/@media\(max-width:760px\)[\s\S]*\.partner-settlement-breakdown\{grid-template-columns:1fr/);
  assert.match(index,/admin\.js\?v=20261031-9/);
  assert.match(index,/style\.css\?v=20261031-5/);
  assert.match(worker,/cortez-garage-v316-consolidated-partner-payment/);
});

test('PDF do acerto semanal usa lista própria com fundo branco',async()=>{
  const[admin,style,exporter]=await Promise.all(['src/admin.js','src/style.css','src/report-pdf-export.js'].map(read));
  const pdfStart=admin.indexOf('function partnerSettlementPdfContent'),pdfEnd=admin.indexOf('\nfunction ',pdfStart+20),pdfBlock=admin.slice(pdfStart,pdfEnd);
  assert.match(admin,/function partnerSettlementPdfContent\(\)/);
  assert.match(admin,/class="partner-settlement-pdf-list"/);
  assert.match(admin,/class="partner-settlement-pdf-row"/);
  assert.match(admin,/settlement=area==='Acerto semanal'/);
  assert.match(admin,/settlement\?partnerSettlementPdfContent\(\):content\.innerHTML/);
  assert.match(style,/\.partner-settlement-pdf \.report-pdf-sheet[^}]*background:#fff!important/);
  assert.match(style,/\.partner-settlement-pdf-row\{[^}]*break-inside:avoid[^}]*background:#fff/);
  assert.match(style,/\.partner-settlement-pdf-details\{[^}]*grid-template-columns:1fr 1fr/);
  assert.match(exporter,/settlement=container\.querySelector\('\.partner-settlement-pdf-content'\)/);
  assert.match(exporter,/const drawSettlement=/);
  assert.doesNotMatch(admin,/Fabiano · geral \$\{row\.rates\.Fabiano\.toFixed\(2\)\}%/);
  assert.doesNotMatch(admin,/Marcelino · geral \$\{row\.rates\.Marcelino\.toFixed\(2\)\}%/);
  assert.doesNotMatch(admin,/Demais lucros \$\{row\.rates\[partner\]\.toFixed\(2\)\}%/);
  assert.match(admin,/Comissão sobre demais lucros:/);
  assert.match(admin,/comissão sobre peças:/);
  assert.doesNotMatch(pdfBlock,/row\.rates|row\.partsRates/);
  assert.match(exporter,/details\.forEach\(detail=>line\('Detalhamento',detail\)\)/);
  assert.match(exporter,/querySelector\('span'\)\?\.textContent/);
  assert.match(exporter,/if\(settlement\)\{drawSettlement\(\);return pages\}/);
  assert.match(exporter,/ctx\.fillStyle='#eee'/);
  assert.doesNotMatch(exporter,/if\(settlement\)[^}]*ctx\.fillRect\(MARGIN,50,CONTENT,118\)/);
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
  assert.match(block,/partsRate/);
  assert.match(block,/peças/);
  assert.match(block,/reserveRate/);
  assert.match(block,/reserveAmount/);
  assert.match(block,/reserva/);
  assert.doesNotMatch(block,/method:'DELETE'/);
});

test('cancelamento do acerto remove somente comissões pendentes da semana vigente',async()=>{
  const supabase=await read('src/supabase.js');
  const start=supabase.indexOf('export async function cancelWeeklyPartnerSettlement'),end=supabase.indexOf('\nexport ',start+20),block=supabase.slice(start,end);
  assert.match(block,/Somente o proprietário pode cancelar/);
  assert.match(block,/weekStart!==partnerCommissionWeekStart\(\)/);
  assert.match(block,/row\.status==='Pendente'/);
  assert.match(block,/startsWith\(prefix\)/);
  assert.match(block,/id=eq\.\$\{encodeURIComponent\(row\.id\)\}&status=eq\.Pendente/);
  assert.match(block,/method:'DELETE'/);
  assert.match(block,/prefer:'return=representation'/);
  assert.doesNotMatch(block,/status==='Realizado'.*method:'DELETE'/);
});

test('acerto é arquivado quando os dois sócios foram lançados e pode ser consultado',async()=>{
  const[admin,style]=await Promise.all(['src/admin.js','src/style.css'].map(read));
  assert.match(admin,/const PARTNER_SETTLEMENT_PARTNERS=\['Fabiano','Marcelino'\]/);
  assert.match(admin,/partnerSettlementWeekArchived=weekStart=>PARTNER_SETTLEMENT_PARTNERS\.every/);
  assert.match(admin,/partnerSettlementWeekRecords\(weekStart\)\.some\(record=>record\.mechanic===partner\)/);
  assert.match(admin,/if\(partnerSettlementWeekArchived\(week\.start\)\)return partnerSettlementArchivedHtml\(week\)/);
  assert.match(admin,/id="partnerSettlementArchiveWeek"/);
  assert.match(admin,/ACERTO ARQUIVADO/);
  assert.match(admin,/Semana arquivada/);
  assert.match(admin,/O acerto da semana foi arquivado/);
  assert.match(admin,/O acerto foi reaberto para correção e novo lançamento/);
  assert.match(admin,/function partnerSettlementArchivedPdfContent\(week\)/);
  assert.match(style,/\.partner-settlement-archive-banner\{/);
  assert.match(style,/\.partner-settlement-archive-list\{/);
});

test('comissões dos sócios mostram O.S., veículo e divisão entre peças e mão de obra',async()=>{
  const[admin,style]=await Promise.all(['src/admin.js','src/style.css'].map(read));
  assert.match(admin,/function partnerCommissionBreakdown\(record\)/);
  assert.match(admin,/const order=financeOrder\(record\)/);
  assert.match(admin,/demais\\s\+\(\[\\d\.,\]\+\)\\s\+x/);
  assert.match(admin,/peças\\s\+\(\[\\d\.,\]\+\)\\s\+x/);
  assert.match(admin,/function partnerCommissionDescriptionHtml\(record\)/);
  assert.match(admin,/O\.S\. #\$\{esc\(detail\.number\)\} · \$\{esc\(detail\.vehicle\)\}/);
  assert.match(admin,/Comissão das peças: \$\{money\(detail\.partsCommission\)\}/);
  assert.match(admin,/Comissão da mão de obra: \$\{money\(detail\.laborCommission\)\}/);
  assert.match(admin,/partnerPaymentHistory\?esc\(item\.description\):partnerCommissionDescriptionHtml\(item\)/);
  assert.match(style,/\.partner-commission-description\{[^}]*white-space:normal/);
});

test('fechamento mensal usa apenas as comissões lançadas no novo acerto',async()=>{
  const closing=await read('src/monthly-closing.js');
  assert.match(closing,/startsWith\('partner-weekly-v2-'\)/);
  assert.match(closing,/record\.mechanic===name/);
});
