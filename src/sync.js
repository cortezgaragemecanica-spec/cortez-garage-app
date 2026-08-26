const CONFIG_KEY='cortez-garage-sync-v1';
export const DEFAULT_SYNC_URL='https://script.google.com/macros/s/AKfycbyaVOd06qSiIzctse-XsBrCEe0ujR6KXFdCE47oHXjgRTHuye3uiDMSYyszZ3W76JGhsA/exec';

export function getSyncConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'null')}catch{return null}}
export function setSyncConfig(config){localStorage.setItem(CONFIG_KEY,JSON.stringify(config))}
export function clearSyncConfig(){localStorage.removeItem(CONFIG_KEY)}

const normalizePhone=value=>String(value||'').replace(/\D/g,'');
const normalizePlate=value=>String(value||'').replace(/[^a-z0-9]/gi,'').toUpperCase();

function mergeBy(items,remote,key,preserveLocalId=true){
  const result=[...items];
  for(const incoming of remote){
    const match=result.find(item=>key(item)===key(incoming));
    if(match)Object.assign(match,incoming,{id:preserveLocalId?(match.id||incoming.id):(incoming.id||match.id)});else result.push(incoming);
  }
  return result;
}

export async function syncDatabase(db,config=getSyncConfig()){
  if(!config?.url||!config?.token)throw new Error('Sincronização não configurada');
  const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'sync',token:config.token,db})});
  if(!response.ok)throw new Error(`Falha na sincronização (${response.status})`);
  const payload=await response.json();
  if(!payload.ok)throw new Error(payload.error||'Falha na sincronização');
  const remote=payload.db||{};
  return {
    clients:mergeBy(db.clients||[],remote.clients||[],item=>normalizePhone(item.phone)||String(item.name||'').toLowerCase()),
    vehicles:mergeBy(db.vehicles||[],remote.vehicles||[],item=>normalizePlate(item.plate)),
    orders:mergeBy(db.orders||[],remote.orders||[],item=>String(item.number||''),false),
    counter:Math.max(Number(db.counter||1),Number(remote.counter||1))
  };
}

