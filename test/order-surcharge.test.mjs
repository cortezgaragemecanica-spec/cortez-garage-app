import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{NEW_ORDER_SURCHARGE_RATE,calculateOrderTotals}from'../src/order-surcharge.js';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('calcula 10% somente sobre as peças e arredonda valores monetários',()=>{
  assert.equal(NEW_ORDER_SURCHARGE_RATE,.10);
  assert.deepEqual(calculateOrderTotals({partsValue:600,labor:400,discount:100,surchargeRate:.10}),{base:900,surchargeRate:.10,surchargeAmount:60,total:960});
  assert.deepEqual(calculateOrderTotals({partsValue:10.01,labor:0,discount:0,surchargeRate:.10}),{base:10.01,surchargeRate:.10,surchargeAmount:1,total:11.01});
});

test('ordens sem a marca do acréscimo permanecem com o total antigo',()=>{
  assert.deepEqual(calculateOrderTotals({partsValue:600,labor:400,discount:100}),{base:900,surchargeRate:0,surchargeAmount:0,total:900});
});

test('acréscimo é opcional, aparece nos totais e não altera a mão de obra no PDF',async()=>{
  const[main,budget,workflow,supabase,pdf,help]=await Promise.all(['src/main.js','src/budget-order.js','src/order-workflow.js','src/supabase.js','src/pdf-order.js','src/help.js'].map(read));
  assert.match(main,/surchargeRate:0,surchargePolicy:'optional-parts-10-v2'/);
  assert.match(main,/id="surchargeEnabled"/);
  assert.match(main,/Aplicar acréscimo de 10% somente nas peças/);
  assert.match(main,/id="orderBaseTotal"/);
  assert.match(main,/VALOR TOTAL COM ACRÉSCIMO/);
  assert.match(budget,/id="budgetBaseTotal"/);
  assert.match(workflow,/calculateOrderTotals\(order\)/);
  assert.match(supabase,/surchargeRate:Number\(item\.surchargeRate\)\|\|0/);
  assert.match(supabase,/surchargePolicy:order\.surchargePolicy/);
  assert.doesNotMatch(pdf,/Acréscimo automático/);
  assert.match(pdf,/servicePdfSection\(order,money,1\)/);
  assert.match(pdf,/Number\(item\.value\|\|0\)\*itemMultiplier/);
  assert.match(help,/acréscimo de 10% é opcional/);
  assert.match(help,/mão de obra permanece sem acréscimo/);
});
