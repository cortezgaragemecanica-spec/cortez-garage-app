import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateSectorAmount,canViewSector,commissionPaymentsBySector,partnerSectorCommissions,sectorCashBalances,sectorOf,splitOrderSectors} from '../src/business-sectors.js';
test('histórico permanece sem classificação e não entra em caixa de setor',()=>{
 assert.equal(sectorOf({}),'nao_classificado');
 assert.throws(()=>splitOrderSectors({total:100}),/Classifique/);
 assert.deepEqual(sectorCashBalances([{category:'Fluxo de caixa',kind:'Entrada',status:'Realizado',amount:100}]),{mecanica:0,auto_eletrica:0,nao_classificado:100});
});
test('Auto elétrica gera somente 45% para Fabiano, independentemente das taxas mecânicas',()=>{
 assert.deepEqual(partnerSectorCommissions('auto_eletrica',1000,{Fabiano:25,Marcelino:20}),{Fabiano:450,Marcelino:0});
 assert.deepEqual(partnerSectorCommissions('mecanica',1000),{Fabiano:250,Marcelino:200});
});
test('pagamento consolida por pessoa e setor sem misturar caixas',()=>{
 const records=[{id:'1',sector:'mecanica',mechanic:'Tony',amount:50},{id:'2',sector:'auto_eletrica',mechanic:'Tony',amount:30},{id:'3',sector:'mecanica',mechanic:'Tony',amount:25}];
 const groups=commissionPaymentsBySector(records);
 assert.equal(groups.length,2);assert.equal(groups[0].amount,75);assert.equal(groups[1].amount,30);
 assert.throws(()=>commissionPaymentsBySector([...records,records[0]]),/duplicada/);
 assert.throws(()=>commissionPaymentsBySector([{id:'4',sector:'auto_eletrica',mechanic:'Marcelino',amount:5}]),/Marcelino/);
});
test('divisão de recebimentos preserva todos os centavos',()=>{
 const values=allocateSectorAmount(100.01,{mecanica:50,auto_eletrica:50});
 assert.equal(Math.round((values.mecanica+values.auto_eletrica)*100),10001);
 assert.throws(()=>allocateSectorAmount(100,{mecanica:0,auto_eletrica:0}),/sem valores/);
});
test('O.S. mista exige setor em cada item e separa venda, custo e mão de obra',()=>{
 const order={sector:'mista',total:330,budget:{parts:[{description:'Peça',sector:'mecanica',quantity:2,cost:20,value:50}],services:[{description:'Elétrica',sector:'auto_eletrica',value:200,commissionRate:.5}]}};
 const rows=splitOrderSectors(order);
 assert.equal(rows.mecanica.total,110);assert.equal(rows.mecanica.partsCost,40);
 assert.equal(rows.auto_eletrica.total,220);assert.equal(rows.auto_eletrica.mechanicCommissions,100);
 delete order.budget.services[0].sector;assert.throws(()=>splitOrderSectors(order),/Escolha/);
});
test('acesso à Auto elétrica fica restrito ao proprietário',()=>{
 assert.equal(canViewSector('auto_eletrica','marcelino@example.com'),false);
 assert.equal(canViewSector('mecanica','marcelino@example.com'),true);
 assert.equal(canViewSector('auto_eletrica','cortezgaragemecanica@gmail.com'),true);
});
