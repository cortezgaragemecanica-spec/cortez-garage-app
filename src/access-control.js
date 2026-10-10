import{canSaveOrders,hasPermission}from'./supabase.js?v=20261010-2';

const blockedActions='.add-line,.edit-part,.remove-line,.refuse-line,#includePart,#approveBudget,#previousStatus';
const protectedFields='#parts,#labor,#partsValue,#discount,#payment,#budgetSection input:not([data-check]),#budgetSection textarea,#budgetSection select';
const addOnlyBlockedActions='.edit-part,.remove-line,.refuse-line,#approveBudget,#previousStatus';
const addOnlyProtectedFields='#parts,#labor,#partsValue,#discount,#payment,#budgetPayment,#warrantyTerms';
const addOnlyMessage='Você pode incluir peças e serviços com valores. Diagnóstico e observação são enviados ao proprietário para revisão. Você não pode alterar ou excluir itens já cadastrados, mudar descontos nem incluir peças no estoque.';
const message='O checklist pode ser atualizado. Diagnóstico e observação são enviados ao proprietário para revisão; serviços, peças, valores, baixa de estoque e entrega não podem ser alterados.';
const orderReadOnlyActions='.os-grid button:not(#print):not(#toggleOrderChecklist),.os-head button:not(#print):not(#toggleOrderChecklist),#saveOs,#editOrder,#technicalReport,#sendBudget,#readyOrder,#approveBudget,#previousStatus';
const orderReadOnlyFields='.os-grid input,.os-grid textarea,.os-grid select,.os-grid canvas,.os-head select';
const orderReadOnlyMessage='Modo espectador: esta ordem de serviço está disponível apenas para consulta.';

function restricted(){return!canSaveOrders()}
function lockServiceScreen(){
  if(!hasPermission('createEntries'))document.querySelectorAll('[data-route="entry"]').forEach(element=>element.remove());
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
