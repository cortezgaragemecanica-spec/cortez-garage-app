import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{summarizeMonthlyClosing}from'../src/monthly-closing.js';

const current={id:'os-1',number:'0100',status:'Entregue',deliveredAt:'2026-09-20T15:00:00Z',created:'2026-09-02T10:00:00Z',updatedAt:'2026-09-20T15:00:00Z',total:1000,partsValue:400,labor:600,client:{id:'client-1',name:'Cliente novo'},mechanic:'Gustavo',budget:{services:[{description:'Serviço',value:600,mechanic:'Gustavo',commissionRate:.5}]}};
const previous={id:'os-2',number:'0099',status:'Entregue',deliveredAt:'2026-08-20T15:00:00Z',created:'2026-08-02T10:00:00Z',updatedAt:'2026-08-20T15:00:00Z',total:500,partsValue:100,labor:400,client:{id:'client-2',name:'Cliente antigo'},mechanic:'Fabio',budget:{services:[]}};

test('fechamento mensal consolida operação, lucros, pessoas e fornecedores',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',orders:[current,previous],records:[{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-22',reference:'pagamento-conta-123',amount:100}],suppliers:{luizinho:[{date:'2026-09-10',amount:300}],luizinhoReturns:[{date:'2026-09-11',amount:50}],retifica:[{date:'2026-09-12',debit:200}]},partnerNames:['Fabiano','Marcelino'],profitEvents:[{date:'2026-09-20',order:current,record:{paymentType:'Pix BB'},orderValue:1000,partsCost:200,laborCommission:300,fabiano:125,marcelino:100}]});
  assert.equal(result.deliveredCount,1);
  assert.equal(result.newClients,1);
  assert.equal(result.ticketAverage,1000);
  assert.equal(result.billed,1000);
  assert.equal(result.received,1000);
  assert.equal(result.partsProfit,200);
  assert.equal(result.laborProfit,300);
  assert.equal(result.paidAccounts,100);
  assert.equal(result.purchasesTotal,500);
  assert.equal(result.growth,100);
  assert.deepEqual(result.mechanics,[{name:'Gustavo',production:600,commission:300}]);
  assert.deepEqual(result.partners,[{name:'Fabiano',commission:125},{name:'Marcelino',commission:100}]);
  assert.deepEqual(result.paymentTypes,[{name:'Pix BB',amount:1000}]);
  assert.deepEqual(result.purchases,[{name:'Luizinho',amount:300,credits:50},{name:'Retífica',amount:200,credits:0}]);
});

test('painel fica oculto até o clique no botão e permite trocar o mês',async()=>{
  const[admin,index,style]=await Promise.all(['../src/admin.js','../index.html','../src/monthly-closing.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(admin,/id="monthlyClosing"/);
  assert.match(admin,/function openMonthlyClosing\(\)/);
  assert.match(admin,/monthly-closing-month/);
  for(const label of['O.S. entregues','Clientes novos','Ticket médio','Valor total faturado','Compras por fornecedor','Lucro recebido nas peças','Lucro recebido na mão de obra','Comissões dos sócios','Pagamentos recebidos'])assert.ok(admin.includes(label));
  assert.match(index,/monthly-closing\.css\?v=20260924-1/);
  assert.match(index,/admin\.js\?v=20260924-5/);
  assert.match(style,/monthly-closing-popup/);
});

test('compra sem fornecedor explícito não transforma veículo em nome de fornecedor',()=>{
  const result=summarizeMonthlyClosing({month:'2026-09',records:[{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-20',description:'Compra de peças Outlander ASX',amount:250},{category:'Fluxo de caixa',kind:'Saída',status:'Realizado',dueDate:'2026-09-21',description:'Compra de peças — New Parts',amount:100}]});
  assert.deepEqual(result.purchases,[{name:'Fornecedor não informado',amount:250,credits:0},{name:'New Parts',amount:100,credits:0}]);
});

