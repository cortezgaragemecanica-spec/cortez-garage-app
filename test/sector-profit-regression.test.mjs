import test from'node:test';
import assert from'node:assert/strict';
import vm from'node:vm';
import{readFile}from'node:fs/promises';
const admin=await readFile(new URL('../src/admin.js',import.meta.url),'utf8'),reports=await readFile(new URL('../src/reports.js',import.meta.url),'utf8');
const line=(source,name)=>source.split('\n').find(row=>row.startsWith('function '+name+'('));
test('lançar comissão de sócio não reduz novamente a base como custo do mecânico',()=>{
 const order={id:'ae-os',number:'0001',labor:200},records=[{orderId:order.id,category:'Comissões',amount:100,reference:'comissao-os-servico-1'},{orderId:order.id,category:'Comissões',amount:45,reference:'partner-weekly-v2-fabiano-week-ae-os'}];
 const context=vm.createContext({order,records,finance:records,localOrders:()=>[order]});
 vm.runInContext(line(admin,'financeOrder')+';'+line(admin,'orderLaborCommission')+';'+line(reports,'orderCommission'),context);
 assert.equal(vm.runInContext('orderLaborCommission(order)',context),100);
 assert.equal(vm.runInContext('orderCommission(order)',context),100);
 records[1].status='Realizado';
 assert.equal(vm.runInContext('orderLaborCommission(order)',context),100);
});
test('transferência com número de O.S. na descrição não vira receita da O.S.',()=>{
 const order={id:'os',number:'0001'},record={reference:'transferencia-setor-id',description:'Transferência para O.S. #0001'},context=vm.createContext({order,record,localOrders:()=>[order]});
 vm.runInContext(line(admin,'financeOrder')+';'+line(reports,'commissionOrder'),context);
 assert.equal(vm.runInContext('financeOrder(record)',context),null);
 assert.equal(vm.runInContext('commissionOrder({orders:[order]},record)',context),null);
});
