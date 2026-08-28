import{saveSupabase}from'./supabase.js';

const DB_KEY='cortez-garage-v1';
const mechanics=['Gustavo','Cortez','Fabio'];
const serviceChecklist=['Serviço conferido','Peças conferidas','Teste de funcionamento','Limpeza do local','Veículo liberado'];
const readDb=()=>{try{return JSON.parse(localStorage.getItem(DB_KEY)||'null')}catch{return null}};
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const blankBudget=()=>({parts:[],services:[],paymentTerms:'',warrantyTerms:'',checklist:serviceChecklist.map(label=>({label,ok:false}))});

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
  <button type="button" class="primary wide" id="saveBudget">Salvar orçamento e execução</button></section>`;
}

function collectRows(selector,type){return[...document.querySelectorAll(`${selector} tr`)].map(tr=>{const description=tr.querySelector('[data-field="description"]').value.trim(),value=Number(tr.querySelector('[data-field="value"]').value||0);return type==='part'?{description,quantity:Number(tr.querySelector('[data-field="quantity"]').value||0),value}:{description,mechanic:tr.querySelector('[data-field="mechanic"]').value,value}}).filter(item=>item.description)}
function totals(){const parts=collectRows('#partsRows','part'),services=collectRows('#servicesRows','service'),partsTotal=parts.reduce((sum,item)=>sum+item.quantity*item.value,0),servicesTotal=services.reduce((sum,item)=>sum+item.value,0);document.querySelector('#partsTotal').textContent=money(partsTotal);document.querySelector('#servicesTotal').textContent=money(servicesTotal);document.querySelector('#budgetTotal').textContent=money(partsTotal+servicesTotal);[...document.querySelectorAll('#partsRows tr')].forEach(tr=>tr.querySelector('.line-total').textContent=money(Number(tr.querySelector('[data-field="quantity"]').value||0)*Number(tr.querySelector('[data-field="value"]').value||0)));[...document.querySelectorAll('#servicesRows tr')].forEach(tr=>tr.querySelector('.line-total').textContent=money(tr.querySelector('[data-field="value"]').value))}

function wire(order,db){
  let autoTimer,saving=false,pending=false;
  const collect=()=>{const parts=collectRows('#partsRows','part'),services=collectRows('#servicesRows','service'),partsTotal=parts.reduce((sum,item)=>sum+item.quantity*item.value,0),servicesTotal=services.reduce((sum,item)=>sum+item.value,0);order.budget={parts,services,partsTotal,servicesTotal,total:partsTotal+servicesTotal,paymentTerms:document.querySelector('#budgetPayment').value.trim(),warrantyTerms:document.querySelector('#warrantyTerms').value.trim(),checklist:[...document.querySelectorAll('[data-check]')].map(input=>({label:serviceChecklist[Number(input.dataset.check)],ok:input.checked}))};order.updatedAt=new Date().toISOString();localStorage.setItem(DB_KEY,JSON.stringify(db))};
  const persist=async(manual=false)=>{collect();const state=document.querySelector('#budgetState'),button=document.querySelector('#saveBudget');if(saving){pending=true;return}saving=true;if(button&&manual)button.disabled=true;if(state)state.textContent='Salvando no banco…';try{const synced=await saveSupabase(db);localStorage.setItem(DB_KEY,JSON.stringify(synced));if(state)state.textContent='Salvo no banco'}catch(error){if(state)state.textContent='Banco pendente';if(manual)alert(error.message)}finally{saving=false;if(button)button.disabled=false;if(pending){pending=false;persist(false)}}};
  const autoSave=()=>{totals();collect();const state=document.querySelector('#budgetState');if(state)state.textContent='Alteração pendente…';clearTimeout(autoTimer);autoTimer=setTimeout(()=>persist(false),500)};
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{const body=document.querySelector(button.dataset.add==='part'?'#partsRows':'#servicesRows');body.insertAdjacentHTML('beforeend',row(button.dataset.add));autoSave()});
  document.querySelector('#budgetSection').addEventListener('input',autoSave);document.querySelector('#budgetSection').addEventListener('change',autoSave);document.querySelector('#budgetSection').addEventListener('click',event=>{const remove=event.target.closest('.remove-line');if(remove){remove.closest('tr').remove();autoSave()}});
  document.querySelector('#saveBudget').onclick=()=>persist(true);totals();
}

function mount(preserveScroll=false){const target=document.querySelector('.os-grid>div'),existing=document.querySelector('#budgetSection'),{db,order}=currentOrder();if(!target||!order)return;const previousScroll=window.scrollY;if(existing)existing.remove();target.insertAdjacentHTML('beforeend',budgetHtml(order));wire(order,db);if(preserveScroll)window.scrollTo(0,previousScroll)}

new MutationObserver(()=>{if(document.querySelector('.os-grid')&&!document.querySelector('#budgetSection'))mount()}).observe(document.querySelector('#app'),{childList:true,subtree:true});
mount();

