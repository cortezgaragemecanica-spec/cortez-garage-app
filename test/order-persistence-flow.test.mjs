import test from'node:test';
import assert from'node:assert/strict';
import{randomUUID}from'node:crypto';

class MemoryStorage{
  #values=new Map();
  getItem(key){return this.#values.has(key)?this.#values.get(key):null}
  setItem(key,value){this.#values.set(key,String(value))}
  removeItem(key){this.#values.delete(key)}
}

const clone=value=>structuredClone(value);
const now=(()=>{let tick=0;return()=>`2026-10-09T15:00:${String(tick++).padStart(2,'0')}.000Z`})();
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const tables={clientes:[],veiculos:[],ordens_servico:[],estoque:[],sincronizacao:[]};

function matches(row,params){
  for(const [key,value]of params){
    if(['select','limit','offset','order','on_conflict'].includes(key))continue;
    if(value.startsWith('eq.')&&String(row[key])!==decodeURIComponent(value.slice(3)))return false;
  }
  return true;
}
function upsert(table,items,conflict){
  const rows=Array.isArray(items)?items:[items],saved=[];
  for(const input of rows){
    const key=conflict||'id',index=tables[table].findIndex(row=>String(row[key])===String(input[key])),row={...(index>=0?tables[table][index]:{}),...clone(input)};
    row.id||=randomUUID();row.atualizado_em=now();
    if(index>=0)tables[table][index]=row;else tables[table].push(row);
    saved.push(clone(row));
  }
  return saved;
}

globalThis.localStorage=new MemoryStorage();
globalThis.location={reload(){}};
globalThis.document={visibilityState:'visible',addEventListener(){}};
globalThis.addEventListener=()=>{};
globalThis.dispatchEvent=()=>{};
globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail}};

globalThis.fetch=async(input,options={})=>{
  const url=new URL(input),path=url.pathname.replace('/rest/v1/',''),method=(options.method||'GET').toUpperCase(),body=options.body?JSON.parse(options.body):undefined;
  if(!url.pathname.startsWith('/rest/v1/'))return json({message:'Rota não simulada'},404);
  if(path==='rpc/finalizar_os_pronta'&&method==='POST'){
    const order=tables.ordens_servico.find(row=>row.id===body.p_order_id);if(!order)return json({message:'Ordem de serviço não encontrada'},400);
    const movement=tables.sincronizacao.find(row=>row.entidade==='estoque_saida'&&row.registro_id===order.id);
    if(!movement){for(const item of body.p_items||[]){const stock=tables.estoque.find(row=>row.id===item.stockId);if(!stock||stock.quantidade<item.quantity)return json({message:'Saldo insuficiente'},400);stock.quantidade-=item.quantity}tables.sincronizacao.push({id:randomUUID(),entidade:'estoque_saida',registro_id:order.id,dados:{pecas:body.p_items}})}
    order.status='Pronto para entrega';order.atualizado_em=now();return json({alreadyProcessed:Boolean(movement),missing:[]});
  }
  const table=path.split('?')[0];if(!(table in tables))return json({message:'Tabela não simulada'},404);
  if(method==='GET'){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);return json(tables[table].filter(row=>matches(row,url.searchParams)).slice(offset,offset+limit).map(clone))}
  if(method==='POST'){
    const conflict=url.searchParams.get('on_conflict');
    if(table==='ordens_servico')for(const item of(Array.isArray(body)?body:[body])){const previous=tables.ordens_servico.find(row=>Number(row.numero)===Number(item.numero));if(previous&&['Pronto para entrega','Entregue'].includes(previous.status)&&JSON.stringify(previous.dados_extras?.budget)!==JSON.stringify(item.dados_extras?.budget))return json({message:'Reabra a O.S. com estorno antes de alterar peças ou valores'},400)}
    return json(upsert(table,body,conflict),201);
  }
  if(method==='PATCH'){
    const found=tables[table].filter(row=>matches(row,url.searchParams)),saved=[];
    for(const row of found){Object.assign(row,clone(body),{atualizado_em:now()});saved.push(clone(row))}
    return json(saved);
  }
  return json({message:'Método não simulado'},405);
};

const SESSION_KEY='cortez-garage-supabase-session-v1';
function signIn(email){const deviceId='device-test';localStorage.setItem('cortez-garage-device-id-v1',deviceId);localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:'test',refresh_token:'test',expires_at:4102444800,user:{id:randomUUID(),email,user_metadata:{name:email.split('@')[0],device_id:deviceId}}}))}
function makeOrder(number,status='Aguardando diagnóstico'){
  const client={id:randomUUID(),name:'Cliente Teste',phone:'45999990000',cpf:'123',address:'Rua Teste'};
  const vehicle={id:randomUUID(),clientId:client.id,plate:'ABC1D23',model:'Teste',brand:'Marca',year:'2024',color:'Preto',km:100,fuel:'Flex'};
  const budget={parts:[{description:'Filtro',quantity:1,value:110,cost:100,margin:10,stockMode:'stock',stockId:'stock-1'}],services:[{description:'Troca',mechanic:'Gustavo',value:220,commissionRate:.5}],partsTotal:110,servicesTotal:220,subtotal:330,surchargeRate:.1,surchargeAmount:33,total:363,paymentTerms:'Pix',warrantyTerms:'90 dias',approved:true};
  return{id:randomUUID(),number:String(number).padStart(4,'0'),created:'2026-10-09T12:00:00.000Z',updatedAt:'2026-10-09T12:00:00.000Z',client,vehicle,complaint:'Barulho',diagnosis:'Rolamento',notes:'Cliente avisado',damage:'Sem avarias',mechanic:'Gustavo',status,labor:220,partsValue:110,discount:0,surchargeRate:.1,surchargePolicy:'optional-total-10-v3',total:363,payment:'Pix',checklist:[{label:'Luzes',ok:true}],photos:[],services:'Troca',parts:'Filtro',budget,advances:[],advance:0,advancePayment:'',advanceAt:null,warranty:false,warrantyPayCommissions:false}
}

