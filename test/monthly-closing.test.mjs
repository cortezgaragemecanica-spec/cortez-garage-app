import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{summarizeMonthlyClosing}from'../src/monthly-closing.js';

const current={id:'os-1',number:'0100',status:'Entregue',deliveredAt:'2026-09-20T15:00:00Z',created:'2026-09-02T10:00:00Z',updatedAt:'2026-09-20T15:00:00Z',total:1000,partsValue:400,labor:600,client:{id:'client-1',name:'Cliente novo'},mechanic:'Gustavo',budget:{services:[{description:'Serviço',value:600,mechanic:'Gustavo',commissionRate:.5}]}};
const previous={id:'os-2',number:'0099',status:'Entregue',deliveredAt:'2026-08-20T15:00:00Z',created:'2026-08-02T10:00:00Z',updatedAt:'2026-08-20T15:00:00Z',total:500,partsValue:100,labor:400,client:{id:'client-2',name:'Cliente antigo'},mechanic:'Fabio',budget:{services:[]}};

test('fechamento mensal consolida operação, lucros, pessoas e fornecedores',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',orders:[current,previous],records:[{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-22',reference:'pagamento-conta-123',amount:100}],suppliers:{luizinho:[{date:'2026-09-10',amount:300}],luizinhoReturns:[{date:'2026-09-11',amount:50}],retifica:[{date:'2026-09-12',debit:200}]},partnerNames:['Fabiano','Marcelino'],profitEvents:[{date:'2026-09-20',order:current,record:{paymentType:'Pix BB'},orderValue:1000,partsCost:200,laborCommission:300,fabiano:125,marcelino:100}],orderProfits:[{order:current,orderValue:1000,partsCost:200,laborCommission:300,real:500,fabiano:125,marcelino:100,net:125}]});
  assert.equal(result.deliveredCount,1);
  assert.equal(result.newClients,1);
  assert.equal(result.ticketAverage,1000);
  assert.equal(result.billed,1000);
  assert.equal(result.received,1000);
  assert.equal(result.partsProfit,200);
  assert.equal(result.laborProfit,300);
  assert.equal(result.totalProfit,500);
  assert.equal(result.netProfit,125);
  assert.equal(result.paidAccounts,100);
  assert.equal(result.purchasesTotal,500);
  assert.equal(result.growth,100);
  assert.deepEqual(result.mechanics,[{name:'Gustavo',production:600,billing:1000,profit:500,commission:300,carCount:1,ticketAverage:1000}]);
  assert.deepEqual(result.partners,[{name:'Fabiano',commission:125},{name:'Marcelino',commission:100}]);
  assert.deepEqual(result.paymentTypes,[{name:'Pix BB',amount:1000}]);
  assert.deepEqual(result.purchases,[{name:'Luizinho',amount:300,credits:50},{name:'Retífica',amount:200,credits:0}]);
});

test('painel fica oculto até o clique no botão e permite trocar o mês',async()=>{
  const[admin,index,style]=await Promise.all(['../src/admin.js','../index.html','../src/monthly-closing.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(admin,/id="monthlyClosing"/);
  assert.match(admin,/function openMonthlyClosing\(\)/);
  assert.match(admin,/monthly-closing-month/);
  for(const label of['O.S. entregues','Clientes novos','Ticket médio','Valor total faturado','Lucro total','Lucro líquido','Carros executados','Faturamento','Lucro','Compras por fornecedor','Lucro nas peças','Lucro na mão de obra','Comissões dos sócios','Pagamentos recebidos'])assert.ok(admin.includes(label));
  assert.match(index,/monthly-closing\.css\?v=20260924-2/);
  assert.match(index,/admin\.js\?v=20260924-6/);
  assert.match(style,/monthly-closing-popup/);
});

test('fechamento ignora carros não entregues no mês e rateia os resultados por mecânico',()=>{
  const delivered={id:'os-rateio',status:'Entregue',deliveredAt:'2026-09-28T12:00:00Z',created:'2026-09-03',total:1200,partsValue:200,labor:1000,client:{id:'cliente-rateio'},budget:{services:[{value:400,mechanic:'Gustavo',commissionRate:.5},{value:200,mechanic:'Gustavo',commissionRate:.5},{value:400,mechanic:'Fabio',commissionRate:.5}]}},open={id:'os-aberta',status:'Em andamento',created:'2026-09-04',total:900,client:{id:'cliente-aberto'},budget:{services:[{value:900,mechanic:'Outro'}]}};
  const result=summarizeMonthlyClosing({month:'2026-09',orders:[delivered,open,previous],orderProfits:[{order:delivered,orderValue:1200,partsCost:100,laborCommission:500,real:600,net:300}],profitEvents:[{date:'2026-10-01',order:delivered,record:{paymentType:'Cartão'},orderValue:1200},{date:'2026-09-10',order:open,record:{paymentType:'Pix'},orderValue:900}]});
  assert.equal(result.deliveredCount,1);
  assert.equal(result.billed,1200);
  assert.equal(result.received,1200);
  assert.equal(result.totalProfit,600);
  assert.equal(result.netProfit,300);
  assert.deepEqual(result.mechanics,[{name:'Gustavo',production:600,billing:720,profit:360,commission:300,carCount:1,ticketAverage:720},{name:'Fabio',production:400,billing:480,profit:240,commission:200,carCount:1,ticketAverage:480}]);
  assert.deepEqual(result.paymentTypes,[{name:'Cartão',amount:1200}]);
});

test('compra sem fornecedor explícito não transforma veículo em nome de fornecedor',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',records:[{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-20',description:'Compra de peças Outlander ASX',amount:250},{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-21',description:'Compra de peças — New Parts',amount:100}]});
  assert.deepEqual(result.purchases,[{name:'Fornecedor não informado',amount:250,credits:0},{name:'New Parts',amount:100,credits:0}]);
});

