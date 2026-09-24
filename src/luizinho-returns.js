import{readSupplierSettlements,saveLuizinhoReturn,updateLuizinhoReturnWeek}from'./supabase.js?v=20260924-2';
import{defaultLuizinhoReturnWeek}from'./luizinho-payment.js?v=20260924-2';

const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const itemKey=item=>`${normalize(item?.code)}|${normalize(item?.description)}|${normalize(item?.brand)}`;
let settlements=null,loading=null,renderQueued=false;

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

function returnRows(){
  return[...(settlements?.luizinhoReturns||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));
}

function renderHistory(area){
  const signature=JSON.stringify(returnRows().map(item=>[item.id,item.updatedAt,item.creditWeek]));
  if(area.dataset.luizinhoReturnSignature===signature&&area.querySelector('.luizinho-returns-panel'))return;
  area.dataset.luizinhoReturnSignature=signature;
  area.querySelector('.luizinho-returns-panel')?.remove();
  const rows=returnRows(),panel=document.createElement('section');
  panel.className='luizinho-returns-panel';
  panel.innerHTML=`<div class="luizinho-returns-head"><div><h4>Devoluções e créditos</h4><p>A nota original continua cadastrada. O crédito reduz somente o acerto da semana escolhida.</p></div><b>${money(rows.reduce((sum,item)=>sum+Number(item.amount||0),0))}</b></div><div class="table-card finance-table"><table><thead><tr><th>Devolução</th><th>Peça e nota</th><th>Qtd.</th><th>Crédito</th><th>Semana do crédito</th><th></th></tr></thead><tbody>${rows.length?rows.map(item=>`<tr><td>${date(item.date)}</td><td><b>${esc(item.code||'Sem código')} · ${esc(item.description)}</b><small>Nota de ${date(item.noteDate)}${item.vehicle?` · ${esc(item.vehicle)}`:''}</small></td><td>${item.quantity}</td><td><b>${money(item.amount)}</b></td><td>${date(item.creditWeek)}</td><td><button class="secondary change-return-week" data-return-id="${esc(item.id)}">Alterar crédito</button></td></tr>`).join(''):'<tr><td colspan="6">Nenhuma devolução registrada.</td></tr>'}</tbody></table></div>`;
  const paymentsHeading=[...area.querySelectorAll('h4')].find(item=>item.textContent.includes('Pagamentos identificados'));
  if(paymentsHeading)paymentsHeading.before(panel);else area.append(panel);
  panel.querySelectorAll('.change-return-week').forEach(button=>button.onclick=()=>openWeekEditor(rows.find(item=>item.id===button.dataset.returnId)));
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
    actions.querySelector('.luizinho-return-button').onclick=openReturnPopup;
  }
  try{await loadSettlements();if(area.isConnected&&area===activeLuizinhoArea())renderHistory(area)}catch{}
}

function noteItems(){
  const returned=settlements?.luizinhoReturns||[],result=[];
  for(const note of settlements?.luizinho||[])for(const item of note.items||[]){
    const used=returned.filter(entry=>entry.noteId===note.id&&itemKey(entry)===itemKey(item)).reduce((sum,entry)=>sum+Number(entry.quantity||0),0),available=Math.max(0,Number(item.quantity||0)-used);
    if(available>0)result.push({note,item,available});
  }
  return result.sort((a,b)=>String(b.note.date).localeCompare(String(a.note.date)));
}

