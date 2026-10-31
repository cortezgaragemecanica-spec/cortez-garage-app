import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{financialRecoveryRows,financialRecoveryTotals,financialRecoveryBalances,financialRecoveryProfit,normalizeFinancialRecoveryConfig,isRetificaPart}from'../src/financial-recovery.js';

const delivered={id:'os-1',number:'0140',status:'Entregue',deliveredAt:'2026-10-20T12:00:00Z',client:{name:'Cliente'},vehicle:{plate:'ABC1D23',model:'Carro'},budget:{parts:[
  {description:'Filtro de óleo',supplier:'Luizinho',quantity:2,cost:20,value:35},
  {description:'Junta do motor',supplier:'Luizinho',quantity:1,cost:50,value:90},
  {description:'Plaina cabeçote',supplier:'Retífica Central',quantity:1,cost:180,value:300},
  {description:'Serviço de RETÍFICA do bloco',supplier:'Outro',quantity:1,cost:200,value:350},
  {description:'Peça recusada',supplier:'Luizinho',quantity:1,cost:10,value:30,refused:true},
  {description:'Parafuso',quantity:1,cost:2,value:5}
]}};

test('identifica itens de retífica pelas descrições solicitadas',()=>{
  assert.equal(isRetificaPart({description:'Plaina cabeçote'}),true);
  assert.equal(isRetificaPart({description:'Plaina de Cabeçote'}),true);
  assert.equal(isRetificaPart({description:'Serviço de retífica completa'}),true);
  assert.equal(isRetificaPart({description:'Junta do cabeçote'}),false);
});

test('separa cada O.S. por fornecedor e mantém retífica em caixa próprio',()=>{
  const rows=financialRecoveryRows([delivered,{...delivered,id:'os-2',status:'Em andamento'}],'2026-10');
  assert.equal(rows.length,3);
  const luizinho=rows.find(row=>row.supplier==='Luizinho'),unknown=rows.find(row=>row.supplier==='Fornecedor não identificado'),retifica=rows.find(row=>row.type==='retifica');
  assert.deepEqual({cost:luizinho.cost,sale:luizinho.sale,profit:luizinho.profit},{cost:90,sale:160,profit:70});
  assert.deepEqual({cost:unknown.cost,sale:unknown.sale,profit:unknown.profit},{cost:2,sale:5,profit:3});
  assert.deepEqual({supplier:retifica.supplier,cost:retifica.cost,sale:retifica.sale,profit:retifica.profit},{supplier:'Retífica',cost:380,sale:650,profit:270});
  assert.deepEqual(financialRecoveryTotals(rows),{parts:{cost:92,sale:165,profit:73},retifica:{cost:380,sale:650,profit:270}});
  assert.equal(financialRecoveryRows([delivered],'2026-09').length,0);
});

test('data inicial filtra as O.S. e saídas reduzem somente o caixa escolhido',()=>{
  const older={...delivered,id:'os-antiga',deliveredAt:'2026-10-10T12:00:00Z'},rows=financialRecoveryRows([older,delivered],{startDate:'2026-10-15'}),totals=financialRecoveryTotals(rows),config=normalizeFinancialRecoveryConfig({startDate:'2026-10-15',commissionIntegration:true,withdrawals:[{id:'withdraw-1',type:'parts',date:'2026-10-20',description:'Compra de ferramenta',amount:20}]});
  assert.equal(rows.every(row=>row.order.id==='os-1'),true);
  assert.deepEqual(financialRecoveryBalances(totals,config),{parts:{generated:73,withdrawn:20,balance:53},retifica:{generated:270,withdrawn:0,balance:270}});
  assert.deepEqual(financialRecoveryProfit(delivered),{parts:73,retifica:270,total:343});
});

test('interface de recuperação financeira é exclusiva do proprietário',async()=>{
  const [admin,worker,help]=await Promise.all(['../src/admin.js','../public/sw.js','../src/help.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(admin,/recoveryButton=financeOwner\(\)\?'<button data-finance-area="Recuperação financeira"/);
  assert.match(admin,/\['Acerto semanal','Recuperação financeira'\]\.includes\(area\)&&!financeOwner\(\)/);
  for(const label of['Caixa de peças','Caixa da retífica','Peças por O.S. e fornecedor','Itens de retífica'])assert.ok(admin.includes(label));
  for(const label of['Data de início','Implementar nas comissões','Cancelar implementação nas comissões','Registrar saída','Saídas dos caixas'])assert.ok(admin.includes(label));
  assert.match(admin,/saveFinancialRecoveryConfig/);
  assert.match(admin,/commissionIntegration:financialRecoveryConfig\.commissionIntegration/);
  assert.match(admin,/id="cancelRecoveryCommissionIntegration"/);
  assert.match(admin,/commissionIntegration:false/);
  assert.match(admin,/Comissões já lançadas ou pagas não serão alteradas/);
  assert.match(worker,/financial-recovery\.js\?v=20261020-2/);
  assert.match(help,/Recuperação financeira:<\/b> área exclusiva do proprietário/);
});
