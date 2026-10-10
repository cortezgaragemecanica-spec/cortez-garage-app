import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('orçamento fora do pátio é confirmado diretamente no banco',async()=>{
  const[source,index,worker,supabase]=await Promise.all([read('src/order-status.js'),read('index.html'),read('public/sw.js'),read('src/supabase.js')]);
  assert.match(index,/order-status\.js\?v=20261010-3/);
  assert.match(worker,/order-status\.js\?v=20261010-3/);
  assert.match(source,/Orçamento fora do pátio/);
  assert.match(source,/await updateOrderStatus\(order\.id,OUTSIDE_STATUS\)/);
  assert.match(source,/Status confirmado no banco/);
  assert.match(source,/field\.value=previous/);
  assert.match(supabase,/prefer:'return=representation'/);
  assert.match(supabase,/O banco não confirmou o novo status da O\.S\./);
});