function openReturnPopup(){
  document.querySelector('.luizinho-return-popup')?.remove();
  const popup=document.createElement('div'),today=new Date().toISOString().slice(0,10);
  popup.className='check-popup finance-popup luizinho-return-popup';
  popup.innerHTML=`<form class="check-popup-card"><span class="eyebrow">NOVA DEVOLUÇÃO</span><h3>Devolução ao Luizinho</h3><p>Busque a peça em uma nota cadastrada. A nota não será alterada e a peça sairá do estoque.</p><div class="grid two"><label><span>Data da devolução</span><input id="returnDate" type="date" value="${today}" required></label><label><span>Buscar código ou descrição</span><input id="returnSearch" autocomplete="off" placeholder="Digite para localizar a peça" autofocus></label></div><div id="returnSearchResults" class="return-search-results"><p>Digite o código ou parte da descrição.</p></div><div id="returnSelection" class="return-selection" hidden></div><div class="grid two"><label><span>Quantidade</span><input id="returnQuantity" type="number" min="1" step="1" value="1" required disabled></label><label><span>Crédito no acerto da semana</span><input id="returnCreditWeek" type="date" value="${defaultLuizinhoReturnWeek(today)}" required><small>Segunda a quarta sugere a semana atual; nos outros dias, a próxima. Você pode mudar.</small></label></div><div class="return-credit-preview">Crédito: <b id="returnCreditValue">${money(0)}</b></div><div class="check-popup-actions"><button type="button" class="secondary cancel-return-popup">Cancelar</button><button class="primary" disabled>Gerar devolução e retirar do estoque</button></div></form>`;
  document.body.append(popup);
  const search=popup.querySelector('#returnSearch'),results=popup.querySelector('#returnSearchResults'),selection=popup.querySelector('#returnSelection'),quantity=popup.querySelector('#returnQuantity'),dateInput=popup.querySelector('#returnDate'),week=popup.querySelector('#returnCreditWeek'),submit=popup.querySelector('button.primary');
  let selected=null,weekEdited=false;
  const refreshCredit=()=>popup.querySelector('#returnCreditValue').textContent=money(selected?Number(quantity.value||0)*selected.item.unitValue:0);
  const showResults=()=>{const query=normalize(search.value);if(!query){results.innerHTML='<p>Digite o código ou parte da descrição.</p>';return}const matches=noteItems().filter(({item})=>normalize(`${item.code} ${item.description}`).includes(query)).slice(0,30);results.innerHTML=matches.length?matches.map((entry,index)=>`<button type="button" data-result="${index}"><b>${esc(entry.item.code||'Sem código')} · ${esc(entry.item.description)}</b><small>Nota ${date(entry.note.date)} · ${esc(entry.note.vehicle||'Sem veículo')} · disponível: ${entry.available} · ${money(entry.item.unitValue)}</small></button>`).join(''):'<p>Nenhuma peça disponível encontrada nas notas.</p>';results.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>{selected=matches[Number(button.dataset.result)];quantity.disabled=false;quantity.max=String(selected.available);quantity.value='1';selection.hidden=false;selection.innerHTML=`<b>${esc(selected.item.code||'Sem código')} · ${esc(selected.item.description)}</b><span>Nota de ${date(selected.note.date)} · ${esc(selected.note.vehicle||'Sem veículo')} · máximo ${selected.available}</span>`;submit.disabled=false;refreshCredit()})};
  search.addEventListener('input',showResults);quantity.addEventListener('input',refreshCredit);week.addEventListener('input',()=>weekEdited=true);dateInput.addEventListener('change',()=>{if(!weekEdited)week.value=defaultLuizinhoReturnWeek(dateInput.value)});popup.querySelector('.cancel-return-popup').onclick=()=>popup.remove();
  popup.querySelector('form').onsubmit=async event=>{event.preventDefault();if(!selected)return;const button=event.submitter;button.disabled=true;button.textContent='Registrando…';try{settlements=await saveLuizinhoReturn({noteId:selected.note.id,code:selected.item.code,brand:selected.item.brand,description:selected.item.description,quantity:Number(quantity.value),date:dateInput.value,creditWeek:week.value});popup.remove();document.dispatchEvent(new CustomEvent('cortez:luizinho-returns-updated'));await enhance()}catch(error){button.disabled=false;button.textContent='Gerar devolução e retirar do estoque';alert(error.message)}};
}

function openWeekEditor(item){
  if(!item)return;
  document.querySelector('.luizinho-return-popup')?.remove();
  const popup=document.createElement('div');popup.className='check-popup finance-popup luizinho-return-popup';
  popup.innerHTML=`<form class="check-popup-card"><span class="eyebrow">ALTERAR CRÉDITO</span><h3>${esc(item.code||'Sem código')} · ${esc(item.description)}</h3><p>Crédito de <b>${money(item.amount)}</b>. Escolha em qual semana ele deve reduzir o acerto.</p><label><span>Semana do crédito</span><input id="returnCreditWeekEdit" type="date" value="${esc(item.creditWeek)}" required><small>Qualquer dia escolhido será ajustado para a segunda-feira daquela semana.</small></label><div class="check-popup-actions"><button type="button" class="secondary cancel-return-popup">Cancelar</button><button class="primary">Salvar destino do crédito</button></div></form>`;document.body.append(popup);popup.querySelector('.cancel-return-popup').onclick=()=>popup.remove();popup.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Salvando…';try{settlements=await updateLuizinhoReturnWeek(item.id,popup.querySelector('#returnCreditWeekEdit').value);popup.remove();document.dispatchEvent(new CustomEvent('cortez:luizinho-returns-updated'));await enhance()}catch(error){button.disabled=false;button.textContent='Salvar destino do crédito';alert(error.message)}};
}

document.addEventListener('cortez:luizinho-returns-updated',()=>{settlements=null;loading=null});
new MutationObserver(()=>{if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;enhance()})}).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhance();

