import{updateOrderStatus}from'./supabase.js?v=20261010-3';
import{onUiUpdated}from'./ui-events.js?v=20260930-1';

const DB_KEY='cortez-garage-v1';
const PENDING_DB_KEY='cortez-garage-pending-db-v1';
const OUTSIDE_STATUS='Orçamento fora do pátio';

function readDatabase(key=DB_KEY){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function currentOrder(database){
  const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();
  return(database?.orders||[]).find(order=>String(order.number)===number)||null;
}
function updateStoredStatus(status,updatedAt){
  const database=readDatabase();
  const order=currentOrder(database);
  if(!order)return null;
  order.status=status;order.updatedAt=updatedAt||new Date().toISOString();
  localStorage.setItem(DB_KEY,JSON.stringify(database));
  const pending=readDatabase(PENDING_DB_KEY),pendingOrder=currentOrder(pending);
  if(pendingOrder){pendingOrder.status=status;pendingOrder.updatedAt=order.updatedAt;localStorage.setItem(PENDING_DB_KEY,JSON.stringify(pending))}
  document.dispatchEvent(new CustomEvent('cortez:database-updated',{detail:database}));
  return order;
}
function installStatusTracking(){
  const field=document.querySelector('#status');
  if(field&&!field.dataset.confirmedStatus)field.dataset.confirmedStatus=field.value;
}

document.addEventListener('change',async event=>{
  const field=event.target;
  if(field?.id!=='status'||field.value!==OUTSIDE_STATUS)return;
  const previous=field.dataset.confirmedStatus||'Aguardando diagnóstico';
  const order=currentOrder(readDatabase());
  if(!order?.id){field.value=previous;return alert('Não foi possível localizar a O.S. para alterar o status.')}
  const state=document.querySelector('#osSaveState');
  field.disabled=true;if(state)state.textContent='Confirmando status no banco…';
  try{
    await updateOrderStatus(order.id,OUTSIDE_STATUS);
    const updatedAt=new Date().toISOString();updateStoredStatus(OUTSIDE_STATUS,updatedAt);
    field.dataset.confirmedStatus=OUTSIDE_STATUS;
    if(state)state.textContent='Status confirmado no banco';
    const toast=document.querySelector('#toast');if(toast){toast.textContent='O.S. movida para Orçamento fora do pátio';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
  }catch(error){
    field.value=previous;updateStoredStatus(previous);
    if(state)state.textContent='Falha ao alterar status';
    alert(`Não foi possível alterar o status da O.S.\n\n${error.message}`);
  }finally{field.disabled=false}
});

onUiUpdated(installStatusTracking);
