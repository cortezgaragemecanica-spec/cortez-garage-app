import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{createInstallmentPlan,normalizeCreditInstallments,suggestedInstallmentDates}from'../src/order-installments.js';

test('divide o pagamento a prazo em parcelas sem perder centavos',()=>{
  const plan=createInstallmentPlan(100,3,['2026-10-10','2026-11-10','2026-12-10']);
  assert.deepEqual(plan.map(item=>item.amount),[33.34,33.33,33.33]);
  assert.equal(plan.reduce((sum,item)=>sum+item.amount,0),100);
});

test('mantém cada vencimento informado pelo proprietário',()=>{
  const plan=createInstallmentPlan(250,2,['2026-10-15','2026-12-05']);
  assert.deepEqual(plan.map(item=>item.dueDate),['2026-10-15','2026-12-05']);
});

test('sugere vencimentos mensais respeitando o último dia do mês',()=>{
  assert.deepEqual(suggestedInstallmentDates(3,'2026-01-31'),['2026-01-31','2026-02-28','2026-03-31']);
});

test('registro antigo de uma parcela continua compatível',()=>{
  assert.deepEqual(normalizeCreditInstallments({amount:90,dueDate:'2026-11-20'}),[{number:1,amount:90,dueDate:'2026-11-20'}]);
});

test('fechamento cria vencimentos individuais e referências sem duplicidade',async()=>{
  const workflow=await readFile(new URL('../src/order-workflow.js',import.meta.url),'utf8'),supabase=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
  assert.match(workflow,/id="closingInstallmentCount"/);
  assert.match(workflow,/closing-installment-due/);
  assert.match(workflow,/installments:createInstallmentPlan|const installments=createInstallmentPlan/);
  assert.match(supabase,/normalizeCreditInstallments/);
  assert.match(supabase,/receivableReference}-parcela-/);
  assert.match(supabase,/parcela \$\{item\.number\}\/\$\{creditInstallments\.length\}/);
  assert.match(supabase,/wantedReferences/);
});
