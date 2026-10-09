import{readSupplierSettlements,saveLuizinhoReturn,updateLuizinhoReturn,deleteLuizinhoReturn}from'./supabase.js?v=20261009-5';
import{defaultLuizinhoReturnWeek,isLuizinhoReturnArchived}from'./luizinho-payment.js?v=20261006-1';

const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const itemKey=item=>`${normalize(item?.code)}|${normalize(item?.description)}|${normalize(item?.brand)}`;
let settlements=null,loading=null,renderQueued=false,showArchivedReturns=false;

const localDateOnly=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;

async function loadSettlements(force=false){
  if(settlements&&!force)return settlements;
  if(loading)return loading;
  loading=readSupplierSettlements().then(value=>settlements=value).finally(()=>loading=null);
  return loading;
}

function activeLuizinhoArea(){
  const area=document.querySelector('#financeArea');
  return area&&area.querySelector('[data-supplier="luizinho"].active')?area:null;
}

function returnGroups(){
  const groups=new Map();
  for(const item of settlements?.luizinhoReturns||[]){
    const id=item.batchId||item.id,group=groups.get(id)||{id,date:item.date,creditWeek:item.creditWeek,createdAt:item.createdAt,items:[],amount:0};
    group.items.push(item);group.amount+=Number(item.amount||0);groups.set(id,group);
  }
  return[...groups.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));
}

function renderHistory(area){
  const allGroups=returnGroups(),today=localDateOnly(new Date()),archived=allGroups.filter(group=>isLuizinhoReturnArchived(group.creditWeek,today)),current=allGroups.filter(group=>!isLuizinhoReturnArchived(group.creditWeek,today)),groups=showArchivedReturns?archived:current,signature=JSON.stringify([showArchivedReturns,...allGroups.map(group=>[group.id,group.items.map(item=>item.updatedAt),group.creditWeek])]);
  if(area.dataset.luizinhoReturnSignature===signature&&area.querySelector('.luizinho-returns-panel'))return;
  area.dataset.luizinhoReturnSignature=signature;
  area.querySelector('.luizinho-returns-panel')?.remove();
  const panel=document.createElement('section');
  panel.className='luizinho-returns-panel';
  panel.innerHTML=`<div class="luizinho-returns-head"><div><h4>Devoluções e créditos</h4><p>Ao encerrar a semana do crédito, a devolução é arquivada automaticamente.</p></div><b>${money(groups.reduce((sum,group)=>sum+group.amount,0))}</b></div><div class="cash-account-tabs return-period-tabs"><button type="button" data-return-period="current" class="${showArchivedReturns?'':'active'}">Atuais e programadas (${current.length})</button><button type="button" data-return-period="archived" class="${showArchivedReturns?'active':''}">Arquivadas (${archived.length})</button></div><div class="table-card finance-table"><table><thead><tr><th>Devolução</th><th>Itens e notas</th><th>Qtd.</th><th>Crédito</th><th>Semana do crédito</th><th></th></tr></thead><tbody>${groups.length?groups.map(group=>`<tr><td>${date(group.date)}</td><td><div class="return-history-items">${group.items.map(item=>`<span><b>${esc(item.code||'Sem código')} · ${esc(item.description)}</b><small>Nota de ${date(item.noteDate)}${item.vehicle?` · ${esc(item.vehicle)}`:''}</small></span>`).join('')}</div></td><td>${group.items.reduce((sum,item)=>sum+Number(item.quantity||0),0)}<small>${group.items.length} item(ns)</small></td><td><b>${money(group.amount)}</b></td><td>${date(group.creditWeek)}</td><td><div class="finance-row-actions"><button class="secondary edit-luizinho-return" data-return-id="${esc(group.id)}">Editar</button><button class="danger delete-luizinho-return" data-return-id="${esc(group.id)}">Excluir</button></div></td></tr>`).join(''):`<tr><td colspan="6">${showArchivedReturns?'Nenhuma devolução arquivada.':'Nenhuma devolução atual ou programada.'}</td></tr>`}</tbody></table></div>`;
  const paymentsHeading=[...area.querySelectorAll('h4')].find(item=>item.textContent.includes('Pagamentos identificados'));
  if(paymentsHeading)paymentsHeading.before(panel);else area.append(panel);
  panel.querySelectorAll('[data-return-period]').forEach(button=>button.onclick=()=>{showArchivedReturns=button.dataset.returnPeriod==='archived';renderHistory(area)});
  panel.querySelectorAll('.edit-luizinho-return').forEach(button=>button.onclick=()=>openReturnPopup(groups.find(group=>group.id===button.dataset.returnId)));
  panel.querySelectorAll('.delete-luizinho-return').forEach(button=>button.onclick=()=>removeReturn(groups.find(group=>group.id===button.dataset.returnId),button));
}

