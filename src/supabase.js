const SUPABASE_URL='https://pqldixrfvmkwkwbbysyl.supabase.co';
const SUPABASE_KEY='sb_publishable_ZKLf-NFlDWY_kK4KWIW3bw_YZvJkfbe';
const SESSION_KEY='cortez-garage-supabase-session-v1';
const MIGRATION_KEY='cortez-garage-supabase-migrated-v1';

const headers=(token,extra={})=>({apikey:SUPABASE_KEY,Authorization:`Bearer ${token||SUPABASE_KEY}`,'Content-Type':'application/json',...extra});
const json=async response=>{const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.hint||`Supabase respondeu ${response.status}`);return data};
const request=(path,{token,method='GET',body,prefer}={})=>fetch(`${SUPABASE_URL}${path}`,{method,headers:headers(token,prefer?{Prefer:prefer}:{}),body:body===undefined?undefined:JSON.stringify(body)}).then(json);
const clean=value=>String(value||'').trim();
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'');
const uuid=value=>isUuid(value)?value:crypto.randomUUID();
const iso=value=>{const date=new Date(value||0);return Number.isNaN(date.getTime())?new Date(0).toISOString():date.toISOString()};

export function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
export function signOut(){localStorage.removeItem(SESSION_KEY);location.reload()}
export async function signIn(email,password){const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session}
export async function refreshSession(){const current=getSession();if(!current?.refresh_token)return null;if((current.expires_at||0)*1000>Date.now()+60000)return current;try{const session=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:current.refresh_token}});localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session}catch{signOut();return null}}

