const OWNER_EMAIL='cortezgaragemecanica@gmail.com';
const AUTHORIZED_MECHANICS=new Set(['fabio','tony','gustavo']);

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function canUseOrderRequestForms(user={},managedUser={}){
  const email=String(user.email||'').trim().toLowerCase();
  if(email===OWNER_EMAIL)return true;
  if(AUTHORIZED_MECHANICS.has(normalize(email.split('@')[0])))return true;
  const identities=[user.name,managedUser.name,managedUser.agendaMechanic].map(normalize).filter(Boolean);
  return identities.some(identity=>identity.split(' ').some(name=>AUTHORIZED_MECHANICS.has(name)));
}