async function enhance(){
  const area=activeLuizinhoArea();
  if(!area)return;
  const head=area.querySelector('.finance-area-head');
  if(head&&!head.querySelector('.luizinho-return-button')){
    const actions=document.createElement('div');
    actions.className='supplier-return-actions';
    const noteButton=head.querySelector('.add-supplier');
    if(noteButton)actions.append(noteButton);
    actions.insertAdjacentHTML('beforeend','<button type="button" class="secondary luizinho-return-button">↩ Devolução</button>');
    head.append(actions);
    actions.querySelector('.luizinho-return-button').onclick=()=>openReturnPopup();
  }
  try{await loadSettlements();if(area.isConnected&&area===activeLuizinhoArea())renderHistory(area)}catch{}
}

function noteItems(excludeBatchId=''){
  const returned=(settlements?.luizinhoReturns||[]).filter(item=>item.batchId!==excludeBatchId),result=[];
  for(const note of settlements?.luizinho||[])for(const item of note.items||[]){
    const used=returned.filter(entry=>entry.noteId===note.id&&itemKey(entry)===itemKey(item)).reduce((sum,entry)=>sum+Number(entry.quantity||0),0),available=Math.max(0,Number(item.quantity||0)-used);
    if(available>0)result.push({note,item,available,key:`${note.id}|${itemKey(item)}`});
  }
  return result.sort((a,b)=>String(b.note.date).localeCompare(String(a.note.date)));
}

