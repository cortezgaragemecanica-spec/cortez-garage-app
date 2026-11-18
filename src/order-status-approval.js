import {getCurrentUser,isGustavoUser,readOrderStatusRequests,readApprovalOrder,resolveOrderStatusRequest,submitOrderStatusRequest,readStock,finalizeOrderReady,recordOrderDelivery,updateOrderStatus,saveOrderValues} from './supabase.js?v=20261117-1';
import {sectorStorage as storage,matchesDisplayedOrder} from './sector-context.js?v=20261105-2';
import {resolveOrderStockLinks} from './order-stock-links.js?v=20261008-1';
import {onUiUpdated} from './ui-events.js?v=20260930-1';

const owner=()=>getCurrentUser().email.toLowerCase()==='cortezgaragemecanica@gmail.com';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let pending=[],loading=false,loadedAt=0;

async function refresh(){
 if(!owner()){document.querySelector('#statusApprovalNotifications')?.remove();return}
 const header=document.querySelector('.header-actions');
 if(!header||loading||Date.now()-loadedAt<30000)return;
 loading=true;
 try{
  pending=await readOrderStatusRequests();loadedAt=Date.now();
  let button=document.querySelector('#statusApprovalNotifications');
  if(!button){button=document.createElement('button');button.id='statusApprovalNotifications';button.className='secondary';button.onclick=openRequests;header.prepend(button)}
  button.textContent='Aprovar status · '+pending.length;
 }catch(error){console.error('Falha ao consultar solicitações de status',error)}finally{loading=false}
}
function openRequests(){
 document.querySelector('.status-approval-popup')?.remove();
 const popup=document.createElement('div');popup.className='check-popup status-approval-popup';
 popup.innerHTML='<section class="check-popup-card"><h3>Conferência de O.S.</h3><div class="approval-list"></div><button class="secondary close-approval">Fechar</button></section>';
 popup.querySelector('.close-approval').onclick=()=>popup.remove();
 for(const request of pending){
  const item=document.createElement('article');item.innerHTML='<p>Carregando O.S.…</p>';popup.querySelector('.approval-list').append(item);
  readApprovalOrder(request.os_id,request.setor).then(order=>{
   if(!order){item.textContent='O.S. indisponível';return}
   item.innerHTML=`<h4>O.S. #${escape(order.number)} · ${escape(order.vehicle?.plate)} · ${escape(order.vehicle?.model)}</h4>
    <p>Solicitado pelo Gustavo — ${escape(request.destino)}<br>Valor da O.S. ${money(order.total)}<br>${escape(request.pagamento?.cashPayment||'Sem recebimento nesta etapa')}</p>
    <details><summary>Conferir peças e serviços</summary>${[...(order.budget?.parts||[]),...(order.budget?.services||[])].map(line=>`<p>${escape(line.description)} · ${money(Number(line.value||0)*Number(line.quantity||1))}${line.refused?' · recusado':''}</p>`).join('')}</details>
    <button class="primary approve-status">Conferido e aprovar</button><button class="secondary reject-status">Recusar solicitação</button>`;
   item.querySelector('.reject-status').onclick=async()=>{
    try{await resolveOrderStatusRequest(request.id,'Recusado');item.remove();loadedAt=0;await refresh()}catch(error){alert(error.message)}
   };
   item.querySelector('.approve-status').onclick=async event=>{
    if(!confirm('Confirmar a conferência e aprovar '+request.destino+'?'))return;
    const button=event.currentTarget;button.disabled=true;
    try{
     const current=await readApprovalOrder(request.os_id,request.setor);
     if(!current)throw new Error('O.S. não encontrada.');
     if(current.status!==request.destino){
      if(new Date(current.updatedAt).getTime()!==new Date(request.versao).getTime()&&!(request.destino==='Entregue'&&current.closingReceipt?.paymentType===request.pagamento?.cashPayment))throw new Error('A O.S. mudou desde a solicitação. Recuse esta solicitação e peça nova conferência.');
      if(request.destino==='Pronto para entrega'){
       const links=resolveOrderStockLinks(current.budget?.parts||[],await readStock());
       if(links.unresolved.length)throw new Error('Confira o vínculo e o saldo das peças de estoque.');
       await finalizeOrderReady(current,links.selections);
      }else{
       if(current.status!=='Pronto para entrega')throw new Error('A O.S. precisa estar pronta para entrega.');
       const payment=request.pagamento;
       current.payment=payment.payment;
       await recordOrderDelivery(current,payment.cashPayment,payment.credit,payment.card);
       await saveOrderValues(current);
       await updateOrderStatus(current.id,'Entregue');
      }
     }
     await resolveOrderStatusRequest(request.id,'Aprovado');
     item.remove();loadedAt=0;await refresh();alert('Solicitação aprovada e status confirmado.');
    }catch(error){button.disabled=false;alert(error.message)}
   };
  }).catch(error=>{item.textContent=error.message});
 }
 if(!pending.length)popup.querySelector('.approval-list').textContent='Nenhuma solicitação pendente.';
 document.body.append(popup);
}
document.addEventListener('change',async event=>{
 if(event.target?.id!=='status'||!isGustavoUser()||!['Pronto para entrega','Entregue'].includes(event.target.value))return;
 event.stopImmediatePropagation();
 const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();
 const order=(JSON.parse(storage.getItem('cortez-garage-v1')||'{}').orders||[]).find(order=>matchesDisplayedOrder(order,number));
 const desired=event.target.value;event.target.value=order?.status||'Em andamento';
 if(!order)return;
 if(desired==='Entregue'){document.querySelector('#openClosing')?.click();alert('Informe o pagamento no fechamento para solicitar a aprovação.');return}
 try{await submitOrderStatusRequest(order,desired);alert('Solicitação enviada ao proprietário.')}catch(error){alert(error.message)}
},true);
onUiUpdated(refresh);
setInterval(refresh,30000);
