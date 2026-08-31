import{canManageServices}from'./supabase.js';

const blockedActions='.add-line,.remove-line,#includePart,#approveBudget,#previousStatus,#saveBudget';
const protectedFields='#services,#parts,#labor,#partsValue,#discount,#payment,#budgetSection input:not([data-check]),#budgetSection textarea,#budgetSection select';
const message='Seu usuário possui acesso de consulta. O checklist pode ser atualizado; serviços, peças, valores, baixa de estoque e entrega não podem ser alterados.';

function restricted(){return!canManageServices()}
function lockServiceScreen(){
  const save=document.querySelector('#saveOs'),actions=document.querySelector('.os-head>div:last-child');
  if(save&&actions&&save.parentElement!==actions){save.classList.remove('wide');actions.append(save)}
  if(!restricted())return;
  const order=document.querySelector('.os-grid');
  if(!order)return;
  if(!document.querySelector('.access-restricted-note'))order.insertAdjacentHTML('beforebegin',`<div class="access-restricted-note" role="note">🔒 ${message}</div>`);
  document.querySelectorAll(blockedActions).forEach(element=>{element.hidden=true;element.disabled=true});
  document.querySelectorAll(protectedFields).forEach(element=>{element.disabled=true;element.readOnly=true;element.setAttribute('aria-disabled','true')});
}

document.addEventListener('click',event=>{
  if(!restricted()||!event.target.closest(blockedActions))return;
  event.preventDefault();event.stopImmediatePropagation();alert(message);
},true);
new MutationObserver(lockServiceScreen).observe(document.querySelector('#app'),{childList:true,subtree:true});
lockServiceScreen();
