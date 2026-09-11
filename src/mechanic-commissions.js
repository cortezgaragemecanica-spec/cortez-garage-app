import{agendaMechanicForCurrentUser,confirmCurrentMechanicCommissions,getCurrentUser,readCurrentMechanicCommissions}from'./supabase.js?v=20260911-1';

const OWNER='cortezgaragemecanica@gmail.com';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'):'—';
const eligible=()=>getCurrentUser().email.trim().toLowerCase()!==OWNER&&Boolean(agendaMechanicForCurrentUser());

function installButtons(){
  if(!eligible())return document.querySelectorAll('.mechanic-commission-route').forEach(button=>button.remove());
  const aside=document.querySelector('aside nav'),mobile=document.querySelector('.mobile-nav'),finance=document.querySelector('.home-menu .admin-shortcut');
  if(aside&&!aside.querySelector('.mechanic-commission-route'))aside.insertAdjacentHTML('beforeend','<button type="button" class="mechanic-commission-route"><i>%</i>Minhas comissões</button>');
  if(mobile&&!mobile.querySelector('.mechanic-commission-route'))mobile.insertAdjacentHTML('beforeend','<button type="button" class="mechanic-commission-route"><i>%</i><span>Comissões</span></button>');
  if(finance&&!document.querySelector('.home-menu .mechanic-commission-route'))finance.insertAdjacentHTML('afterend','<button type="button" class="mechanic-commission-route mechanic-commission-shortcut"><i>%</i><span>Comissões</span></button>');
  document.querySelectorAll('.mechanic-commission-route').forEach(button=>button.onclick=open);
}

async function open(){
  document.dispatchEvent(new CustomEvent('cortez:section-opened',{detail:'mechanic-commissions'}));
  document.querySelectorAll('nav button,.mobile-nav button').forEach(button=>button.classList.toggle('active',button.classList.contains('mechanic-commission-route')));
  const title=document.querySelector('header h1'),content=document.querySelector('#content');
  if(title)title.textContent='Minhas comissões';
  if(!content)return;
  content.innerHTML='<div class="empty mechanic-commission-loading"><div>◌</div><h3>Carregando suas comissões…</h3><p>Consultando apenas a semana vigente.</p></div>';
  try{render(await readCurrentMechanicCommissions())}
  catch(error){content.innerHTML=`<div class="empty"><div>!</div><h3>Comissões indisponíveis</h3><p>${esc(error.message)}</p></div>`}
}

function render(data={}){
  const content=document.querySelector('#content'),items=Array.isArray(data.items)?data.items:[];
  if(!content)return;
  content.innerHTML=`<div class="mechanic-commission-head"><div><span class="eyebrow">SOMENTE LEITURA</span><h2>Comissões de ${esc(data.mechanic||agendaMechanicForCurrentUser())}</h2><p>Semana vigente · ${date(data.weekStart)} a ${date(data.weekEnd)}</p></div><article><span>Total da semana</span><b>${money(data.total)}</b></article></div><div class="table-card mechanic-commission-table"><table><thead><tr><th>Data</th><th>O.S.</th><th>Veículo</th><th>Serviço</th><th>Situação</th><th>Comissão</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${date(item.date)}</td><td><b>#${esc(item.orderNumber||'—')}</b></td><td>${esc(item.vehicle||'—')}</td><td>${esc(item.service||'—')}</td><td>${item.status==='Realizado'?'Pago':'Pendente'}</td><td><b>${money(item.amount)}</b></td></tr>`).join(''):'<tr><td colspan="6">Nenhuma comissão nesta semana.</td></tr>'}</tbody></table></div>${data.confirmedAt?`<div class="commission-confirmed">✓ Conferido em ${new Date(data.confirmedAt).toLocaleString('pt-BR')}</div>`:data.canConfirm?'<button type="button" class="primary wide commission-confirm-button" id="confirmMechanicCommission">Conferido</button>':'<p class="commission-window-note">O botão <b>Conferido</b> aparece somente na sexta-feira, das 17h às 21h.</p>'}`;
  document.querySelector('#confirmMechanicCommission')?.addEventListener('click',async event=>{const button=event.currentTarget;if(!confirm('Confirmar que você conferiu as comissões desta semana?'))return;button.disabled=true;button.textContent='Confirmando…';try{await confirmCurrentMechanicCommissions();await open()}catch(error){button.disabled=false;button.textContent='Conferido';alert(error.message)}});
}

new MutationObserver(installButtons).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('cortez:user-access-updated',installButtons);
installButtons();
