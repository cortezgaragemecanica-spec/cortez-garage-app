import{getSyncConfig,syncDatabase}from'./sync.js';
import{compressImage}from'./image-utils.js';

const DB_KEY='cortez-garage-v1';
const mechanics=['Gustavo','Cortez','Fabio'];
const serviceChecklist=['Serviço conferido','Peças conferidas','Teste de funcionamento','Limpeza do local','Veículo liberado'];
const readDb=()=>{try{return JSON.parse(localStorage.getItem(DB_KEY)||'null')}catch{return null}};
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const blankBudget=()=>({parts:[],services:[],paymentTerms:'',warrantyTerms:'',photos:[],checklist:serviceChecklist.map(label=>({label,ok:false})),mechanicSignature:''});

function currentOrder(){
  const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();
  const db=readDb();
  return{db,order:db?.orders?.find(item=>String(item.number)===number)};
}

function row(type,item={},index=0){
  if(type==='part')return`<tr><td><input data-field="description" value="${escapeHtml(item.description)}" placeholder="Peça utilizada"></td><td><input data-field="quantity" type="number" min="0" step="1" value="${Number(item.quantity||1)}"></td><td><input data-field="value" type="number" min="0" step="0.01" value="${Number(item.value||0)}"></td><td class="line-total">${money(Number(item.quantity||1)*Number(item.value||0))}</td><td><button type="button" class="remove-line" aria-label="Remover peça">×</button></td></tr>`;
  return`<tr><td><input data-field="description" value="${escapeHtml(item.description)}" placeholder="Serviço executado"></td><td><select data-field="mechanic">${mechanics.map(name=>`<option ${item.mechanic===name?'selected':''}>${name}</option>`).join('')}</select></td><td><input data-field="value" type="number" min="0" step="0.01" value="${Number(item.value||0)}"></td><td class="line-total">${money(item.value)}</td><td><button type="button" class="remove-line" aria-label="Remover serviço">×</button></td></tr>`;
}

function budgetHtml(order){
  const budget={...blankBudget(),...(order.budget||{})};
  return`<section class="detail budget-section" id="budgetSection"><div class="budget-title"><div><span class="eyebrow">ORÇAMENTO E EXECUÇÃO</span><h3>Peças, serviços e garantia</h3></div><span class="save-state" id="budgetState"></span></div>
  <h4>Peças utilizadas</h4><div class="budget-table"><table><thead><tr><th>Peça</th><th>Qtd.</th><th>Valor unitário</th><th>Subtotal</th><th></th></tr></thead><tbody id="partsRows">${budget.parts.map((item,index)=>row('part',item,index)).join('')}</tbody></table></div><button type="button" class="secondary add-line" data-add="part">＋ Adicionar peça</button>
  <h4>Serviços executados</h4><div class="budget-table"><table><thead><tr><th>Serviço</th><th>Mecânico</th><th>Valor</th><th>Subtotal</th><th></th></tr></thead><tbody id="servicesRows">${budget.services.map((item,index)=>row('service',item,index)).join('')}</tbody></table></div><button type="button" class="secondary add-line" data-add="service">＋ Adicionar serviço</button>
  <div class="budget-totals"><p><span>Total de peças</span><b id="partsTotal">${money(0)}</b></p><p><span>Total de serviços</span><b id="servicesTotal">${money(0)}</b></p><p class="grand"><span>TOTAL GERAL</span><strong id="budgetTotal">${money(0)}</strong></p></div>
  <div class="grid two"><label><span>Condições de pagamento</span><textarea id="budgetPayment" placeholder="Ex.: 50% na aprovação e saldo na entrega">${escapeHtml(budget.paymentTerms)}</textarea></label><label><span>Termo de garantia</span><textarea id="warrantyTerms" placeholder="Informe prazo, cobertura e condições da garantia">${escapeHtml(budget.warrantyTerms)}</textarea></label></div>
  <h4>Checklist dos serviços executados</h4><div class="service-checklist">${budget.checklist.map((item,index)=>`<label><input type="checkbox" data-check="${index}" ${item.ok?'checked':''}><span>✓</span>${escapeHtml(item.label)}</label>`).join('')}</div>
  <div class="photos"><h4>Fotos dos serviços executados</h4><label class="upload service-photo-upload"><input id="servicePhotos" type="file" accept="image/*" capture="environment" multiple><b>📷 Tirar ou adicionar fotos</b><small>Use a câmera do celular ou escolha imagens existentes</small></label><div id="servicePreviews">${budget.photos.map((photo,index)=>`<figure><img src="${photo}" alt="Foto do serviço"><button type="button" data-remove-photo="${index}">×</button></figure>`).join('')}</div></div>
  <div class="mechanic-signature"><h4>Assinatura do mecânico</h4>${budget.mechanicSignature?`<img src="${budget.mechanicSignature}" alt="Assinatura do mecânico registrada">`:''}<canvas id="mechanicSign" width="640" height="220"></canvas><button type="button" class="link" id="clearMechanicSign">Limpar assinatura</button></div>
  <button type="button" class="primary wide" id="saveBudget">Salvar orçamento e execução</button></section>`;
}

