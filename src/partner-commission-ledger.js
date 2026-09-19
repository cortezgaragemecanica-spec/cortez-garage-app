const number=value=>Math.max(0,Number(value)||0);

export function allocatePartnerCommission(events=[],payments=[]){
  const orderedEvents=[...events].map((event,index)=>({...event,commission:number(event.commission),_ledgerOrder:index})).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||a._ledgerOrder-b._ledgerOrder);
  const orderedPayments=[...payments].map((payment,index)=>({...payment,amount:number(payment.amount),_ledgerOrder:index})).sort((a,b)=>String(a.dueDate||a.createdAt||'').localeCompare(String(b.dueDate||b.createdAt||''))||a._ledgerOrder-b._ledgerOrder);
  const paidTotal=orderedPayments.reduce((sum,payment)=>sum+payment.amount,0);
  let credit=paidTotal;
  const allocated=orderedEvents.map(event=>{
    const paid=Math.min(event.commission,credit);
    credit-=paid;
    return{...event,paid,remaining:Math.max(0,event.commission-paid)};
  });
  return{
    events:allocated,
    open:allocated.filter(event=>event.remaining>.009),
    payments:orderedPayments,
    generatedTotal:allocated.reduce((sum,event)=>sum+event.commission,0),
    paidTotal,
    appliedTotal:allocated.reduce((sum,event)=>sum+event.paid,0),
    outstandingTotal:allocated.reduce((sum,event)=>sum+event.remaining,0),
    unappliedCredit:Math.max(0,credit)
  };
}

export function revalueOpenPartnerCommission(ledger,rate){
  rate=Math.max(0,Number(rate)||0);
  const events=ledger.events.map(event=>{
    if(event.remaining<=.009)return event;
    const commission=Math.max(0,Number(event.real)||0)*rate;
    return{...event,commission,remaining:Math.max(0,commission-event.paid)};
  });
  return{
    ...ledger,
    events,
    open:events.filter(event=>event.remaining>.009),
    generatedTotal:events.reduce((sum,event)=>sum+event.commission,0),
    outstandingTotal:events.reduce((sum,event)=>sum+event.remaining,0)
  };
}