export function renderLogin(onSuccess){document.querySelector('#app').innerHTML=`<main class="login-page"><form id="loginForm" class="login-card"><img src="./official-logo.png" alt="Cortez Garage"><h1>Acesso à oficina</h1><p>Entre com o usuário autorizado no Supabase.</p><label><span>E-mail</span><input id="loginEmail" type="email" autocomplete="username" required></label><label><span>Senha</span><input id="loginPassword" type="password" autocomplete="current-password" required></label><button class="primary wide">Entrar</button><small id="loginError" role="alert"></small></form></main>`;document.querySelector('#loginForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter,error=document.querySelector('#loginError');button.disabled=true;button.textContent='Entrando…';error.textContent='';try{await signIn(document.querySelector('#loginEmail').value.trim(),document.querySelector('#loginPassword').value);await onSuccess()}catch(reason){error.textContent=reason.message;button.disabled=false;button.textContent='Entrar'}}}

function mapClient(row){return{id:row.id,name:row.nome,phone:row.telefone||'',email:row.email||'',notes:row.observacoes||'',updatedAt:row.atualizado_em}}
function mapVehicle(row){return{id:row.id,clientId:row.cliente_id||'',plate:row.placa,model:row.modelo,brand:row.marca||'',year:row.ano||'',color:row.cor||'',km:row.quilometragem||'',fuel:row.combustivel||'',updatedAt:row.atualizado_em}}
function mapOrder(row,clients,vehicles){const extras=row.dados_extras||{},client=clients.find(item=>item.id===row.cliente_id)||extras.client||{},vehicle=vehicles.find(item=>item.id===row.veiculo_id)||extras.vehicle||{};return{id:row.id,number:String(row.numero).padStart(4,'0'),created:row.data_entrada,client,vehicle,complaint:row.reclamacao||'',diagnosis:row.diagnostico||'',notes:row.observacoes||'',damage:row.avarias||'',mechanic:row.mecanico||'',status:row.status,labor:Number(row.mao_obra)||0,partsValue:Number(row.valor_pecas)||0,discount:Number(row.desconto)||0,total:Number(row.total)||0,payment:row.pagamento||'',checklist:row.checklist||[],photos:row.fotos||[],signature:extras.signature||'',services:extras.services||'',parts:extras.parts||'',budget:extras.budget,updatedAt:row.atualizado_em}}
const newest=(local,remote)=>iso(remote?.updatedAt)>=iso(local?.updatedAt)?{...local,...remote}:{...remote,...local};
const merge=(local,remote,key)=>{const result=[...local];for(const item of remote){const index=result.findIndex(value=>key(value)===key(item));if(index<0)result.push(item);else result[index]=newest(result[index],item)}return result};

async function readDatabase(token){const [clientRows,vehicleRows,orderRows]=await Promise.all([request('/rest/v1/clientes?select=*',{token}),request('/rest/v1/veiculos?select=*',{token}),request('/rest/v1/ordens_servico?select=*&order=numero.asc',{token})]);const clients=clientRows.map(mapClient),vehicles=vehicleRows.map(mapVehicle),orders=orderRows.map(row=>mapOrder(row,clients,vehicles));return{clients,vehicles,orders,counter:Math.max(0,...orders.map(order=>Number(order.number)||0))+1}}
async function upsert(token,table,rows,onConflict){if(!rows.length)return[];return request(`/rest/v1/${table}?on_conflict=${onConflict}`,{token,method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:rows})}
async function writeDatabase(token,db){
  const clients=await upsert(token,'clientes',(db.clients||[]).map(item=>({id:uuid(item.id),nome:item.name,telefone:item.phone||null,email:item.email||null,observacoes:item.notes||null})), 'id');
  const clientIds=new Map(clients.map(row=>[clean(row.telefone)||clean(row.nome).toLowerCase(),row.id]));
  const migratedClientIds=new Map();
  for(const item of db.clients||[]){const oldId=item.id,key=clean(item.phone)||clean(item.name).toLowerCase(),newId=clientIds.get(key)||item.id;migratedClientIds.set(oldId,newId);item.id=newId}
  const resolveClientId=client=>migratedClientIds.get(client?.id)||clientIds.get(clean(client?.phone)||clean(client?.name).toLowerCase())||null;
  const vehicles=await upsert(token,'veiculos',(db.vehicles||[]).map(item=>({id:uuid(item.id),cliente_id:migratedClientIds.get(item.clientId)||null,placa:clean(item.plate).toUpperCase(),modelo:item.model,marca:item.brand||null,ano:String(item.year||'')||null,cor:item.color||null,quilometragem:Number(item.km)||null,combustivel:item.fuel||null})),'placa');
  const vehicleIds=new Map(vehicles.map(row=>[clean(row.placa).toUpperCase(),row.id]));
  const migratedVehicleIds=new Map();
  for(const item of db.vehicles||[]){const oldId=item.id,newId=vehicleIds.get(clean(item.plate).toUpperCase())||item.id;migratedVehicleIds.set(oldId,newId);item.clientId=migratedClientIds.get(item.clientId)||item.clientId;item.id=newId}
  const resolveVehicleId=vehicle=>migratedVehicleIds.get(vehicle?.id)||vehicleIds.get(clean(vehicle?.plate).toUpperCase())||null;
  const existingOrders=await request('/rest/v1/ordens_servico?select=id,numero',{token});
  const existingOrderIds=new Map(existingOrders.map(row=>[Number(row.numero),row.id]));
  const existingOrderNumbers=new Map(existingOrders.map(row=>[row.id,Number(row.numero)]));
  const usedOrderIds=new Set();
  const rows=(db.orders||[]).map(item=>{const numero=Number(item.number),savedId=existingOrderIds.get(numero),candidate=isUuid(item.id)?item.id:null,conflicts=candidate&&existingOrderNumbers.has(candidate)&&existingOrderNumbers.get(candidate)!==numero;let id=savedId||(!conflicts&&!usedOrderIds.has(candidate)&&candidate)||crypto.randomUUID();while(usedOrderIds.has(id))id=crypto.randomUUID();usedOrderIds.add(id);return{id,numero,cliente_id:resolveClientId(item.client),veiculo_id:resolveVehicleId(item.vehicle),reclamacao:item.complaint||null,diagnostico:item.diagnosis||null,observacoes:item.notes||null,avarias:item.damage||null,mecanico:item.mechanic||null,status:item.status||'Aguardando diagnóstico',mao_obra:Number(item.labor)||0,valor_pecas:Number(item.partsValue)||0,desconto:Number(item.discount)||0,total:Number(item.total)||0,pagamento:item.payment||null,checklist:item.checklist||[],fotos:item.photos||[],dados_extras:{signature:item.signature||'',services:item.services||'',parts:item.parts||'',budget:item.budget||null,client:{...item.client,id:resolveClientId(item.client)},vehicle:{...item.vehicle,id:resolveVehicleId(item.vehicle),clientId:resolveClientId(item.client)}},data_entrada:item.created||new Date().toISOString()}});
  const orders=await upsert(token,'ordens_servico',rows,'numero');const orderIds=new Map(orders.map(row=>[String(row.numero).padStart(4,'0'),row.id]));for(const item of db.orders||[])item.id=orderIds.get(String(item.number).padStart(4,'0'))||item.id;
}

export async function syncSupabase(localDb){const session=await refreshSession();if(!session?.access_token)throw new Error('Sessão expirada');let remote=await readDatabase(session.access_token);const firstMigration=!localStorage.getItem(MIGRATION_KEY);let merged={clients:merge(localDb.clients||[],remote.clients||[],item=>clean(item.phone)||clean(item.name).toLowerCase()),vehicles:merge(localDb.vehicles||[],remote.vehicles||[],item=>clean(item.plate).toUpperCase()),orders:merge(localDb.orders||[],remote.orders||[],item=>String(item.number)),counter:Math.max(Number(localDb.counter||1),Number(remote.counter||1))};if(firstMigration||JSON.stringify(merged)!==JSON.stringify(remote)){await writeDatabase(session.access_token,merged);localStorage.setItem(MIGRATION_KEY,new Date().toISOString());remote=await readDatabase(session.access_token);merged=remote}return merged}

export async function recordMirrorSync(data){const session=await refreshSession();if(!session?.access_token)return;await request('/rest/v1/sincronizacao',{token:session.access_token,method:'POST',prefer:'return=minimal',body:{origem:'google_sheets',entidade:'database',registro_id:'mirror',dados:data}})}



