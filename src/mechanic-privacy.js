import{sectorStorage as localStorage}from'./sector-context.js?v=20261105-1';
export const OWNER_EMAIL='cortezgaragemecanica@gmail.com';
export const PRIVATE_MECHANIC='Cortez';
export const PRIVATE_MECHANIC_MASK='**';
export const PRIVATE_AGENDA_LABEL='Cortez Atendimento Externo';

const SESSION_KEY='cortez-garage-supabase-session-v1';
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

export function currentUserEmail(){
  try{return String(JSON.parse(localStorage.getItem(SESSION_KEY)||'null')?.user?.email||'').trim().toLowerCase()}catch{return''}
}

export const isOwnerEmail=(email=currentUserEmail())=>normalized(email)===OWNER_EMAIL;
export const isPrivateMechanic=name=>normalized(name)===normalized(PRIVATE_MECHANIC);
export const mechanicDisplayName=(name,email=currentUserEmail())=>isPrivateMechanic(name)&&!isOwnerEmail(email)?PRIVATE_MECHANIC_MASK:String(name||'');
export const selectableMechanics=(names,email=currentUserEmail())=>isOwnerEmail(email)?[...names]:names.filter(name=>!isPrivateMechanic(name));
export function serviceMechanicOptions(names,current='',email=currentUserEmail()){
  const preferred=['tony','fabio','gustavo','cortez'];
  return [...new Set([...selectableMechanics(names,email),current].filter(Boolean))].sort((a,b)=>{
    const ai=preferred.indexOf(normalized(a)),bi=preferred.indexOf(normalized(b));
    return (ai<0?preferred.length:ai)-(bi<0?preferred.length:bi);
  });
}
export const agendaDisplayName=name=>isPrivateMechanic(name)?PRIVATE_AGENDA_LABEL:String(name||'');
