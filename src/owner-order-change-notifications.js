import{getCurrentUser}from'./supabase.js?v=20261101-1';

const OWNER='cortezgaragemecanica@gmail.com';
const GUSTAVO_EMAILS=new Set(['gust.cribas@gmail.com','gust.ribas@gmail.com','gust.ribas@hotmail.com']);
const DB_KEY='cortez-garage-v1',SNAPSHOT_KEY='cortez-owner-order-snapshot-v1',NOTIFICATION_KEY='cortez-owner-order-change-notifications-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const owner=()=>String(getCurrentUser().email||'').toLowerCase()===OWNER;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const gustavo=user=>GUSTAVO_EMAILS.has(String(user?.email||'').toLowerCase())||normalize(user?.name).split(/\s+/).includes('gustavo');
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const truncate=value=>{const text=String(value??'').trim()||'—';return text.length>140?`${text.slice(0,137)}…`:text};
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const itemSummary=(items,type)=>truncate((items||[]).map(item=>`${Number(item.quantity||1)}× ${item.description||'Item'}${type==='service'&&item.mechanic?` · ${item.mechanic}`:''} · ${money(item.value)}`).join('; '));

export function summarizeOrderChanges(previous,current){
  const changes=[],add=(label,before,after)=>{if(!equal(before,after))changes.push({label,before:truncate(before),after:truncate(after)})};
  add('Status',previous?.status,current?.status);
  add('Mecânico',previous?.mechanic,current?.mechanic);
  add('Reclamação',previous?.complaint,current?.complaint);
  add('Diagnóstico',previous?.diagnosis,current?.diagnosis);
  add('Observações',previous?.services,current?.services);
  add('Forma de pagamento',previous?.payment,current?.payment);
  for(const[field,label]of[['labor','Mão de obra'],['partsValue','Total de peças'],['discount','Desconto'],['total','Total da O.S.']])if(Number(previous?.[field]||0)!==Number(current?.[field]||0))changes.push({label,before:money(previous?.[field]),after:money(current?.[field])});
  if(!equal(previous?.budget?.parts,current?.budget?.parts))changes.push({label:'Peças',before:itemSummary(previous?.budget?.parts,'part'),after:itemSummary(current?.budget?.parts,'part')});
  if(!equal(previous?.budget?.services,current?.budget?.services))changes.push({label:'Serviços',before:itemSummary(previous?.budget?.services,'service'),after:itemSummary(current?.budget?.services,'service')});
  return changes
}

const read=value=>{try{return JSON.parse(localStorage.getItem(value)||'null')}catch{return null}};
const snapshotOrder=order=>({id:order.id,number:order.number,client:order.client,vehicle:order.vehicle,status:order.status,mechanic:order.mechanic,complaint:order.complaint,diagnosis:order.diagnosis,services:order.services,payment:order.payment,labor:order.labor,partsValue:order.partsValue,discount:order.discount,total:order.total,budget:order.budget,updatedAt:order.updatedAt,updatedBy:order.updatedBy});
const writeSnapshot=orders=>localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(Object.fromEntries(orders.map(order=>[order.id,snapshotOrder(order)]))));
const records=()=>Array.isArray(read(NOTIFICATION_KEY))?read(NOTIFICATION_KEY):[];
const saveRecords=value=>localStorage.setItem(NOTIFICATION_KEY,JSON.stringify(value.slice(0,100)));

function closeModal(modal){modal.remove();document.body.classList.remove('modal-open')}
function openNotifications(){
  const items=records(),modal=document.createElement('div');
  modal.className='check-popup owner-order-change-modal';
  modal.innerHTML=`<div class="check-popup-card"><span class="eyebrow">ALTERAÇÕES NAS O.S.</span><h3>Alterações feitas pelo Gustavo</h3><div class="owner-order-change-list">${items.length?items.map(item=>`<article class="detail"><header><b>O.S. #${esc(item.orderNumber)} · ${esc(item.vehicle||'Veículo não informado')}</b><small>${esc(new Date(item.changedAt).toLocaleString('pt-BR'))}</small></header>${item.changes.map(change=>`<p><strong>${esc(change.label)}</strong><span>${esc(change.before)} → ${esc(change.after)}</span></p>`).join('')}</article>`).join(''):'<p class="empty-popup">Nenhuma alteração do Gustavo registrada neste aparelho.</p>'}</div><div class="check-popup-actions"><button type="button" class="secondary close-owner-order-changes">Fechar</button></div></div>`;
  modal.querySelector('.close-owner-order-changes').onclick=()=>closeModal(modal);
  document.body.append(modal);document.body.classList.add('modal-open');
  saveRecords(items.map(item=>({...item,read:true})));renderButton()
}

function renderButton(){
  if(!owner()){document.querySelector('#ownerOrderChangeNotifications')?.remove();return}
  const header=document.querySelector('.header-actions');if(!header)return;
  let button=document.querySelector('#ownerOrderChangeNotifications');
  if(!button){button=document.createElement('button');button.id='ownerOrderChangeNotifications';button.type='button';button.className='part-request-notification';button.onclick=openNotifications;header.prepend(button)}
  const unread=records().filter(item=>!item.read).length;button.innerHTML=`<span aria-hidden="true">✎</span><b>${unread}</b><small>Alterações</small>`;button.classList.toggle('has-pending',unread>0);button.setAttribute('aria-label',`${unread} alterações do Gustavo ainda não visualizadas`)
}

export function checkOwnerOrderChanges(){
  if(!owner())return[];
  const database=read(DB_KEY),orders=Array.isArray(database?.orders)?database.orders:[],previous=read(SNAPSHOT_KEY);
  if(!previous){writeSnapshot(orders);renderButton();return[]}
  const saved=records(),known=new Set(saved.map(item=>item.id)),fresh=[];
  for(const order of orders){const before=previous[order.id],actor=order.updatedBy;if(!before||!gustavo(actor))continue;const changedAt=actor?.at||order.updatedAt||'',id=`${order.id}:${changedAt}`;if(!changedAt||known.has(id))continue;const changes=summarizeOrderChanges(before,order);if(!changes.length)continue;fresh.push({id,orderId:order.id,orderNumber:order.number,vehicle:[order.vehicle?.plate,order.vehicle?.model].filter(Boolean).join(' · '),changedAt,changedBy:actor?.name||'Gustavo',changes,read:false})}
  writeSnapshot(orders);
  if(fresh.length){saveRecords([...fresh,...saved]);const first=fresh[0],summary=first.changes.map(item=>item.label).join(', ');if(window.CortezAndroid?.showNotification)window.CortezAndroid.showNotification(`Gustavo alterou a O.S. #${first.orderNumber}`,summary,Date.now()%100000)}
  renderButton();return fresh
}

if(typeof document!=='undefined'){
  new MutationObserver(renderButton).observe(document.querySelector('#app'),{childList:true,subtree:true});
  addEventListener('focus',()=>setTimeout(checkOwnerOrderChanges,600));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(checkOwnerOrderChanges,600)});
  setInterval(checkOwnerOrderChanges,5000);
  setTimeout(checkOwnerOrderChanges,1200)
}
