import{allocatePartnerCommission}from'./partner-commission-ledger.js?v=20261003-3';

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
  const payments=(ledger.payments||[]).filter(item=>partnerCommissionWeek(item.dueDate||item.createdAt).start===selectedWeek);
  const weekly=allocatePartnerCommission(events,payments);
  return{
    events:weekly.events,
    rows:weekly.open,
    generated:weekly.generatedTotal,
    paid:weekly.appliedTotal,
    outstanding:weekly.outstandingTotal,
    otherOutstanding:0,
    totalOutstanding:weekly.outstandingTotal
  };
}

export function expiredPartnerCommissionWeeks(ledger={},currentWeekStart=''){
  const weeks=new Map();
  for(const item of ledger.events||[]){
    const start=weekStart(item);
    if(!start||start>=currentWeekStart)continue;
    const end=String(item?.week?.end||partnerCommissionWeek(item.date).end).slice(0,10);
    const entry=weeks.get(start)||{weekStart:start,weekEnd:end,events:[]};
    entry.events.push(item);
    weeks.set(start,entry);
  }
  return[...weeks.values()].map(entry=>{
    const payments=(ledger.payments||[]).filter(item=>partnerCommissionWeek(item.dueDate||item.createdAt).start===entry.weekStart);
    const weekly=allocatePartnerCommission(entry.events,payments);
    return{weekStart:entry.weekStart,weekEnd:entry.weekEnd,amount:value(weekly.outstandingTotal)};
  }).filter(item=>item.amount>.009).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
}
