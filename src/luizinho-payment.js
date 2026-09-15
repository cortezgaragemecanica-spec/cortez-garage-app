const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function isLuizinhoPaymentDescription(description){
  const text=normalized(description);
  return /\bluizinho\b/.test(text)&&/\b(?:pago|pagamento)\b/.test(text);
}

export function previousLuizinhoWeek(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return'';
  const day=new Date(`${date}T12:00:00`);
  if(Number.isNaN(day.getTime()))return'';
  const weekday=day.getDay();
  day.setDate(day.getDate()-(weekday===0?6:weekday-1)-7);
  return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
}

export function luizinhoPaymentReference(reference,date,apply,id,targetWeek=''){
  const previous=String(reference||''),payable=previous.match(/^pagamento-conta-([a-f0-9-]{36})-/i);
  const prefix=payable?`pagamento-conta-${payable[1]}-`:'pagamento-';
  const linkedWeek=payable?previous.match(/(?:^|-)acerto-luizinho-(\d{4}-\d{2}-\d{2})(?:-|$)/)?.[1]||'':'',week=targetWeek||linkedWeek||previousLuizinhoWeek(date),marker=apply?`acerto-luizinho-${week}`:'fora-acerto-luizinho';
  if(apply&&!week)throw new Error('Informe uma data válida para o pagamento do acerto Luizinho.');
  return `${prefix}${marker}-${id}`;
}

export function luizinhoPaymentWeek(payment){
  if(!isLuizinhoPaymentDescription(payment?.descricao))return'';
  const reference=String(payment?.referencia||'');
  if(reference.includes('fora-acerto-luizinho'))return'';
  const tagged=reference.match(/(?:^|-)acerto-luizinho-(\d{4}-\d{2}-\d{2})(?:-|$)/);
  return tagged?tagged[1]:previousLuizinhoWeek(payment?.vencimento);
}

export function luizinhoPaymentIsApplied(payment){
  return Boolean(luizinhoPaymentWeek({descricao:payment?.description??payment?.descricao,referencia:payment?.reference??payment?.referencia,vencimento:payment?.dueDate??payment?.vencimento}));
}