function openReturnPopup(group=null){
  document.querySelector('.luizinho-return-popup')?.remove();
  const editing=Boolean(group),popup=document.createElement('div'),today=group?.date||new Date().toISOString().slice(0,10),catalog=noteItems(group?.id||'');
  popup.className='check-popup finance-popup luizinho-return-popup';
  popup.innerHTML=`<form class="check-popup-card"><span class="eyebrow">${editing?'EDITAR DEVOLUÇÃO':'NOVA DEVOLUÇÃO'}</span><h3>Devolução ao Luizinho</h3><p>Adicione todos os itens desta devolução. O crédito será somado e as quantidades serão atualizadas no estoque.</p><div class="grid two"><label><span>Data da devolução</span><input id="returnDate" type="date" value="${esc(today)}" required></label><label><span>Crédito no acerto da semana</span><input id="returnCreditWeek" type="date" value="${esc(group?.creditWeek||defaultLuizinhoReturnWeek(today))}" required><small>Você pode escolher a semana que receberá o crédito.</small></label></div><label><span>Buscar código ou descrição</span><input id="returnSearch" autocomplete="off" placeholder="Digite para localizar e adicionar peças" autofocus></label><div id="returnSearchResults" class="return-search-results"><p>Digite o código ou parte da descrição.</p></div><section class="return-cart"><div class="return-cart-head"><b>Itens da devolução</b><span id="returnItemCount">0 itens</span></div><div id="returnSelection" class="return-selection-list"></div></section><div class="return-credit-preview">Crédito total: <b id="returnCreditValue">${money(0)}</b></div><div class="check-popup-actions"><button type="button" class="secondary cancel-return-popup">Cancelar</button><button class="primary" disabled>${editing?'Salvar alterações':'Gerar devolução e retirar do estoque'}</button></div></form>`;
  document.body.append(popup);
  const search=popup.querySelector('#returnSearch'),results=popup.querySelector('#returnSearchResults'),selection=popup.querySelector('#returnSelection'),dateInput=popup.querySelector('#returnDate'),week=popup.querySelector('#returnCreditWeek'),submit=popup.querySelector('button.primary');
  let weekEdited=editing,selected=(group?.items||[]).map(item=>{const entry=catalog.find(candidate=>candidate.note.id===item.noteId&&itemKey(candidate.item)===itemKey(item));return entry?{...entry,quantity:item.quantity}:null}).filter(Boolean);
  const renderSelected=()=>{
    selection.innerHTML=selected.length?selected.map((entry,index)=>`<article class="return-selected-item"><div><b>${esc(entry.item.code||'Sem código')} · ${esc(entry.item.description)}</b><small>Nota de ${date(entry.note.date)} · ${esc(entry.note.vehicle||'Sem veículo')} · máximo ${entry.available}</small></div><label><span>Quantidade</span><input type="number" min="1" max="${entry.available}" step="1" value="${entry.quantity}" data-return-quantity="${index}"></label><strong>${money(Number(entry.quantity||0)*entry.item.unitValue)}</strong><button type="button" class="danger remove-return-item" data-remove-return="${index}" aria-label="Remover item">×</button></article>`).join(''):'<p>Nenhum item adicionado.</p>';
    popup.querySelector('#returnItemCount').textContent=`${selected.length} item(ns)`;
    popup.querySelector('#returnCreditValue').textContent=money(selected.reduce((sum,entry)=>sum+Number(entry.quantity||0)*Number(entry.item.unitValue||0),0));
    submit.disabled=!selected.length;
    selection.querySelectorAll('[data-return-quantity]').forEach(input=>input.onchange=()=>{const index=Number(input.dataset.returnQuantity),maximum=selected[index].available;selected[index].quantity=Math.max(1,Math.min(maximum,Math.trunc(Number(input.value)||1)));renderSelected()});
    selection.querySelectorAll('[data-remove-return]').forEach(button=>button.onclick=()=>{selected.splice(Number(button.dataset.removeReturn),1);renderSelected()});
  };
  const showResults=()=>{const query=normalize(search.value);if(!query){results.innerHTML='<p>Digite o código ou parte da descrição.</p>';return}const matches=catalog.filter(({item})=>normalize(`${item.code} ${item.description} ${item.brand}`).includes(query)).slice(0,30);results.innerHTML=matches.length?matches.map((entry,index)=>`<button type="button" data-result="${index}"><b>＋ ${esc(entry.item.code||'Sem código')} · ${esc(entry.item.description)}</b><small>Nota ${date(entry.note.date)} · ${esc(entry.note.vehicle||'Sem veículo')} · disponível: ${entry.available} · ${money(entry.item.unitValue)}</small></button>`).join(''):'<p>Nenhuma peça disponível encontrada nas notas.</p>';results.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>{const entry=matches[Number(button.dataset.result)];if(!selected.some(item=>item.key===entry.key))selected.push({...entry,quantity:1});search.value='';results.innerHTML='<p>Item adicionado. Busque outra peça ou salve a devolução.</p>';renderSelected()})};
  search.addEventListener('input',showResults);week.addEventListener('input',()=>weekEdited=true);dateInput.addEventListener('change',()=>{if(!weekEdited)week.value=defaultLuizinhoReturnWeek(dateInput.value)});popup.querySelector('.cancel-return-popup').onclick=()=>popup.remove();
  popup.querySelector('form').onsubmit=async event=>{event.preventDefault();if(!selected.length)return;const button=event.submitter,label=button.textContent;button.disabled=true;button.textContent='Salvando…';const record={date:dateInput.value,creditWeek:week.value,items:selected.map(entry=>({noteId:entry.note.id,code:entry.item.code,brand:entry.item.brand,description:entry.item.description,quantity:entry.quantity}))};try{settlements=editing?await updateLuizinhoReturn(group.id,record):await saveLuizinhoReturn(record);popup.remove();document.dispatchEvent(new CustomEvent('cortez:luizinho-returns-updated'));await enhance()}catch(error){button.disabled=false;button.textContent=label;alert(error.message)}};
  renderSelected();
}

async function removeReturn(group,button){
  if(!group||!confirm(`Excluir esta devolução de ${money(group.amount)}?\n\nOs ${group.items.length} item(ns) voltarão ao estoque e o crédito será retirado do acerto.`))return;
  button.disabled=true;button.textContent='Excluindo…';
  try{settlements=await deleteLuizinhoReturn(group.id);document.dispatchEvent(new CustomEvent('cortez:luizinho-returns-updated'));await enhance()}catch(error){button.disabled=false;button.textContent='Excluir';alert(error.message)}
}

document.addEventListener('cortez:luizinho-returns-updated',()=>{settlements=null;loading=null});
new MutationObserver(()=>{if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;enhance()})}).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhance();
