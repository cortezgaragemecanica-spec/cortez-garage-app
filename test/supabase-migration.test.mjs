import test from 'node:test';
import assert from 'node:assert/strict';

test('migração troca IDs da planilha antes de gravar relacionamentos',async()=>{
  const storage=new Map([['cortez-garage-supabase-session-v1',JSON.stringify({access_token:'test-token',refresh_token:'refresh',expires_at:Date.now()/1000+3600})]]);
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  const writes={};
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;
    if(options.method==='POST'&&path.startsWith('/rest/v1/')){
      const table=path.split('/').pop();
      const rows=JSON.parse(options.body);
      writes[table]=rows;
      return Response.json(rows);
    }
    return Response.json([]);
  };
  const {syncSupabase}=await import(`../src/supabase.js?test=${Date.now()}`);
  await syncSupabase({
    clients:[{id:'sheet-client-1',name:'Cliente Teste',phone:'11999999999'}],
    vehicles:[{id:'sheet-vehicle-ABC1234',clientId:'sheet-client-1',plate:'ABC1234',model:'Modelo'}],
    orders:[{id:'sheet-order-1',number:'0001',client:{id:'sheet-client-1',name:'Cliente Teste',phone:'11999999999'},vehicle:{id:'sheet-vehicle-ABC1234',plate:'ABC1234',model:'Modelo'}}],
    counter:2
  });
  assert.match(writes.clientes[0].id,/^[0-9a-f-]{36}$/i);
  assert.equal(writes.veiculos[0].cliente_id,writes.clientes[0].id);
  assert.equal(writes.ordens_servico[0].cliente_id,writes.clientes[0].id);
  assert.equal(writes.ordens_servico[0].veiculo_id,writes.veiculos[0].id);
  assert.equal(writes.ordens_servico[0].dados_extras.client.id,writes.clientes[0].id);
  assert.equal(writes.ordens_servico[0].dados_extras.vehicle.id,writes.veiculos[0].id);
});

test('migração não reutiliza o ID de uma O.S. existente em outro número',async()=>{
  const duplicatedId='11111111-1111-4111-8111-111111111111';
  const storage=new Map([['cortez-garage-supabase-session-v1',JSON.stringify({access_token:'test-token',refresh_token:'refresh',expires_at:Date.now()/1000+3600})]]);
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  let fullOrderReads=0,writtenOrders=[];
  globalThis.fetch=async(url,options={})=>{
    const parsed=new URL(url),path=parsed.pathname,query=parsed.search;
    if(options.method==='POST'&&path==='/rest/v1/ordens_servico'){writtenOrders=JSON.parse(options.body);return Response.json(writtenOrders)}
    if(options.method==='POST'&&path.startsWith('/rest/v1/'))return Response.json(JSON.parse(options.body));
    if(path==='/rest/v1/ordens_servico'&&(query.includes('select=id%2Cnumero')||query.includes('select=id,numero')))return Response.json([{id:duplicatedId,numero:1}]);
    if(path==='/rest/v1/ordens_servico'&&query.includes('select=*'))return Response.json(fullOrderReads++===0?[{id:duplicatedId,numero:1,status:'Em andamento',dados_extras:{},checklist:[],fotos:[]}]:[]);
    return Response.json([]);
  };
  const {syncSupabase}=await import(`../src/supabase.js?collision=${Date.now()}`);
  await syncSupabase({clients:[],vehicles:[],orders:[{id:duplicatedId,number:'0002',client:{},vehicle:{}}],counter:3});
  const first=writtenOrders.find(order=>order.numero===1),second=writtenOrders.find(order=>order.numero===2);
  assert.equal(first.id,duplicatedId);
  assert.notEqual(second.id,duplicatedId);
  assert.notEqual(first.id,second.id);
});


