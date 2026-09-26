const number=value=>Math.max(0,Number(value)||0);
const money=value=>Math.round(number(value)*100)/100;
const day=value=>String(value||'').slice(0,10);
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function isFullPartnerCommissionPayment(payment={}){
  const description=normalized(payment.description);
  if(!/\bcomiss(?:ao|oes)\b/.test(description)||/\b(parcial|adiantamento|vale)\b/.test(description))return false;
  return /^(pago|paga)\s+(?:as\s+)?comiss(?:ao|oes)\b/.test(description)||/\b(pagamento integral|quitad[ao]|quitacao)\b/.test(description);
}

function eventAtOrBeforePayment(event,payment){
  const eventTimestamp=String(event.record?.createdAt||event.record?.created_at||'');
  const paymentTimestamp=String(payment.createdAt||payment.created_at||'');
  if(eventTimestamp.includes('T')&&paymentTimestamp.includes('T'))return eventTimestamp<=paymentTimestamp;
  return day(event.date)<=day(payment.dueDate||payment.createdAt||payment.created_at);
}

export function allocatePartnerCommission(events=[],payments=[]){
  const orderedEvents=[...events].map((event,index)=>({...event,commission:money(event.commission),_ledgerOrder:index})).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||a._ledgerOrder-b._ledgerOrder);
  const orderedPayments=[...payments].map((payment,index)=>({...payment,amount:money(payment.amount),_ledgerOrder:index})).sort((a,b)=>String(a.dueDate||a.createdAt||'').localeCompare(String(b.dueDate||b.createdAt||''))||a._ledgerOrder-b._ledgerOrder);
  const paidTotal=money(orderedPayments.reduce((sum,payment)=>sum+payment.amount,0));
  const fullSettlements=orderedPayments.filter(isFullPartnerCommissionPayment);
  let credit=paidTotal;
  const allocated=orderedEvents.map(event=>{
    let paid=money(Math.min(event.commission,credit));
    credit=money(credit-paid);
    const settled=fullSettlements.some(payment=>eventAtOrBeforePayment(event,payment));
    if(settled)paid=event.commission;
    return{...event,paid,remaining:settled?0:money(event.commission-paid),settled};
  });
  const appliedTotal=money(allocated.reduce((sum,event)=>sum+event.paid,0));
  return{
    events:allocated,
    open:allocated.filter(event=>event.remaining>.009),
    payments:orderedPayments,
    generatedTotal:money(allocated.reduce((sum,event)=>sum+event.commission,0)),
    paidTotal,
    appliedTotal,
    settlementAdjustment:money(Math.max(0,appliedTotal-paidTotal)),
    outstandingTotal:money(allocated.reduce((sum,event)=>sum+event.remaining,0)),
    unappliedCredit:money(Math.max(0,credit))
  };
}

export function revalueOpenPartnerCommission(ledger,rate,effectiveDate=''){
  rate=Math.max(0,Number(rate)||0);
  const paymentsBeforeChange=effectiveDate?ledger.payments.filter(payment=>String(payment.dueDate||payment.createdAt||'').slice(0,10)<effectiveDate):ledger.payments;
  const baseline=effectiveDate?allocatePartnerCommission(ledger.events,paymentsBeforeChange):ledger;
  const events=baseline.events.map(event=>{
    if(event.opening||event.remaining<=.009)return event;
    const commission=money(Math.max(0,Number(event.real)||0)*rate);
    return{...event,commission};
  });
  const reallocated=allocatePartnerCommission(events,ledger.payments);
  return{
    ...ledger,
    ...reallocated
  };
}


