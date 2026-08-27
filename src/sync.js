const CONFIG_KEY='cortez-garage-sync-v1';
export const DEFAULT_SYNC_URL='https://script.google.com/macros/s/AKfycbyaVOd06qSiIzctse-XsBrCEe0ujR6KXFdCE47oHXjgRTHuye3uiDMSYyszZ3W76JGhsA/exec';

export function getSyncConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'null')}catch{return null}}
export function setSyncConfig(config){localStorage.setItem(CONFIG_KEY,JSON.stringify(config))}
export function clearSyncConfig(){localStorage.removeItem(CONFIG_KEY)}

async function callMirror(action,data,config=getSyncConfig()){
  if(!config?.url||!config?.token)throw new Error('Sincronização não configurada');
  let payload,lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:config.token,...data})});
      if(!response.ok)throw new Error(`Falha na sincronização (${response.status})`);
      payload=await response.json();
      if(!payload.ok)throw new Error(payload.error||'Falha na sincronização');
      break;
    }catch(error){
      lastError=error;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)+Math.random()*1200));
    }
  }
  if(!payload?.ok)throw lastError||new Error('Falha na sincronização');
  return payload;
}

export const mirrorOrders=(orders,config=getSyncConfig())=>callMirror('sync',{db:{orders}},config);
export const syncStockMirror=(items,config=getSyncConfig())=>callMirror('stockSync',{items},config).then(result=>result.items||[]);


