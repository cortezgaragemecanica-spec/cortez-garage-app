import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('function remainingFixedCommitments('),source.indexOf('function companyHealth('));
function remaining(records,paid=0,extra=[]){
  const context=vm.createContext({records,costPlanRows:()=>[{category:'Aluguel',difference:4000-paid},...extra],expenseKind:description=>/aluguel/i.test(description)?'Aluguel':'',payableForBalance:r=>r.category==='Conta a pagar'&&r.status!=='Realizado'&&Boolean(r.dueDate)&&r.dueDate<='2026-09-25'});
  return vm.runInContext(functionSource+'remainingFixedCommitments("2026-09")',context);
}
const rent=(amount=4000,dueDate='2026-09-10')=>({category:'Conta a pagar',status:'Pendente',description:'Aluguel da oficina',amount,dueDate});
test('aluguel contado nas contas a pagar não é repetido no custo previsto',()=>{
  assert.equal(remaining([rent()])[0].difference,0);
  assert.equal(remaining([rent(2500)])[0].difference,1500);
  assert.equal(remaining([rent(5000)])[0].difference,0);
});
test('pagamento parcial e parcelas abertas são considerados uma vez',()=>{
  assert.equal(remaining([rent(2500)],1500)[0].difference,0);
  assert.equal(remaining([rent(2000),rent(2000)])[0].difference,0);
});
test('contas de outro mês ou fora do balanço não retiram a previsão atual',()=>{
  for(const record of [rent(4000,'2026-08-10'),rent(4000,'2026-10-10'),rent(4000,'2026-09-30'),{...rent(),status:'Realizado'},{...rent(),category:'Conta a receber'},rent(4000,'')])assert.equal(remaining([record])[0].difference,4000);
  assert.equal(remaining([])[0].difference,4000);
});
test('custos pagos não geram valores negativos nem escondem outras obrigações',()=>{
  const rows=remaining([],4500,[{category:'Luz',difference:250}]);
  assert.equal(rows[0].difference,0);
  assert.equal(rows[1].difference,250);
});
test('resumo e detalhamento usam o mesmo cálculo sem duplicidade',()=>{
  assert.match(source,/plan=remainingFixedCommitments\(month\),remainingFixed=plan.reduce/);
  assert.match(source,/rows=remainingFixedCommitments\(month\).filter/);
});
