import test from 'node:test';
import assert from 'node:assert/strict';
import{resolveSector,createSectorStorage,sectorRequestPath,sectorStorageKey}from'../src/sector-context.js';
import{weeklySettlementRows}from'../src/partner-weekly-settlement.js';
const owner='cortezgaragemecanica@gmail.com';
test('URL não concede acesso elétrico a Marcelino ou outro usuário',()=>{
 assert.equal(resolveSector('?sector=auto_eletrica',owner),'auto_eletrica');
 for(const email of ['marcelino@example.com','',owner+'.evil'])assert.equal(resolveSector('?sector=auto_eletrica',email),'mecanica');
 assert.equal(resolveSector('?sector=auto_eletrica','gust.ribas@gmail.com'),'auto_eletrica');
 assert.equal(resolveSector('',owner),'mecanica');
});
test('dois setores não compartilham O.S., estoque, rascunhos ou financeiro local',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const mechanical=createSectorStorage(storage,'mecanica'),electrical=createSectorStorage(storage,'auto_eletrica');
 for(const key of ['cortez-garage-v1','cortez-garage-pending-db-v1','cortez-garage-stock','cortez-garage-finance','cortez-garage-sync-v1']){
  mechanical.setItem(key,'mecânica');assert.equal(electrical.getItem(key),null);electrical.setItem(key,'elétrica');assert.equal(mechanical.getItem(key),'mecânica');electrical.removeItem(key);assert.equal(mechanical.getItem(key),'mecânica');
 }
 mechanical.setItem('cortez-garage-supabase-session-v1','sessão');assert.equal(electrical.getItem('cortez-garage-supabase-session-v1'),'sessão');
 assert.equal(sectorStorageKey('cortez-garage-device-id-v1','auto_eletrica'),'cortez-garage-device-id-v1');
});
test('todas as relações operacionais e RPCs elétricas são redirecionadas',()=>{
 for(const table of ['clientes','veiculos','ordens_servico','itens_os','estoque','agendamentos','lancamentos_financeiros','sincronizacao']){
  const path=`/rest/v1/${table}?select=*&id=eq.abc`;assert.equal(sectorRequestPath(path,'auto_eletrica'),`/rest/v1/ae_${table}?select=*&id=eq.abc`);assert.equal(sectorRequestPath(path,'mecanica'),path);
 }
 for(const rpc of ['finalizar_os_pronta','reabrir_os_pronta','estornar_os_entregue','sincronizar_conta_compras_os','owner_save_agendamento'])assert.equal(sectorRequestPath('/rest/v1/rpc/'+rpc,'auto_eletrica'),'/rest/v1/rpc/ae_'+rpc);
 assert.equal(sectorRequestPath('/auth/v1/token?grant_type=refresh_token','auto_eletrica'),'/auth/v1/token?grant_type=refresh_token');
 assert.throws(()=>sectorRequestPath('/rest/v1/nova_tabela?select=*','auto_eletrica'),/sem isolamento/);
 assert.throws(()=>sectorRequestPath('/rest/v1/rpc/rotina_nova','auto_eletrica'),/sem isolamento/);
});
test('acerto elétrico usa 45% de toda a base, mesmo com percentuais mecânicos salvos',()=>{
 const order={id:'ae',number:'1',total:1000,budget:{parts:[{description:'Peça',quantity:1,cost:100,value:400}],services:[{description:'Serviço',value:600,commissionRate:.5}]}},event={order,week:{start:'2026-11-02'},grossOrderValue:1000,orderValue:1000,laborCommission:300,partsCost:100};
 const[row]=weeklySettlementRows([event],'2026-11-02',new Map(),{sector:'auto_eletrica',rates:{Fabiano:1,Marcelino:99},partsRates:{Fabiano:2,Marcelino:98}});
 assert.equal(row.base,600);assert.equal(row.commissions.Fabiano,270);assert.equal(row.commissions.Marcelino,0);
 assert.deepEqual(row.rates,{Fabiano:45,Marcelino:0});assert.deepEqual(row.partsRates,{Fabiano:45,Marcelino:0});
 const[mechanical]=weeklySettlementRows([event],'2026-11-02');assert.equal(mechanical.commissions.Fabiano,150);assert.equal(mechanical.commissions.Marcelino,120);
});
