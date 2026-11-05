import test from'node:test';
import assert from'node:assert/strict';
const id='11111111-1111-4111-8111-111111111111';
const order={id,number:'0205',sector:'mista',sectorMaster:true,sourceSector:'mecanica',client:{name:'Cliente'},vehicle:{plate:'TESTE'},status:'Pronto para entrega',payment:'Cartão de crédito',labor:700,partsValue:300,total:1100,advance:100,advances:[{id:'advance',amount:100}],budget:{parts:[{description:'Peça M',quantity:1,value:100,cost:50,sector:'mecanica'},{description:'Peça AE',quantity:1,value:200,cost:100,sector:'auto_eletrica'}],services:[{description:'Freio',mechanic:'Tony',value:300,commissionRate:.5,sector:'mecanica'},{description:'Alternador',mechanic:'Gustavo',value:400,commissionRate:.5,sector:'auto_eletrica'}]}};
test('fechamento gera plano único e atômico, com valores e comissões no setor certo',async()=>{
 const storage=new Map(),user={id,email:'cortezgaragemecanica@gmail.com',user_metadata:{device_id:'test'}};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
 localStorage.setItem('cortez-garage-supabase-session-v1',JSON.stringify({user,access_token:'test',refresh_token:'test',expires_at:Date.now()/1000+3600}));localStorage.setItem('cortez-garage-device-id-v1','test');
 let submitted=null,financialWrites=0;
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/rpc/aplicar_fechamento_setores')){submitted=JSON.parse(options.body);return Response.json(submitted.p_plan.filter(op=>op.method==='POST').map(op=>({...op.body,id:crypto.randomUUID()})))}
  if(path.includes('lancamentos_financeiros')){if(options.method&&options.method!=='GET')financialWrites++;return Response.json([])}
  if(path.endsWith('/ordens_servico')||path.endsWith('/ae_ordens_servico'))return Response.json([{id,dados_extras:{budget:order.budget}}]);
  throw Error('Unexpected '+path);
 };
 const{recordOrderDelivery}=await import('../src/supabase.js?mixed-plan-test');
 await recordOrderDelivery(structuredClone(order),'Mercado Livre',null,{installments:1});
 assert.equal(financialWrites,0);assert.equal(submitted.p_order_id,id);assert.equal(submitted.p_receipt.receivedNow,1000);
 const cash=submitted.p_plan.filter(op=>op.body.categoria==='Fluxo de caixa'),commissions=submitted.p_plan.filter(op=>op.body.categoria==='Comissões');
 assert.equal(cash.reduce((sum,op)=>sum+op.body.valor,0),973);
 assert.equal(cash.find(op=>op.sector==='mecanica').body.valor,389.2);assert.equal(cash.find(op=>op.sector==='auto_eletrica').body.valor,583.8);
 assert.equal(commissions.find(op=>op.sector==='mecanica').body.valor,150);assert.equal(commissions.find(op=>op.sector==='auto_eletrica').body.valor,200);
 assert.ok(commissions.find(op=>op.sector==='auto_eletrica').body.referencia.endsWith('-servico-2'));
});
