import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('pronto para entrega usa uma única operação transacional',async()=>{
  const[supabase,workflow,sql]=await Promise.all([
    read('src/supabase.js'),read('src/order-workflow.js'),read('supabase/estoque-baixa-atomica.sql')
  ]);
  assert.match(supabase,/rpc\/finalizar_os_pronta/);
  assert.match(workflow,/await finalizeOrderReady\(order,links\.selections\)/);
  assert.doesNotMatch(workflow,/await consumeStockForOrder\(order,selections\).*await updateOrderStatus.*await recordOrderReadyReceivable/s);
  assert.match(sql,/create or replace function public\.finalizar_os_pronta/);
  assert.match(sql,/for update/);
  assert.match(sql,/on conflict \(entidade, registro_id\) where entidade = 'estoque_saida' do nothing/);
  assert.match(sql,/insert into public\.lancamentos_financeiros/);
  assert.match(sql,/update public\.ordens_servico set status = 'Pronto para entrega'/);
});

test('alterações são confirmadas antes de colocar a O.S. como pronta',async()=>{
  const[workflow,budget,main]=await Promise.all([read('src/order-workflow.js'),read('src/budget-order.js'),read('src/main.js')]);
  assert.match(budget,/saveBudgetButton\._persistOrder=async\(\)=>/);
  assert.match(budget,/await pausePendingDatabaseSave\(\)/);
  assert.match(budget,/if\(displayedStatus&&!\['Pronto para entrega','Entregue'\]\.includes\(displayedStatus\)\)order\.status=displayedStatus/);
  assert.match(main,/cortez:pause-database-save/);
  assert.match(main,/cortez:order-ready/);
  assert.match(main,/localStorage\.removeItem\(PENDING_DB_KEY\)/);
  assert.match(workflow,/await budgetSave\._persistOrder\(\)/);
  assert.match(workflow,/await saveOrderProgress\(order\);await saveOrderValues\(order\)/);
  assert.ok(workflow.indexOf('await saveOrderValues(order)')<workflow.indexOf('await finalizeOrderReady(order,links.selections)'));
  const makeReady=workflow.slice(workflow.indexOf('async function makeReady'),workflow.indexOf('async function reopenReady'));
  assert.doesNotMatch(makeReady,/location\.reload\(\)/);
  assert.match(workflow,/Apenas as peças selecionadas do estoque físico foram baixadas automaticamente/);
});

test('status final não pode ser escolhido pelo seletor comum',async()=>{
  const[workflow,sql]=await Promise.all([read('src/order-workflow.js'),read('supabase/estoque-baixa-atomica.sql')]);
  assert.match(workflow,/\['Pronto para entrega','Entregue'\]\.includes\(option\.value\).*option\.disabled=true/);
  assert.match(workflow,/status\.disabled=\['Pronto para entrega','Entregue'\]\.includes\(order\?\.status\)/);
  assert.match(workflow,/Primeiro use o botão “Veículo pronto para entrega”/);
  assert.match(sql,/Use o fluxo seguro para colocar a O\.S\. como pronta/);
  assert.match(sql,/Coloque a O\.S\. como pronta para entrega antes de entregá-la/);
});

test('reabertura estorna estoque e remove somente a conta pendente',async()=>{
  const[supabase,workflow,budget,sql]=await Promise.all([
    read('src/supabase.js'),read('src/order-workflow.js'),read('src/budget-order.js'),read('supabase/estoque-baixa-atomica.sql')
  ]);
  assert.match(supabase,/rpc\/reabrir_os_pronta/);
  assert.match(workflow,/Reabrir O\.S\. e estornar/);
  assert.match(budget,/Use “Reabrir O\.S\. e estornar”/);
  assert.match(sql,/A conta a receber desta O\.S\. já foi baixada e impede a reabertura/);
  assert.match(sql,/set quantidade = coalesce\(quantidade, 0\) \+ greatest/);
  assert.match(sql,/entidade, registro_id, dados\)\s+values \('app', 'estoque_estorno'/s);
  assert.match(sql,/delete from public\.lancamentos_financeiros[\s\S]*status <> 'Realizado'/);
});

test('peças e valores ficam bloqueados depois da baixa',async()=>{
  const sql=await read('supabase/estoque-baixa-atomica.sql');
  assert.match(sql,/old\.status in \('Pronto para entrega', 'Entregue'\)/);
  assert.match(sql,/new\.dados_extras->'budget' is distinct from old\.dados_extras->'budget'/);
  assert.match(sql,/Reabra a O\.S\. com estorno antes de alterar peças ou valores/);
  assert.match(sql,/alter table public\.estoque enable row level security/);
  assert.match(sql,/create policy estoque_leitura_autenticada/);
  assert.match(sql,/create policy estoque_escrita_operacional/);
});