test('fluxo completo persiste, relê, atualiza e sincroniza a mesma O.S. sem tocar nas entregues',async()=>{
  const delivered=makeOrder(90,'Entregue'),deliveredRow={id:delivered.id,numero:90,cliente_id:delivered.client.id,veiculo_id:delivered.vehicle.id,reclamacao:'Histórico',diagnostico:'Preservar',observacoes:'Não alterar',avarias:null,mecanico:'Tony',status:'Entregue',mao_obra:100,valor_pecas:50,desconto:0,total:150,pagamento:'Pix',checklist:[],fotos:[],data_entrada:'2026-09-01T12:00:00.000Z',dados_extras:{budget:{parts:[],services:[],partsTotal:0,servicesTotal:0,total:0},client:delivered.client,vehicle:delivered.vehicle},atualizado_em:now()};
  tables.clientes.push({id:delivered.client.id,nome:delivered.client.name,telefone:delivered.client.phone,atualizado_em:now()});
  tables.veiculos.push({id:delivered.vehicle.id,cliente_id:delivered.client.id,placa:delivered.vehicle.plate,modelo:delivered.vehicle.model,atualizado_em:now()});
  tables.ordens_servico.push(deliveredRow);tables.estoque.push({id:'stock-1',codigo:'P1',descricao:'Filtro',quantidade:2,valor_unitario:110,atualizado_em:now()});
  signIn('gust.cribas@gmail.com');
  const api=await import(`../src/supabase.js?flow=${Date.now()}`),order=makeOrder(124),database={clients:[delivered.client,order.client],vehicles:[delivered.vehicle,order.vehicle],orders:[{...delivered,budget:{...delivered.budget,services:[{description:'Não reenviar',value:999}]}},order],counter:125};
  const created=await api.saveSupabase(database),saved=created.orders.find(item=>item.number==='0124');
  assert.ok(saved);assert.equal(tables.ordens_servico.length,2);assert.equal(tables.ordens_servico.find(row=>row.numero===90).diagnostico,'Preservar');
  for(const field of['complaint','diagnosis','notes','mechanic','labor','partsValue','discount','total','payment','status'])assert.deepEqual(saved[field],order[field]);
  assert.deepEqual(saved.budget.parts,order.budget.parts);assert.deepEqual(saved.budget.services,order.budget.services);

  const reopened=(await api.readSupabase()).orders.find(item=>item.number==='0124');
  assert.equal(reopened.client.name,'Cliente Teste');assert.equal(reopened.vehicle.plate,'ABC1D23');assert.equal(reopened.diagnosis,'Rolamento');assert.equal(reopened.notes,'Cliente avisado');

  signIn('tony@cortezgarage.com');reopened.status='Em andamento';reopened.complaint='Reclamação atualizada';reopened.diagnosis='Diagnóstico atualizado';reopened.notes='Atualizada';reopened.mechanic='Tony';reopened.discount=10;reopened.total=352;reopened.budget={...reopened.budget,total:352};
  await api.saveOrderValues(reopened);assert.equal(tables.ordens_servico.length,2);const savedUpdate=tables.ordens_servico.find(row=>row.numero===124);assert.equal(savedUpdate.reclamacao,'Reclamação atualizada');assert.equal(savedUpdate.diagnostico,'Diagnóstico atualizado');assert.equal(savedUpdate.observacoes,'Atualizada');assert.equal(savedUpdate.mecanico,'Tony');
  const updated=(await api.readSupabase()).orders.find(item=>item.number==='0124');assert.equal(updated.discount,10);assert.equal(updated.total,352);

  const deviceA=clone(updated),deviceB=clone(updated);deviceA.complaint='Alteração A';await api.saveOrderProgress(deviceA);deviceB.complaint='Alteração B';await assert.rejects(()=>api.saveOrderProgress(deviceB),/alterada em outro aparelho/);

  const ready=await api.finalizeOrderReady(deviceA,[{partIndex:0,stockId:'stock-1'}]);assert.equal(ready.alreadyProcessed,false);assert.equal(tables.estoque[0].quantidade,1);assert.equal(tables.ordens_servico.find(row=>row.numero===124).status,'Pronto para entrega');
  const readyAgain=await api.finalizeOrderReady(deviceA,[{partIndex:0,stockId:'stock-1'}]);assert.equal(readyAgain.alreadyProcessed,true);assert.equal(tables.estoque[0].quantidade,1);
  await api.updateOrderStatus(order.id,'Entregue');const deviceC=(await api.readSupabase()).orders.find(item=>item.number==='0124');assert.equal(deviceC.status,'Entregue');assert.equal(deviceC.complaint,'Alteração A');assert.equal(tables.ordens_servico.length,2);
});
