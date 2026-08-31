import{canManageServices}from'./supabase.js';

const blockedActions='.add-line,.remove-line,#includePart,#approveBudget,#previousStatus,#saveBudget,#saveOs';
const protectedFields='#services,#parts,#labor,#partsValue,#discount,#payment,#budgetSection input,#budgetSection textarea,#budgetSection select';
const message='Seu usuário possui acesso de consulta. Serviços, peças, valores, baixa de estoque e entrega não podem ser alterados.';

function restricted(){return!canManageServices()}
function lockServiceScreen(){
  if(!restricted())return;
  const order=document.querySelector('.os-grid');
  if(!order)return;
  if(!document.querySelector('.access-restricted-note'))order.insertAdjacentHTML('beforebegin',`<div class="access-restricted-note" role="note">🔒 ${message}</div>`);
  document.querySelectorAll(blockedActions).forEach(element=>{element.hidden=true;element.disabled=true});
  document.querySelectorAll(protectedFields).forEach(element=>{element.disabled=true;element.readOnly=true;element.setAttribute('aria-disabled','true')});
  const status=document.querySelector('#status');
  if(status){
    const option=[...status.options].find(item=>item.textContent.trim()==='Entregue');
    if(option&&status.value!=='Entregue')option.remove();
    if(status.value==='Entregue'){status.disabled=true;status.setAttribute('aria-disabled','true')}
  }
}

document.addEventListener('click',event=>{
  if(!restricted()||!event.target.closest(blockedActions))return;
  event.preventDefault();event.stopImmediatePropagation();alert(message);
},true);
document.addEventListener('change',event=>{
  if(!restricted()||event.target.id!=='status'||event.target.value!=='Entregue')return;
  event.preventDefault();event.stopImmediatePropagation();alert('Seu usuário não tem permissão para alterar o status para Entregue.');
},true);
new MutationObserver(lockServiceScreen).observe(document.querySelector('#app'),{childList:true,subtree:true});
lockServiceScreen();
