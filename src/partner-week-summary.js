const value=number=>Math.round((Number(number)||0)*100)/100;
const weekStart=item=>String(typeof item?.week==='string'?item.week:item?.week?.start||'').slice(0,10);
const localDate=input=>{if(input instanceof Date)return new Date(input);const[year,month,day]=String(input||'').slice(0,10).split('-').map(Number);return new Date(year,month-1,day,12)};
const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function partnerCommissionWeek(input=new Date()){
  const date=localDate(input),day=date.getDay();
  date.setDate(date.getDate()+(day===0?1:1-day));
  const end=new Date(date);end.setDate(date.getDate()+5);
  return{start:iso(date),end:iso(end)};
}

export function summarizePartnerCommissionWeek(ledger={},selectedWeek=''){
  const events=(ledger.events||[]).filter(item=>!item.opening&&weekStart(item)===selectedWeek);
  const rows=(ledger.open||[]).filter(item=>!item.opening&&weekStart(item)===selectedWeek);
  const otherOpen=(ledger.open||[]).filter(item=>weekStart(item)!==selectedWeek);
  return{
    events,
    rows,
    generated:value(events.reduce((sum,item)=>sum+Number(item.commission||0),0)),
    paid:value(events.reduce((sum,item)=>sum+Number(item.paid||0),0)),
    outstanding:value(rows.reduce((sum,item)=>sum+Number(item.remaining||0),0)),
    otherOutstanding:value(otherOpen.reduce((sum,item)=>sum+Number(item.remaining||0),0)),
    totalOutstanding:value(ledger.outstandingTotal)
  };
}

export function expiredPartnerCommissionWeeks(ledger={},currentWeekStart=''){
  const weeks=new Map();
  for(const item of ledger.open||[]){
    const start=weekStart(item);
    if(!start||start>=currentWeekStart)continue;
    const end=String(item?.week?.end||partnerCommissionWeek(item.date).end).slice(0,10);
    const entry=weeks.get(start)||{weekStart:start,weekEnd:end,amount:0};
    entry.amount=value(entry.amount+Number(item.remaining||0));
    weeks.set(start,entry);
  }
  return[...weeks.values()].filter(item=>item.amount>.009).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
}