function collectRows(selector,type){return[...document.querySelectorAll(`${selector} tr`)].map(tr=>{const description=tr.querySelector('[data-field="description"]').value.trim(),value=Number(tr.querySelector('[data-field="value"]').value||0);return type==='part'?{description,quantity:Number(tr.querySelector('[data-field="quantity"]').value||0),value}:{description,mechanic:tr.querySelector('[data-field="mechanic"]').value,value}}).filter(item=>item.description)}
function totals(){const parts=collectRows('#partsRows','part'),services=collectRows('#servicesRows','service'),partsTotal=parts.reduce((sum,item)=>sum+item.quantity*item.value,0),servicesTotal=services.reduce((sum,item)=>sum+item.value,0);document.querySelector('#partsTotal').textContent=money(partsTotal);document.querySelector('#servicesTotal').textContent=money(servicesTotal);document.querySelector('#budgetTotal').textContent=money(partsTotal+servicesTotal);[...document.querySelectorAll('#partsRows tr')].forEach(tr=>tr.querySelector('.line-total').textContent=money(Number(tr.querySelector('[data-field="quantity"]').value||0)*Number(tr.querySelector('[data-field="value"]').value||0)));[...document.querySelectorAll('#servicesRows tr')].forEach(tr=>tr.querySelector('.line-total').textContent=money(tr.querySelector('[data-field="value"]').value))}

function setupCanvas(canvas){const ctx=canvas.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#111';let drawing=false;const point=event=>{const rect=canvas.getBoundingClientRect(),touch=event.touches?.[0]||event;return{x:(touch.clientX-rect.left)*canvas.width/rect.width,y:(touch.clientY-rect.top)*canvas.height/rect.height}};const start=event=>{drawing=true;const p=point(event);ctx.beginPath();ctx.moveTo(p.x,p.y);canvas.dataset.changed='1';event.preventDefault()};const move=event=>{if(!drawing)return;const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke();event.preventDefault()};['pointerdown','touchstart'].forEach(name=>canvas.addEventListener(name,start,{passive:false}));['pointermove','touchmove'].forEach(name=>canvas.addEventListener(name,move,{passive:false}));['pointerup','pointercancel','touchend'].forEach(name=>canvas.addEventListener(name,()=>drawing=false));return ctx}

function wire(order,db){
  let photos=[...((order.budget||{}).photos||[])];const canvas=document.querySelector('#mechanicSign'),ctx=setupCanvas(canvas);
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{const body=document.querySelector(button.dataset.add==='part'?'#partsRows':'#servicesRows');body.insertAdjacentHTML('beforeend',row(button.dataset.add));totals()});
  document.querySelector('#budgetSection').addEventListener('input',totals);document.querySelector('#budgetSection').addEventListener('click',event=>{const remove=event.target.closest('.remove-line');if(remove){remove.closest('tr').remove();totals()}const photo=event.target.closest('[data-remove-photo]');if(photo){photos.splice(Number(photo.dataset.removePhoto),1);order.budget={...(order.budget||{}),photos};localStorage.setItem(DB_KEY,JSON.stringify(db));mount(true)}});
  document.querySelector('#servicePhotos').onchange=async event=>{try{for(const file of event.target.files)photos.push(await compressImage(file));order.budget={...(order.budget||{}),photos};localStorage.setItem(DB_KEY,JSON.stringify(db));mount(true)}catch(error){alert(error.message)}};
  document.querySelector('#clearMechanicSign').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.changed='1'};
  document.querySelector('#saveBudget').onclick=async()=>{const button=document.querySelector('#saveBudget'),state=document.querySelector('#budgetState'),parts=collectRows('#partsRows','part'),services=collectRows('#servicesRows','service'),partsTotal=parts.reduce((sum,item)=>sum+item.quantity*item.value,0),servicesTotal=services.reduce((sum,item)=>sum+item.value,0),previous=order.budget||{};order.budget={parts,services,partsTotal,servicesTotal,total:partsTotal+servicesTotal,paymentTerms:document.querySelector('#budgetPayment').value.trim(),warrantyTerms:document.querySelector('#warrantyTerms').value.trim(),photos,checklist:[...document.querySelectorAll('[data-check]')].map(input=>({label:serviceChecklist[Number(input.dataset.check)],ok:input.checked})),mechanicSignature:canvas.dataset.changed?canvas.toDataURL():previous.mechanicSignature||''};button.disabled=true;state.textContent='Salvando…';localStorage.setItem(DB_KEY,JSON.stringify(db));try{const config=getSyncConfig();if(config){const synced=await syncDatabase(db,config);localStorage.setItem(DB_KEY,JSON.stringify(synced))}state.textContent='Salvo e sincronizado';setTimeout(()=>state.textContent='',2500)}catch(error){state.textContent='Salvo neste aparelho; sincronização pendente';alert(error.message)}finally{button.disabled=false}};
  totals();
}

function mount(preserveScroll=false){const target=document.querySelector('.os-grid>div'),existing=document.querySelector('#budgetSection'),{db,order}=currentOrder();if(!target||!order)return;const previousScroll=window.scrollY;if(existing)existing.remove();target.insertAdjacentHTML('beforeend',budgetHtml(order));wire(order,db);if(preserveScroll)window.scrollTo(0,previousScroll)}

new MutationObserver(()=>{if(document.querySelector('.os-grid')&&!document.querySelector('#budgetSection'))mount()}).observe(document.querySelector('#app'),{childList:true,subtree:true});
mount();

