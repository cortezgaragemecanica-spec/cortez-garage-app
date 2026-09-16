const EXECUTION_STATUSES=new Set(['Em andamento','Aguardando peça','Aguardando peças','Pronto para entrega','Entregue']);

export const isExecutionPdf=order=>EXECUTION_STATUSES.has(order.status);

export function servicePdfSection(order,formatMoney){
  const budgetOnly=!isExecutionPdf(order);
  const services=order.budget?.services||[];
  const rows=services.map(item=>{
    const description=`${item.refused?'RECUSADO — ':''}${item.description||'—'}`;
    const value=item.refused?'R$ 0,00':formatMoney(item.value);
    return budgetOnly?[description,value]:[description,item.mechanic||order.mechanic||'—',value];
  });
  return budgetOnly
    ? {title:'Serviços orçados',headers:['Serviço','Valor'],widths:[850,250],rows}
    : {title:'Serviços executados',headers:['Serviço','Mecânico','Valor'],widths:[650,250,200],rows};
}

export function budgetObservation(order){
  const observation=String(order.services||'').trim();
  const descriptions=(order.budget?.services||[]).map(item=>String(item.description||'').trim()).filter(Boolean);
  if(!observation||!descriptions.length)return observation;
  const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const normalized=normalize(observation);
  return descriptions.some(description=>normalize(description)===normalized)||descriptions.every(description=>normalized.includes(normalize(description)))?'':observation;
}
