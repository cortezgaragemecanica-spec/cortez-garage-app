import{canManageServices,getCurrentUser,hasPermission}from'./supabase.js?v=20260911-3';

const blockedActions='.add-line,.edit-part,.remove-line,.refuse-line,#includePart,#approveBudget,#previousStatus';
const protectedFields='#services,#parts,#labor,#partsValue,#discount,#payment,#budgetSection input:not([data-check]),#budgetSection textarea,#budgetSection select';
const message='Seu usuário possui acesso de consulta. O checklist pode ser atualizado; serviços, peças, valores, baixa de estoque e entrega não podem ser alterados.';
const orderReadOnlyActions='.os-grid button:not(#print),.os-head button:not(#print),#saveOs,#editOrder,#technicalReport,#sendBudget,#readyOrder,#approveBudget,#previousStatus';
const orderReadOnlyFields='.os-grid input,.os-grid textarea,.os-grid select,.os-grid canvas,.os-head select';
const orderReadOnlyMessage='Modo espectador: esta ordem de serviço está disponível apenas para consulta.';

function restricted(){return!canManageServices()}
function lockServiceScreen(){
  if(!hasPermission('createEntries'))document.querySelectorAll('[data-route="entry"]').forEach(element=>element.remove());
  const save=document.querySelector('#saveOs'),actions=document.querySelector('.os-head>div:last-child');
  const owner=getCurrentUser().email.toLowerCase()==='cortezgaragemecanica@gmail.com';
  if(save&&!owner)save.remove();
  if(!hasPermission('editOrders')){
    const order=document.querySelector('.os-grid');
    if(order&&!document.querySelector('.order-readonly-note'))order.insertAdjacentHTML('beforebegin',`<div class="access-restricted-note order-readonly-note" role="note">🔒 ${orderReadOnlyMessage}</div>`);
    document.querySelectorAll(orderReadOnlyActions).forEach(element=>{element.hidden=true;element.disabled=true});
    document.querySelectorAll(orderReadOnlyFields).forEach(element=>{element.disabled=true;element.readOnly=true;element.setAttribute('aria-disabled','true');if(element.tagName==='CANVAS')element.style.pointerEvents='none'});
    return;
  }
  if(!restricted())return;
  const order=document.querySelector('.os-grid');
  if(!order)return;
  if(!document.querySelector('.access-restricted-note'))order.insertAdjacentHTML('beforebegin',`<div class="access-restricted-note" role="note">🔒 ${message}</div>`);
  document.querySelectorAll(blockedActions).forEach(element=>{element.hidden=true;element.disabled=true});
  document.querySelectorAll(protectedFields).forEach(element=>{element.disabled=true;element.readOnly=true;element.setAttribute('aria-disabled','true')});
}

document.addEventListener('click',event=>{
  if(!hasPermission('editOrders')&&event.target.closest(orderReadOnlyActions)){event.preventDefault();event.stopImmediatePropagation();alert(orderReadOnlyMessage);return}
  if(!restricted()||!event.target.closest(blockedActions))return;
  event.preventDefault();event.stopImmediatePropagation();alert(message);
},true);
new MutationObserver(lockServiceScreen).observe(document.querySelector('#app'),{childList:true,subtree:true});
lockServiceScreen();
