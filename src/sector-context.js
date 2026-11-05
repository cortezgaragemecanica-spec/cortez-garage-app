// A sector is fixed for the lifetime of a page. A second tab cannot redirect
// an in-flight save to another sector by changing shared browser storage.
export const SECTOR_OWNER='cortezgaragemecanica@gmail.com';
const gustavoEmails=new Set(['gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com','cortezgaragemotorcycles@gmail.com']);
export function isSectorOperator(email='',profile=null){const normalized=String(email).trim().toLowerCase();if(normalized==='marcelinocortez2910@gmail.com'||profile?.active===false||profile?.permissions?.accessApp===false||/marcelino/i.test(profile?.name||''))return false;return normalized===SECTOR_OWNER||gustavoEmails.has(normalized)||normalized==='fabiomaier19850901@gmail.com'||/^(gustavo|fabio|fábio|tony|cortez)$/i.test(profile?.agendaMechanic||profile?.name||'')}
export function maySwitchSector(email='',profile=null){return isSectorOperator(email,profile)&&(String(email).trim().toLowerCase()===SECTOR_OWNER||gustavoEmails.has(String(email).trim().toLowerCase())||/^gustavo$/i.test(profile?.agendaMechanic||profile?.name||''))}
export function resolveSector(search='',email='',profile=null){
  return new URLSearchParams(search).get('sector')==='auto_eletrica'&&maySwitchSector(email,profile)?'auto_eletrica':'mecanica';
}
let email='';
try{email=JSON.parse(globalThis.localStorage?.getItem('cortez-garage-supabase-session-v1')||'null')?.user?.email||''}catch{}
let profile=null;try{profile=JSON.parse(globalThis.localStorage?.getItem('cortez-garage-user-access-v1')||'[]').find(user=>user.email?.toLowerCase()===email.toLowerCase())}catch{}
export const ACTIVE_SECTOR=resolveSector(globalThis.location?.search,email,profile);
export const ELECTRICAL_SECTOR=ACTIVE_SECTOR==='auto_eletrica';
export const SECTOR_TITLE=ELECTRICAL_SECTOR?'Auto elétrica':'Mecânica';
export const matchesDisplayedOrder=(order,number)=>globalThis.document?.documentElement?.dataset.currentOrderId?order.id===document.documentElement.dataset.currentOrderId:String(order.number)===number;
const globalKeys=new Set(['cortez-garage-supabase-session-v1','cortez-garage-device-id-v1','cortez-garage-user-access-v1','cortez-garage-mechanics-v1']);
export function sectorStorageKey(key,sector=ACTIVE_SECTOR){return sector==='auto_eletrica'&&!globalKeys.has(String(key))?`cortez-auto-eletrica:${key}`:String(key)}
export function createSectorStorage(storage,sector=ACTIVE_SECTOR){const current=()=>storage||globalThis.localStorage;return{
  getItem:key=>current().getItem(sectorStorageKey(key,sector)),
  setItem:(key,value)=>current().setItem(sectorStorageKey(key,sector),value),
  removeItem:key=>current().removeItem(sectorStorageKey(key,sector))
}}
export const sectorStorage=createSectorStorage();
const tables=new Set(['clientes','veiculos','ordens_servico','itens_os','estoque','agendamentos','lancamentos_financeiros','sincronizacao']);
const procedures=new Set(['alterar_mecanico_servico_entregue','comissoes_semana_mecanico','conferir_comissoes_semana_mecanico','estornar_os_entregue','finalizar_os_pronta','historico_conferencia_comissoes_mecanicos','kaua_salvar_acerto_luizinho','owner_save_agendamento','owner_delete_agendamento','processar_baixa_estoque','reabrir_os_pronta','sincronizar_conta_compras_os']);
const sharedProcedures=new Set(['pagar_comissoes_setor','resumo_caixas_setores','transferir_caixa_setores','ratear_despesa_setores','salvar_os_setores','finalizar_os_mista','reabrir_os_mista','estornar_os_mista','aplicar_fechamento_setores','adiantamento_os_setores','mecanico_os_mista']);
export function sectorRequestPath(path,sector=ACTIVE_SECTOR){
  if(sector!=='auto_eletrica')return path;
  return path.replace(/^\/rest\/v1\/(rpc\/)?([a-z_]+)(?=[?\/]|$)/,(_all,rpc,name)=>{
    if(rpc&&sharedProcedures.has(name))return `/rest/v1/rpc/${name}`;
    if(!(rpc?procedures:tables).has(name)){
      if(!rpc&&name==='app_user_sessions')return `/rest/v1/${name}`;
      throw new Error(`Operação sem isolamento de setor: ${name}`);
    }
    return `/rest/v1/${rpc||''}ae_${name}`;
  });
}
