import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {sectorsUnified,UNIFICATION_DATE,RESERVE_ACCOUNT,combineFinance,includeElectricalMovement} from '../src/sector-unification.js';
import {suggestedItemSector} from '../src/sector-suggestions.js';
import {resolveSector,maySwitchSector} from '../src/sector-context.js';
import {rememberSector,routeSector} from '../src/sector-routing.js';
import {projectOrderForSector} from '../src/sector-order-data.js';
const admin=readFileSync(new URL('../src/admin.js',import.meta.url),'utf8');

test('vigência começa à meia-noite de 26/11 em São Paulo',()=>{
 assert.equal(UNIFICATION_DATE,'2026-11-26');
 assert.equal(sectorsUnified('2026-11-26T02:59:59Z'),false);
 assert.equal(sectorsUnified('2026-11-26T03:00:00Z'),true);
 assert.equal(sectorsUnified('2026-11-25'),false);
 assert.equal(sectorsUnified('2026-11-26'),true);
 assert.equal(sectorsUnified('inválida'),false);
});
test('URLs antigas não reativam setor e novas peças elétricas seguem operação única',()=>{
 for(const email of ['cortezgaragemecanica@gmail.com','gust.ribas@gmail.com','marcelinocortez2910@gmail.com']){
  assert.equal(resolveSector('?sector=auto_eletrica',email),'mecanica');assert.equal(maySwitchSector(email),false);
 }
 for(const description of ['Alternador','Lâmpada H7','Mão de obra elétrica'])assert.equal(suggestedItemSector({description},{created:'2026-11-26'}),'mecanica');
 assert.equal(suggestedItemSector({description:'Alternador'},{created:'2026-11-25'}),'auto_eletrica');
 // A origem física de um estoque legado não pode apontar para outra tabela.
 assert.equal(suggestedItemSector({stockId:'ae-stock',sector:'auto_eletrica'},{created:'2026-11-26'}),'auto_eletrica');
});
test('unificação financeira inclui só movimentos a partir da vigência sem duplicar nem modificar o histórico',()=>{
 const old=Object.freeze({id:'old',category:'Fluxo de caixa',dueDate:'2026-11-25',amount:400}),today=Object.freeze({id:'today',category:'Fluxo de caixa',dueDate:'2026-11-26',amount:100});
 const main=Object.freeze([Object.freeze({id:'main',amount:200})]),ae=Object.freeze([old,today]);
 const before=JSON.stringify({main,ae}),rows=combineFinance(main,ae);
 assert.equal(rows.reduce((sum,r)=>sum+r.amount,0),300);assert.deepEqual(rows.map(r=>r.id),['main','today']);
 assert.equal(JSON.stringify({main,ae}),before);
 assert.equal(combineFinance(rows,ae).length,2);
 assert.equal(includeElectricalMovement({categoria:'Conta a pagar',vencimento:'2026-12-01',criado_em:'2026-11-25T12:00:00Z'}),false);
 assert.equal(includeElectricalMovement({categoria:'Conta a pagar',vencimento:'2026-12-01',criado_em:'2026-11-26T12:00:00Z'}),true);
 assert.equal(includeElectricalMovement({categoria:'Comissões',vencimento:'2026-10-31',criado_em:'2026-11-26T12:00:00Z'}),false);
});
test('operações antigas continuam na origem e novos lançamentos usam principal',()=>{
 rememberSector('ordens_servico',[{id:'legacy-order'}],'auto_eletrica');
 assert.equal(routeSector('/rest/v1/rpc/finalizar_os_pronta',{p_order_id:'legacy-order'}),'auto_eletrica');
 assert.equal(routeSector('/rest/v1/ordens_servico',{}),'mecanica');
 assert.equal(routeSector('/rest/v1/lancamentos_financeiros',{categoria:'Fluxo de caixa'}),'mecanica');
});
test('valor histórico misto mantém projeção anterior e recebimento novo usa total inteiro',()=>{
 const order={id:'mixed',number:'0001',sector:'mista',total:300,budget:{parts:[{description:'Lâmpada',sector:'auto_eletrica',value:100,quantity:1}],services:[{description:'Freio',sector:'mecanica',value:200}]}};
 const before=JSON.stringify(order),source=admin.split('\n').find(line=>line.startsWith('function financeOrder('));
 const context=vm.createContext({sectorsUnified,projectOrderForSector,ACTIVE_SECTOR:'mecanica',localOrders:()=>[order]});vm.runInContext(source,context);
 assert.equal(vm.runInContext("financeOrder({orderId:'mixed',dueDate:'2026-11-25'}).total",context),200);
 assert.equal(vm.runInContext("financeOrder({orderId:'mixed',dueDate:'2026-11-26'}).total",context),300);
 assert.equal(JSON.stringify(order),before);
});
test('reserva Nubank tem saldo próprio e não é classificada como dinheiro',()=>{
 const source=admin.split('\n').find(line=>line.startsWith('const cashAccount=')),balance=admin.split('\n').find(line=>line.startsWith('const cashBalance='));
 const records=[{category:'Fluxo de caixa',status:'Realizado',paymentType:RESERVE_ACCOUNT,kind:'Entrada',amount:1100},{category:'Fluxo de caixa',status:'Realizado',paymentType:RESERVE_ACCOUNT,kind:'Saída',amount:100},{category:'Fluxo de caixa',status:'Realizado',paymentType:'Dinheiro',kind:'Entrada',amount:50}];
 const context=vm.createContext({RESERVE_ACCOUNT,records});vm.runInContext(source+';'+balance,context);
 assert.equal(vm.runInContext('cashBalance(RESERVE_ACCOUNT)',context),1000);
 assert.equal(vm.runInContext("cashBalance('Dinheiro')",context),50);
 assert.match(admin,/ALL_CASH_ACCOUNTS\.map\(name=>`<button data-cash-account/);
 assert.match(admin,/<select id="financePopupAccount">\$\{ALL_CASH_ACCOUNTS/);
});
test('consulta elétrica não executa rotinas que modificam dados',()=>{
 const api=readFileSync(new URL('../src/supabase.js',import.meta.url),'utf8').split('export async function readElectricalArchive()')[1];
 assert.match(api,/currentEmail\(\)!==OWNER_EMAIL/);
 assert.doesNotMatch(api,/method:\s*'(POST|PATCH|DELETE)'|reconcile|writeDatabase/);
 const switcher=readFileSync(new URL('../src/sector-switcher.js',import.meta.url),'utf8');
 assert.match(switcher,/Histórico da auto elétrica/);assert.match(switcher,/button\.onclick=openElectricalArchive/);
});
