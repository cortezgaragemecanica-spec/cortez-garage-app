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
  assert.match(supabase,/export async function payCommission/);
  assert.match(supabase,/pagamento-comissao-[\s\S]*referencia:reference/);
  assert.match(admin,/Pagar comissão/);
  assert.match(admin,/Caixa utilizado/);
  assert.match(admin,/await payCommission\(record\.id,account\)/);
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

test('entrega não duplica comissão antecipada nem reabre comissão já paga',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/usesLegacyCommission=.*legacyOrderCommissionRecords/);
  assert.match(supabase,/select=id,status&referencia=eq\.\$\{encodeURIComponent\(row\.referencia\)\}/);
  assert.match(supabase,/if\(existing\[0\]\.status!=='Realizado'\).*method:'PATCH'/);
});

