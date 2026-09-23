import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('mecânico envia diagnóstico e observação para revisão sem alterar a O.S. diretamente',async()=>{
  const[review,access,supabase,index,databaseGuard]=await Promise.all([
    read('src/order-review-requests.js'),read('src/access-control.js'),read('src/supabase.js'),read('index.html'),read('supabase/bloqueio-revisao-mecanicos.sql')
  ]);
  assert.match(review,/\['#diagnosis','diagnosis'\],\['#services','observation'\]/);
  assert.match(review,/input\.readOnly=true/);
  assert.match(review,/saveOrderReviewRequest/);
  assert.match(review,/applyOrderReviewRequest/);
  assert.doesNotMatch(access,/addOnlyProtectedFields=\['#diagnosis','#services'/);
  assert.match(supabase,/entidade:'solicitacao_revisao_os'/);
  assert.match(supabase,/Somente o proprietário pode aplicar textos revisados/);
  assert.match(supabase,/if\(canManageServices\(\)\)\{body\.diagnostico=/);
  assert.match(supabase,/diagnosis:saved\.diagnosis,notes:saved\.notes/);
  assert.match(databaseGuard,/new\.diagnostico := old\.diagnostico/);
  assert.match(databaseGuard,/old\.dados_extras -> 'services'/);
  assert.match(index,/order-review-requests\.js\?v=20260924-1/);
});

test('entrega só muda o status depois da confirmação do caixa',async()=>{
  const main=await read('src/main.js');
  assert.match(main,/event\.stopImmediatePropagation\(\).*field\.value=order\.status/);
  assert.match(main,/await recordOrderDelivery\(order,paymentType\);await updateOrderStatus\(order\.id,'Entregue'\)/);
});

test('salvamento pendente sobrevive a reinício e sincroniza antes da leitura',async()=>{
  const main=await read('src/main.js');
  assert.match(main,/cortez-garage-pending-db-v1/);
  assert.match(main,/localStorage\.getItem\(PENDING_DB_KEY\)\|\|localStorage\.getItem\(DBKEY\)/);
  assert.match(main,/if\(localStorage\.getItem\(PENDING_DB_KEY\)\)await pushMovement\(\)/);
  assert.match(main,/setInterval\(refreshVisibleDashboard,30000\)/);
});

test('APK não contém credencial fixa de sincronização',async()=>{
  const activity=await read('android/app/src/main/java/com/cortezgarage/app/MainActivity.java');
  const manifest=await read('android/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(activity,/SYNC_TOKEN|SYNC_URL|setItem\('cortez-sync/);
  assert.match(activity,/localStorage\.removeItem\(syncKey\)/);
  assert.doesNotMatch(manifest,/OrderNotificationService/);
});

test('estoque oferece baixa transacional e paginação de leituras',async()=>{
  const[supabase,migration]=await Promise.all([read('src/supabase.js'),read('supabase/estoque-baixa-atomica.sql')]);
  assert.match(supabase,/rpc\/processar_baixa_estoque/);
  assert.match(supabase,/async function readPages/);
  assert.match(migration,/for update/);
  assert.match(migration,/usuario_tem_permissao\('readyOrders'\)/);
});
