import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('function commitmentWindowEnd('),source.indexOf('function companyHealth('));
function remaining(records,paid=0,extra=[],value='2026-09-25',month='2026-09'){
  const localDateOnly=input=>{if(!(input instanceof Date))return String(input).slice(0,10);const year=input.getFullYear(),month=String(input.getMonth()+1).padStart(2,'0'),day=String(input.getDate()).padStart(2,'0');return`${year}-${month}-${day}`},context=vm.createContext({records,Date,localDateOnly,FIRST_HALF_FIXED_COSTS:new Set(['Advogado','Contador','Impostos','Luz','Água','Funcionário fixo','Ferramentas']),costPlanRows:()=>[{category:'Aluguel',difference:4000-paid},...extra],expenseKind:description=>/aluguel/i.test(description)?'Aluguel':''});
  return vm.runInContext(functionSource+`remainingFixedCommitments("${month}","${value}")`,context);
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
test('contas de outro mês ou fora da janela não retiram a previsão atual',()=>{
  for(const record of [rent(4000,'2026-08-10'),rent(4000,'2026-10-10'),{...rent(),status:'Realizado'},{...rent(),category:'Conta a receber'},rent(4000,'')])assert.equal(remaining([record])[0].difference,4000);
  assert.equal(remaining([rent(4000,'2026-09-30')],0,[],'2026-09-10')[0].fullDifference,4000);
  assert.equal(remaining([])[0].difference,4000);
});
test('custos pagos não geram valores negativos nem escondem outras obrigações',()=>{
  const rows=remaining([],4500,[{category:'Luz',difference:250}]);
  assert.equal(rows[0].difference,0);
  assert.equal(rows[1].difference,250);
});
test('resumo e detalhamento usam o mesmo cálculo sem duplicidade',()=>{
  assert.match(source,/plan=remainingFixedCommitments\(month,today\),remainingFixed=plan.reduce/);
  assert.match(source,/rows=remainingFixedCommitments\(month,today\).filter/);
  assert.match(source,/commitments=Math\.max\(0,payable\)\+Math\.max\(0,total\.commissions\)\+remainingFixed,coverage=/);
  assert.doesNotMatch(source,/\['retifica','Saldo devedor da Retífica',health.retifica\]/);
  assert.match(source,/mechanicCommissions:Math\.max\(0,total\.mechanicCommissions\)/);
  assert.match(source,/partnerCommissions:Math\.max\(0,total\.partnerCommissions\)/);
});
test('custos fixos são separados nas quinzenas definidas',()=>{
  const firstCategories=['Advogado','Contador','Impostos','Luz','Água','Funcionário fixo','Ferramentas'],secondCategories=['Internet','Segurança','Software','Combustível','Manutenção'],extra=[...firstCategories,...secondCategories].map(category=>({category,difference:100})),firstHalf=remaining([],0,extra,'2026-10-10','2026-10'),secondHalf=remaining([],0,extra,'2026-10-16','2026-10');
  for(const category of firstCategories){
    assert.ok(firstHalf.find(item=>item.category===category).difference>0);
    assert.equal(firstHalf.find(item=>item.category===category).dueDate,'2026-10-01');
  }
  for(const category of ['Aluguel',...secondCategories]){
    assert.equal(firstHalf.find(item=>item.category===category).difference,0);
    assert.equal(firstHalf.find(item=>item.category===category).dueDate,'2026-10-16');
    assert.ok(secondHalf.find(item=>item.category===category).difference>0);
  }
});

test('compromissos incluem vencidas e contas até quarta-feira da semana seguinte',()=>{
  const localDateOnly=input=>{if(!(input instanceof Date))return String(input).slice(0,10);return`${input.getFullYear()}-${String(input.getMonth()+1).padStart(2,'0')}-${String(input.getDate()).padStart(2,'0')}`},context=vm.createContext({Date,localDateOnly}),payable=vm.runInContext(functionSource+';payableForCommitments',context),record=dueDate=>({category:'Conta a pagar',status:'Pendente',dueDate});
  assert.equal(payable(record('2026-10-01'),'2026-10-30'),true);
  assert.equal(payable(record('2026-11-04'),'2026-10-30'),true);
  assert.equal(payable(record('2026-11-05'),'2026-10-30'),false);
  assert.equal(payable({...record('2026-11-04'),status:'Realizado'},'2026-10-30'),false);
});
