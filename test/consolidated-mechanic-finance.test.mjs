import test from 'node:test';
import assert from 'node:assert/strict';
test('consulta consolidada preserva as finanças de cada setor e paga comissões no setor de origem',async()=>{
 const store=new Map(),id='11111111-1111-4111-8111-111111111111',mech='22222222-2222-4222-8222-222222222222',electric='33333333-3333-4333-8333-333333333333';
 globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
 localStorage.setItem('cortez-garage-supabase-session-v1',JSON.stringify({user:{id,email:'cortezgaragemecanica@gmail.com',user_metadata:{device_id:'test'}},access_token:'test',refresh_token:'test',expires_at:Date.now()/1000+3600}));
 localStorage.setItem('cortez-garage-device-id-v1','test');
 const make=(id,amount)=>({id,categoria:'Comissões',mecanico:'Fabio',status:'Pendente',valor:amount,descricao:'Comissão de serviço',vencimento:'2026-11-18',referencia:'comissao-'+id});
 const primary=[make(mech,100)],electrical=[make(electric,200),{...make('44444444-4444-4444-8444-444444444444',900),mecanico:'Fabiano',referencia:'partner-weekly-v2-fabiano'}],payments=[];
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/rpc/pagar_comissoes_setor')){
   const body=JSON.parse(options.body);payments.push(body);
   const rows=body.p_setor==='mecanica'?primary:electrical;
   return Response.json({records:rows.filter(row=>body.p_ids.includes(row.id)),total:body.p_setor==='mecanica'?100:200,cash:null});
  }
  if(path.endsWith('/ae_lancamentos_financeiros'))return Response.json(electrical);
  if(path.endsWith('/lancamentos_financeiros'))return Response.json(primary);
  if(path.endsWith('/sincronizacao'))return Response.json([]);
  throw new Error(path);
 };
 const {readFinance,payCommissions}=await import('../src/supabase.js?consolidated-test');
 const records=await readFinance();
 assert.equal(records.length,1);
 assert.equal(records.mechanicLedger.length,2);
 assert.equal(records.mechanicLedger[1].sourceSector,'auto_eletrica');
 const paid=await payCommissions([mech,electric],'Dinheiro');
 assert.equal(paid.total,300);
 assert.deepEqual(payments.map(item=>[item.p_setor,item.p_ids]),[['mecanica',[mech]],['auto_eletrica',[electric]]]);
});
