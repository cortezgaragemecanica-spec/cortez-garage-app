import test from 'node:test';
import assert from 'node:assert/strict';
test('reabrir a O.S. usa os itens e totais coerentes sem gerar descrições artificiais',async()=>{
 const store=new Map(),id='11111111-1111-4111-8111-111111111111';
 globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
 localStorage.setItem('cortez-garage-supabase-session-v1',JSON.stringify({user:{id,email:'cortezgaragemecanica@gmail.com',user_metadata:{device_id:'test'}},access_token:'test',refresh_token:'test',expires_at:Date.now()/1000+3600}));
 localStorage.setItem('cortez-garage-device-id-v1','test');
 localStorage.setItem('cortez-garage-supabase-migrated-v1','done');
 const row={id,numero:225,status:'Em andamento',mao_obra:80,valor_pecas:100,total:180,desconto:0,dados_extras:{surchargeRate:.1,budget:{parts:[{description:'Lâmpada',quantity:1,value:50}],partsTotal:50,services:[{description:'Instalação da lâmpada',value:40}],servicesTotal:40}}};
 globalThis.fetch=async(url,options={})=>{
  assert.ok(!options.method||options.method==='GET');
  return Response.json(new URL(url).pathname.endsWith('/ordens_servico')?[row]:[]);
 };
 const {syncSupabase}=await import('../src/supabase.js?budget-consistency-read-test');
 const database=await syncSupabase({clients:[],vehicles:[],orders:[]});
 const order=database.orders[0];
 assert.equal(order.partsValue,50);
 assert.equal(order.labor,40);
 assert.equal(order.total,99);
 assert.equal(order.budget.parts.length,1);
 assert.equal(order.budget.services.length,1);
 assert.equal(order.budget.services[0].description,'Instalação da lâmpada');
});
