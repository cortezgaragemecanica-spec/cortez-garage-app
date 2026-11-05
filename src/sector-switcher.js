import{ACTIVE_SECTOR,ELECTRICAL_SECTOR,SECTOR_TITLE,SECTOR_OWNER}from'./sector-context.js?v=20261105-1';
import{getCurrentUser,readSectorCashOverview,transferSectorCash,allocateSectorExpense}from'./supabase.js?v=20261105-1';
import{onUiUpdated}from'./ui-events.js?v=20260930-1';
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const accounts=['Banco do Brasil','Mercado Livre','Dinheiro'];
const owner=()=>getCurrentUser().email.toLowerCase()===SECTOR_OWNER;
function switchSector(value){
 if(value===ACTIVE_SECTOR)return;
 if(!confirm('Trocar de setor? Salve as alterações abertas antes de continuar.'))return;
 const url=new URL(location.href);url.searchParams.set('sector',value);location.assign(url.href);
}
function install(){
 if(!document.querySelector('aside nav'))return;
 document.documentElement.dataset.sector=ACTIVE_SECTOR;
 document.title=`Cortez Garage · ${SECTOR_TITLE}`;
 let bar=document.querySelector('#sectorContext');
 if(!bar){bar=document.createElement('section');bar.id='sectorContext';bar.className='sector-context';document.querySelector('aside nav').before(bar);
  const name=document.createElement('strong');name.textContent=SECTOR_TITLE;bar.append(name);
  if(owner()){
   const select=document.createElement('select');select.setAttribute('aria-label','Setor da oficina');
   for(const [value,label]of [['mecanica','Mecânica'],['auto_eletrica','Auto elétrica']]){const option=new Option(label,value,value===ACTIVE_SECTOR,value===ACTIVE_SECTOR);select.append(option)}
   select.onchange=()=>{switchSector(select.value);select.value=ACTIVE_SECTOR};bar.append(select);
   const overview=document.createElement('button');overview.className='secondary';overview.textContent='Caixas dos setores';overview.onclick=openOverview;bar.append(overview);
  }
 }
 const header=document.querySelector('header .sector-indicator');
 if(!header){const target=document.querySelector('header h1');if(target){const indicator=document.createElement(owner()?'button':'small');indicator.className='sector-indicator';indicator.textContent=SECTOR_TITLE;if(owner())indicator.onclick=openOverview;target.after(indicator)}}
}
async function openOverview(){
 if(!owner())return;
 document.querySelector('.sector-popup')?.remove();
 const popup=document.createElement('div');popup.className='check-popup sector-popup';
 popup.innerHTML='<section class="check-popup-card sector-overview"><button class="secondary sector-close">Fechar</button><h2>Caixas dos setores</h2><div class="sector-balances">Carregando saldos…</div><p>O histórico anterior permanece na área Mecânica, sem redistribuição automática.</p><div class="sector-operation-tabs"><button class="secondary" data-sector-form="transfer">Transferência entre setores</button><button class="secondary" data-sector-form="expense">Ratear despesa</button></div><div class="sector-operation"></div></section>';
 const switches=document.createElement('div');switches.className='sector-operation-tabs';for(const [value,label]of [['mecanica','Abrir Mecânica'],['auto_eletrica','Abrir Auto elétrica']]){const button=document.createElement('button');button.className='secondary';button.textContent=label;button.disabled=value===ACTIVE_SECTOR;button.onclick=()=>switchSector(value);switches.append(button)}popup.querySelector('h2').after(switches);
 popup.querySelector('.sector-close').onclick=()=>popup.remove();document.body.append(popup);
 popup.querySelectorAll('[data-sector-form]').forEach(button=>button.onclick=()=>operationForm(popup,button.dataset.sectorForm));
 try{await refreshOverview(popup)}catch(error){popup.querySelector('.sector-balances').textContent=error.message}
}
async function refreshOverview(popup){
 const rows=await readSectorCashOverview(),target=popup.querySelector('.sector-balances');if(!target)return;target.replaceChildren();
 let total=0;
 for(const sector of ['mecanica','auto_eletrica']){
  const card=document.createElement('article'),title=document.createElement('h3');title.textContent=sector==='mecanica'?'Mecânica / histórico anterior':'Auto elétrica';card.append(title);
  for(const account of accounts){const value=Number(rows.find(row=>row.sector===sector&&row.account===account)?.balance||0);total+=value;const line=document.createElement('p');line.textContent=`${account}: ${money(value)}`;card.append(line)}target.append(card);
 }
 const consolidated=document.createElement('strong');consolidated.textContent=`Consolidado: ${money(total)}`;target.append(consolidated);
}
function operationForm(popup,type){
 const target=popup.querySelector('.sector-operation'),reference=crypto.randomUUID(),today=new Date().toLocaleDateString('en-CA');
 target.innerHTML=`<form><h3>${type==='transfer'?'Transferir saldo':'Despesa compartilhada'}</h3><label>Descrição<input name="description" required maxlength="160"></label><label>Valor total<input name="amount" type="number" min="0.01" step="0.01" required></label>${type==='transfer'?'<label>Origem<select name="source"><option value="mecanica">Mecânica</option><option value="auto_eletrica">Auto elétrica</option></select></label><label>Caixa<select name="account">'+accounts.map(account=>`<option>${account}</option>`).join('')+'</select></label>':'<label>Percentual da Auto elétrica<input name="rate" type="number" min="0" max="100" step="0.01" required></label><label>Vencimento<input name="dueDate" type="date" required></label><p>Cria contas a pagar nos dois setores. Não movimenta o caixa até o pagamento.</p>'}<button class="primary">${type==='transfer'?'Registrar transferência':'Lançar contas rateadas'}</button><p role="status"></p></form>`;
 if(type==='expense')target.querySelector('[name=dueDate]').value=today;
 target.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget)),button=event.submitter,status=target.querySelector('[role=status]');button.disabled=true;
  try{
   if(type==='transfer')await transferSectorCash({...data,amount:Number(data.amount),reference});
   else await allocateSectorExpense({...data,amount:Number(data.amount),rate:Number(data.rate),reference});
   await refreshOverview(popup);status.textContent='Registrado e confirmado no banco.';
  }catch(error){status.textContent=error.message;button.disabled=false}
 };
}
onUiUpdated(install);
