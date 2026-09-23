const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function isLuizinhoPaymentDescription(description){
  const text=normalized(description);
  return /\bluiz(?:i)?nho\b/.test(text)&&/\b(?:acerto|pago|pagamento)\b/.test(text);
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
  const linkedWeek=previous.match(/(?:^|-)acerto-luizinho-(\d{4}-\d{2}-\d{2})(?:-|$)/)?.[1]||'',week=targetWeek||linkedWeek||previousLuizinhoWeek(date),marker=apply?`acerto-luizinho-${week}`:'fora-acerto-luizinho';
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

export function allocateLuizinhoPayments(weekRows,payments){
  const weeks=[...(weekRows||[])].map(week=>({...week,paid:0,payments:[]})).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const byStart=new Map(weeks.map(week=>[week.start,week])),allocations=[];
  const ordered=[...(payments||[])].sort((a,b)=>String(a?.vencimento??a?.dueDate??'').localeCompare(String(b?.vencimento??b?.dueDate??'')));
  for(const payment of ordered){
    const description=payment?.descricao??payment?.description,reference=String(payment?.referencia??payment?.reference??''),date=payment?.vencimento??payment?.dueDate??payment?.createdAt;
    if(!isLuizinhoPaymentDescription(description)||reference.includes('fora-acerto-luizinho'))continue;
    let remaining=Math.max(0,Number(payment?.valor??payment?.amount)||0);
    if(remaining<=0)continue;
    const tagged=reference.match(/(?:^|-)acerto-luizinho-(\d{4}-\d{2}-\d{2})(?:-|$)/)?.[1]||'',previous=previousLuizinhoWeek(String(date||'').slice(0,10)),inferred=tagged||previous;
    const preferred=byStart.get(inferred),limit=previous||inferred,eligible=weeks.filter(week=>!limit||String(week.start)<=limit),candidates=[];
    if(preferred)candidates.push(preferred);
    for(const week of eligible)if(week!==preferred)candidates.push(week);
    for(const week of candidates){
      const available=Math.max(0,Number(week.total||0)-week.paid);
      if(available<=.009)continue;
      const amount=Math.min(remaining,available);
      week.paid=Number((week.paid+amount).toFixed(2));
      const applied={payment,weekStart:week.start,amount:Number(amount.toFixed(2))};
      week.payments.push(applied);allocations.push(applied);
      remaining=Number((remaining-amount).toFixed(2));
      if(remaining<=.009)break;
    }
  }
  for(const week of weeks){week.balance=Number(Math.max(0,Number(week.total||0)-week.paid).toFixed(2));week.settled=Number(week.total||0)>0&&week.balance<=.01}
  return{weeks,allocations};
}

export function luizinhoPaymentIsApplied(payment){
  return Boolean(luizinhoPaymentWeek({descricao:payment?.description??payment?.descricao,referencia:payment?.reference??payment?.referencia,vencimento:payment?.dueDate??payment?.vencimento}));
}
