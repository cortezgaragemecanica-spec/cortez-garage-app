import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('const EXPENSE_RULES='),source.indexOf('function openCostPlanDetails('));
const payment=(amount=250,extra={})=>({category:'Fluxo de caixa',status:'Realizado',kind:'Saída',description:'Pagamento conta de luz',dueDate:'2026-09-10',amount,...extra});
function row(records,paid){
 const context=vm.createContext({records,costPlans:paid===undefined?[]:[{month:'2026-09',category:'Luz',planned:250,paid}],activeCostMonth:'2026-09'});
 return vm.runInContext(code+`;({row:costPlanRows().find(item=>item.category==='Luz'),entries:costPlanEntries('Luz')})`,context);
}
test('luz identificada abate o plano mesmo com zero salvo',()=>{
 const result=row([payment()],0);
 assert.equal(result.row.paid,250);
 assert.equal(result.row.difference,0);
 assert.equal(result.row.percent,100);
 assert.equal(result.entries.length,1);
});
test('pagamentos posteriores atualizam o total salvo sem duplicar',()=>{
 assert.equal(row([payment(100),payment(150)],100).row.paid,250);
 assert.equal(row([payment()],250).row.paid,250);
});
test('preserva total manual maior e usa caixa quando não há total manual',()=>{
 assert.equal(row([payment(100)],250).row.paid,250);
 assert.equal(row([],250).row.paid,250);
 assert.equal(row([payment()]).row.paid,250);
});
test('detalhe e cálculo usam data de criação quando não há vencimento',()=>{
 const result=row([payment(250,{dueDate:'',createdAt:'2026-09-12T12:00:00Z'})],0);
 assert.equal(result.row.paid,250);
 assert.equal(result.entries.length,1);
});
test('ignora entradas, pendências e pagamentos de outro mês',()=>{
 const result=row([payment(250,{kind:'Entrada'}),payment(250,{status:'Pendente'}),payment(250,{dueDate:'2026-08-10'}),payment(250,{category:'Conta a pagar'})],0);
 assert.equal(result.row.paid,0);
 assert.equal(result.entries.length,0);
});
