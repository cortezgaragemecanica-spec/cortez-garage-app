const DATABASE_KEY='cortez-garage-v1';
const normalizePhone=value=>String(value||'').replace(/\D/g,'');
const normalizePlate=value=>String(value||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Data não informada':parsed.toLocaleDateString('pt-BR')};

function readDatabase(){
  try{return JSON.parse(localStorage.getItem(DATABASE_KEY)||'{}')}catch{return {}}
}

function text(tag,value,className=''){
  const element=document.createElement(tag);
  if(className)element.className=className;
  element.textContent=value;
  return element;
}

function detailRow(description,secondary,value){
  const row=document.createElement('div');
  row.className='client-order-item';
  const descriptionCell=text('span',description);
  if(secondary)descriptionCell.append(text('small',secondary));
  row.append(descriptionCell,text('b',value));
  return row;
}

function orderDetail(order){
  const panel=document.createElement('details');
  panel.className='client-order-detail';
  const summary=document.createElement('summary');
  const identity=document.createElement('span');
  identity.append(text('b',`O.S. #${order.number}`),text('small',`${date(order.created)} · ${order.status||'Status não informado'}`));
  summary.append(identity,text('strong',money(order.total)));
  panel.append(summary);

  const body=document.createElement('div');
  body.className='client-order-body';
  if(order.complaint)body.append(detailRow('Reclamação do cliente',order.complaint,''));
  if(order.diagnosis)body.append(detailRow('Diagnóstico',order.diagnosis,''));

  const services=(order.budget?.services||[]).filter(item=>!item.refused);
  const serviceSection=document.createElement('section');
  serviceSection.append(text('h4','Serviços executados'));
  if(services.length){
    services.forEach(service=>serviceSection.append(detailRow(service.description||'Serviço',`Mecânico: ${service.mechanic||order.mechanic||'Não informado'}`,money(service.value))));
  }else{
    serviceSection.append(detailRow(order.services||order.complaint||'Serviço não informado',`Mecânico: ${order.mechanic||'Não informado'}`,money(order.labor)));
  }
  body.append(serviceSection);

  const parts=(order.budget?.parts||[]).filter(item=>!item.refused);
  const partSection=document.createElement('section');
  partSection.append(text('h4','Peças e materiais'));
  if(parts.length){
    parts.forEach(part=>{
      const quantity=Math.max(1,Number(part.quantity)||1),unit=Number(part.value)||0;
      const secondary=[part.brand||part.marca,`${quantity} un. × ${money(unit)}`].filter(Boolean).join(' · ');
      partSection.append(detailRow(part.description||'Peça',secondary,money(quantity*unit)));
    });
  }else if(order.parts||Number(order.partsValue)>0){
    partSection.append(detailRow(order.parts||'Peças e materiais','Valor registrado na O.S.',money(order.partsValue)));
  }else partSection.append(text('p','Nenhuma peça registrada.','client-order-empty'));
  body.append(partSection);

  const totals=document.createElement('footer');
  totals.className='client-order-totals';
  [['Serviços',order.labor],['Peças',order.partsValue],['Desconto',-Number(order.discount||0)],['Total',order.total]].forEach(([label,value])=>totals.append(detailRow(label,'',money(value))));
  body.append(totals);
  panel.append(body);
  return panel;
}

function enhanceClientHistory(){
  const eyebrow=document.querySelector('.vehicle-history-head .eyebrow');
  const root=document.querySelector('.vehicle-history');
  if(!root||eyebrow?.textContent.trim()!=='HISTÓRICO DO CLIENTE'||root.dataset.clientHistory==='ready')return;

  const database=readDatabase(),name=document.querySelector('.vehicle-history-head h2')?.textContent.trim()||'',phone=normalizePhone(document.querySelector('.vehicle-history-head p')?.textContent.split(' · ')[0]);
  const clients=database.clients||[],client=(phone?clients.find(item=>normalizePhone(item.phone)===phone):null)||clients.find(item=>item.name===name);
  if(!client)return;
  const orders=(database.orders||[]).filter(order=>order.client?.id===client.id||(phone&&normalizePhone(order.client?.phone)===phone));
  const vehicles=new Map();
  (database.vehicles||[]).filter(vehicle=>vehicle.clientId===client.id).forEach(vehicle=>vehicles.set(normalizePlate(vehicle.plate),{...vehicle,orders:[]}));
  orders.forEach(order=>{
    const plate=normalizePlate(order.vehicle?.plate),key=plate||String(order.vehicle?.id||order.id);
    if(!vehicles.has(key))vehicles.set(key,{...(order.vehicle||{}),orders:[]});
    vehicles.get(key).orders.push(order);
  });

  root.dataset.clientHistory='ready';
  root.replaceChildren();
  [...vehicles.values()].sort((a,b)=>String(a.plate||'').localeCompare(String(b.plate||''),'pt-BR',{sensitivity:'base'})).forEach(vehicle=>{
    const section=document.createElement('section');
    section.className='client-vehicle-history';
    const header=document.createElement('header');
    const identity=document.createElement('div');
    identity.append(text('span','VEÍCULO CADASTRADO','eyebrow'),text('h3',`${vehicle.plate||'Sem placa'} · ${vehicle.model||'Modelo não informado'}`),text('small',[vehicle.year||'Ano não informado',vehicle.color||'Cor não informada'].join(' · ')));
    header.append(identity,text('b',`${vehicle.orders.length} O.S.`));
    section.append(header);
    if(vehicle.orders.length){
      vehicle.orders.sort((a,b)=>new Date(b.created)-new Date(a.created)).forEach(order=>section.append(orderDetail(order)));
    }else section.append(text('p','Nenhuma O.S. registrada para este veículo.','client-order-empty'));
    root.append(section);
  });
}

new MutationObserver(enhanceClientHistory).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhanceClientHistory();

export {enhanceClientHistory,orderDetail};
