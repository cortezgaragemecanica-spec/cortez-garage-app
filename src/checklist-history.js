const DATABASE_KEY='cortez-garage-v1';

const normalizePlate=value=>String(value||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const formatDate=value=>{
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'Data não informada':parsed.toLocaleDateString('pt-BR');
};

function readOrders(){
  try{return JSON.parse(localStorage.getItem(DATABASE_KEY)||'{}').orders||[]}catch{return []}
}

function checklistPanel(order){
  const archived=order.status==='Entregue';
  const panel=document.createElement('details');
  panel.className=`vehicle-checklist ${archived?'is-archived':'is-active'}`;
  panel.open=!archived;

  const summary=document.createElement('summary');
  const title=document.createElement('span');
  const heading=document.createElement('b');
  const date=document.createElement('small');
  const badge=document.createElement('em');
  heading.textContent='Checklist de entrada';
  date.textContent=`Realizado em ${formatDate(order.checklistAt||order.created)}`;
  badge.textContent=archived?'Arquivado':'Ativo';
  title.append(heading,date);
  summary.append(title,badge);
  panel.append(summary);

  const list=document.createElement('div');
  list.className='vehicle-checklist-items';
  (order.checklist||[]).forEach(item=>{
    const row=document.createElement('div');
    row.className=item.ok?'is-checked':'is-clear';
    const label=document.createElement('span');
    label.textContent=`${item.ok?'✓':'—'} ${item.label||'Item do checklist'}`;
    row.append(label);
    const detail=(item.subitems||[]).join(', ')||item.description||'';
    if(detail){const note=document.createElement('small');note.textContent=detail;row.append(note)}
    list.append(row);
  });
  if(order.checklistNotes){const note=document.createElement('p');note.className='vehicle-checklist-note';note.textContent=`Observação: ${order.checklistNotes}`;list.append(note)}
  if(archived){const archive=document.createElement('p');archive.className='vehicle-checklist-archive-date';archive.textContent=`Arquivado em ${formatDate(order.deliveredAt||order.updatedAt||order.created)}`;list.append(archive)}
  panel.append(list);
  return panel;
}

function enhanceChecklistHistory(){
  document.querySelector('[data-route="checks"]')?.remove();

  document.querySelectorAll('.detail').forEach(section=>{
    if(section.querySelector('h3')?.textContent.trim()==='Checklist de entrada')section.remove();
  });

  const history=document.querySelector('.vehicle-history');
  const vehicleTitle=document.querySelector('.vehicle-history-head h2')?.textContent||'';
  if(!history||!vehicleTitle)return;
  const plate=normalizePlate(vehicleTitle.split(' · ')[0]);
  const orders=readOrders().filter(order=>normalizePlate(order.vehicle?.plate)===plate);

  history.querySelectorAll(':scope > article').forEach(article=>{
    if(article.querySelector('.vehicle-checklist'))return;
    const number=article.querySelector('header b')?.textContent.match(/#(.+)/)?.[1]?.trim();
    const order=orders.find(item=>String(item.number)===number);
    if(order?.checklist?.length)article.append(checklistPanel(order));
  });
}

new MutationObserver(enhanceChecklistHistory).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhanceChecklistHistory();

export {checklistPanel,enhanceChecklistHistory,formatDate};
