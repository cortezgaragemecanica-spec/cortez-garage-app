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
export const agendaDisplayName=name=>isPrivateMechanic(name)?PRIVATE_AGENDA_LABEL:String(name||'');
