import test from'node:test';
import assert from'node:assert/strict';
import{orderSectors,projectOrderForSector,mergeSectorOrders,mixedOrder}from'../src/sector-order-data.js';
import{isSectorOperator,maySwitchSector,resolveSector,matchesDisplayedOrder}from'../src/sector-context.js';
import{rememberSector,routeSector,sourceSector}from'../src/sector-routing.js';
const order={id:'shared',number:'205',sourceSector:'mecanica',sector:'mista',total:1100,discount:0,advance:100,advances:[{id:'advance',amount:100}],closingReceipt:{total:1100,advance:100,receivedNow:1000,netReceived:973,cardFeeAmount:27},budget:{parts:[{description:'Peça mecânica',quantity:1,value:100,cost:50,sector:'mecanica'},{description:'Peça elétrica',quantity:1,value:200,cost:100,sector:'auto_eletrica'}],services:[{description:'Freio',mechanic:'Tony',value:300,commissionRate:.5,sector:'mecanica'},{description:'Alternador',mechanic:'Gustavo',value:400,commissionRate:.5,sector:'auto_eletrica'}]}};
test('mesma O.S. contém serviços dos dois setores e mantém o total do cliente',()=>{
 assert.equal(mixedOrder(order),true);assert.deepEqual(orderSectors(order),['mecanica','auto_eletrica']);
 const m=projectOrderForSector(order,'mecanica'),e=projectOrderForSector(order,'auto_eletrica');
 assert.equal(m.total,440);assert.equal(e.total,660);assert.equal(m.total+e.total,order.total);
 assert.equal(m.labor,300);assert.equal(e.labor,400);assert.equal(m.advance+e.advance,100);
 assert.equal(m.budget.services.length,1);assert.equal(e.budget.services.length,1);assert.equal(e.budget.services[0].originalIndex,1);
 assert.equal(m.closingReceipt.netReceived+e.closingReceipt.netReceived,973);
 assert.equal(order.budget.services.length,2);assert.equal(order.total,1100);
});
test('consolidação não duplica a O.S. nem troca serviços entre setores',()=>{
 const electrical={...projectOrderForSector(order,'auto_eletrica'),projectionOnly:true};
 assert.deepEqual(mergeSectorOrders([[electrical],[order]]),[order]);assert.deepEqual(mergeSectorOrders([[order],[electrical]]),[order]);
 assert.equal(projectOrderForSector({id:'pure',sourceSector:'mecanica',total:100,labor:100},'auto_eletrica'),null);
});
test('permissões operacionais são reconhecidas nos dois setores e Marcelino é excluído',()=>{
 assert.equal(isSectorOperator('tony@example.com',{agendaMechanic:'Tony',active:true}),true);
 assert.equal(isSectorOperator('fabiomaier19850901@gmail.com'),true);
 assert.equal(isSectorOperator('marcelino@example.com',{name:'Marcelino',agendaMechanic:'Tony'}),false);
 assert.equal(isSectorOperator('gust.ribas@gmail.com',{active:false}),false);
 assert.equal(maySwitchSector('gust.ribas@gmail.com'),true);assert.equal(maySwitchSector('tony@example.com',{agendaMechanic:'Tony'}),false);
 assert.equal(resolveSector('','gust.ribas@gmail.com'),'mecanica');
});
test('operações concorrentes mantêm a origem por ID, independentemente do setor da tela',()=>{
 rememberSector('ordens_servico',[{id:'m'}],'mecanica');rememberSector('ordens_servico',[{id:'e'}],'auto_eletrica');
 assert.equal(routeSector('/rest/v1/ordens_servico?id=eq.e&select=*'),'auto_eletrica');assert.equal(routeSector('/rest/v1/ordens_servico?id=eq.m&select=*'),'mecanica');
 assert.equal(routeSector('/rest/v1/rpc/finalizar_os_pronta',{p_order_id:'e'}),'auto_eletrica');
 rememberSector('ordens_servico',[{id:'m',dados_extras:{projectionOnly:true}}],'auto_eletrica');assert.equal(sourceSector('m'),'mecanica');
 assert.equal(routeSector('/rest/v1/sincronizacao?registro_id=eq.usuarios-permissoes&select=*'),'mecanica');
});
