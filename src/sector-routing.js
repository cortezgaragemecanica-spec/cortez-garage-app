import{ACTIVE_SECTOR,SECTOR_OWNER,isSectorOperator}from'./sector-context.js?v=20261105-2';
const registry=new Map();
export function actorAcrossSectors(){try{const email=JSON.parse(globalThis.localStorage?.getItem('cortez-garage-supabase-session-v1')||'null')?.user?.email||'',profiles=JSON.parse(globalThis.localStorage?.getItem('cortez-garage-user-access-v1')||'[]');return isSectorOperator(email,profiles.find(p=>p.email?.toLowerCase()===email.toLowerCase()))}catch{return false}}
export function rememberSector(table,rows,sector){for(const row of Array.isArray(rows)?rows:[]){if(!row?.id)continue;const key=table+':'+row.id,old=registry.get(key);if(!old||sector==='mecanica')registry.set(key,sector);row.__sourceSector=sector}return rows}
export const sourceSector=(id,table='ordens_servico')=>registry.get(table+':'+id);
export function routeSector(path,body){
 if(/registro_id=eq\.(usuarios-permissoes|mecanicos)(?:&|$)/.test(path)||body?.entidade==='configuracao'&&['usuarios-permissoes','mecanicos'].includes(body.registro_id))return'mecanica';
 const table=path.match(/^\/rest\/v1\/([a-z_]+)[?]/)?.[1],id=path.match(/[?&]id=eq\.([^&]+)/)?.[1];
 if(id&&table&&registry.has(table+':'+decodeURIComponent(id)))return registry.get(table+':'+decodeURIComponent(id));
 const orderId=body?.p_order_id||body?.p_os_id||body?.dados?.orderId||path.match(/[?&]registro_id=eq\.([0-9a-f-]{36})/)?.[1];
 if(orderId&&registry.has('ordens_servico:'+orderId))return registry.get('ordens_servico:'+orderId);
 return ACTIVE_SECTOR;
}
export function consolidatedCollection(path){return actorAcrossSectors()&&(
 /^\/rest\/v1\/estoque\?/.test(path)&&!/[?&]id=/.test(path)||
 /^\/rest\/v1\/sincronizacao\?/.test(path)&&/[?&]entidade=eq\.(solicitacao_pecas|solicitacao_orcamento_servicos|solicitacao_revisao_os|checklist_compras_os)(?:&|$)/.test(path)&&!/[?&](id|registro_id)=eq\./.test(path)
 )}
export const responseTable=path=>path.match(/^\/rest\/v1\/([a-z_]+)(?:[?]|$)/)?.[1];
