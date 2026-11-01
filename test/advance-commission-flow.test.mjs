import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import test from'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('cada novo adiantamento é somado e lançado separadamente no caixa',async()=>{
  const[supabase,workflow,change]=await Promise.all([read('src/supabase.js'),read('src/order-workflow.js'),read('src/order-change.js')]);
  assert.match(supabase,/normalizedOrderAdvances/);
  assert.match(supabase,/updatedAdvances=\[\.\.\.advances,entry\]/);
  assert.match(supabase,/reference=`adiantamento-os-\$\{order\.id\}-\$\{id\}`/);
  assert.match(supabase,/remaining=Math\.max\(0,\(Number\(order\.total\)\|\|0\)-currentTotal\)/);
  assert.match(supabase,/if\(amount>remaining\+\.01\)/);
  assert.match(supabase,/advances:Array\.isArray\(order\.advances\)/);
  assert.match(workflow,/Novo adiantamento/);
  assert.match(workflow,/Histórico de adiantamentos/);
  assert.match(workflow,/Total já adiantado/);
  assert.match(change,/['"]advances['"]/);
});

test('comissão pode ser liberada por serviço antes da entrega e paga com saída no caixa',async()=>{
  const[supabase,workflow,admin]=await Promise.all([read('src/supabase.js'),read('src/order-workflow.js'),read('src/admin.js')]);
  assert.match(workflow,/recordOrderCommissions/);
  assert.match(workflow,/R\$ Comissões antecipadas/);
  assert.match(workflow,/liberar por serviço/);
  assert.match(workflow,/release-one-commission/);
  assert.match(workflow,/recordOrderCommissions\(order,\[Number\(button\.dataset\.index\)\]\)/);
  assert.match(supabase,/export async function recordOrderCommissions/);
  assert.match(supabase,/serviceCommissionReference=\(order,index\)=>`comissao-os-\$\{order\.id\}-servico-\$\{index\+1\}`/);
  assert.match(supabase,/export async function payCommissions/);
  assert.match(supabase,/Pagamento consolidado de comissões/);
  assert.match(supabase,/pending\.reduce\(\(sum,row\)=>sum\+Number\(row\.valor\|\|0\),0\)/);
  assert.match(supabase,/method:'PATCH'[\s\S]*status:'Realizado'/);
  assert.match(admin,/Pagar comissões/);
  assert.match(admin,/Caixa utilizado/);
  assert.match(admin,/await payCommissions\(commissions\.map\(record=>record\.id\),account,reference\)/);
  assert.match(admin,/somente um lançamento consolidado/);
});

test('sócios e mecânicos usam pagamento consolidado por pessoa',async()=>{
  const[supabase,admin,worker]=await Promise.all([read('src/supabase.js'),read('src/admin.js'),read('public/sw.js')]);
  assert.match(admin,/class="primary pay-commissions" data-person="\$\{esc\(partner\)\}"/);
  assert.match(admin,/class="primary pay-commissions" data-person="\$\{esc\(activeMechanic\)\}"/);
  assert.match(admin,/Incluída no pagamento consolidado/);
  assert.match(admin,/partnerSettlementRecords\(button\.dataset\.person\).*'Comissões sócios'/);
  assert.match(admin,/if\(partner\)activePartner=partner;records=await readFinance\(\);popup\.remove\(\);renderArea\(returnArea\)/);
  assert.match(supabase,/people\.length!==1.*Consolide separadamente as comissões de cada pessoa/);
  assert.match(supabase,/os_id:null,referencia:paymentReference/);
  assert.match(worker,/cortez-garage-v320-gustavo-no-finance/);
});

test('pagamento de sócio relê e baixa todas as comissões pendentes em uma única saída',async()=>{
  const[supabase,admin]=await Promise.all([read('src/supabase.js'),read('src/admin.js')]);
  const start=supabase.indexOf('export async function payAllPartnerCommissions'),end=supabase.indexOf('\nexport ',start+20),block=supabase.slice(start,end);
  assert.match(block,/Somente o proprietário pode pagar as comissões dos sócios/);
  assert.match(block,/\['Fabiano','Marcelino'\]\.includes\(partner\)/);
  assert.match(block,/categoria=eq\.\$\{encodeURIComponent\('Comissões'\)\}&status=neq\.Realizado&mecanico=eq/);
  assert.match(block,/startsWith\('partner-weekly-v2-'\)/);
  assert.match(block,/return payCommissions\(ids,paymentType,reference\)/);
  assert.match(admin,/partner\?await payAllPartnerCommissions\(partner,account,reference\):await payCommissions/);
  assert.match(admin,/paidCount=result\.records\.length,paidTotal=result\.total/);
  assert.match(admin,/Uma única saída de \$\{money\(paidTotal\)\}/);
});

test('liberação antecipada pendente pode ser cancelada sem permitir estorno da paga',async()=>{
  const[supabase,workflow]=await Promise.all([read('src/supabase.js'),read('src/order-workflow.js')]);
  assert.match(supabase,/export async function cancelOrderCommission/);
  assert.match(supabase,/row\.status==='Realizado'.*não pode ter a liberação cancelada/);
  assert.match(supabase,/orders\[0\]\?\.status==='Entregue'.*não pode ser cancelada/);
  assert.match(workflow,/Cancelar liberação/);
  assert.match(workflow,/await cancelOrderCommission\(button\.dataset\.id\)/);
  assert.match(workflow,/Uma liberação pendente pode ser cancelada/);
});

test('janela de comissões usa tabela ampla no computador e cartões no celular',async()=>{
  const[workflow,style,index]=await Promise.all([read('src/order-workflow.js'),read('src/style.css'),read('index.html')]);
  assert.match(workflow,/commission-release-columns/);
  assert.match(workflow,/commission-service-row/);
  assert.match(workflow,/modal\.classList\.add\('commission-release-popup'\)/);
  assert.match(style,/\.commission-release-popup \.check-popup-card\{[^}]*width:min\(1180px,[^}]*height:min\(820px/);
  assert.match(style,/\.commission-release-columns,.commission-service-row\{[^}]*grid-template-columns:/);
  assert.match(style,/@media\(max-width:760px\)[\s\S]*\.commission-service-row\{grid-template-columns:1fr 1fr/);
  assert.match(index,/style\.css\?v=20261031-6/);
  assert.match(index,/order-workflow\.js\?v=20261101-3/);
});

test('entrega não duplica comissão antecipada nem reabre comissão já paga',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/usesLegacyCommission=.*legacyOrderCommissionRecords/);
  assert.match(supabase,/select=id,status&referencia=eq\.\$\{encodeURIComponent\(row\.referencia\)\}/);
  assert.match(supabase,/if\(existing\[0\]\.status!=='Realizado'\).*method:'PATCH'/);
});

