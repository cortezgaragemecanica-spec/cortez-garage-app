const moneyCents=value=>Math.max(0,Math.round((Number(value)||0)*100));
const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';

function addMonths(dateText,months){
  const [year,month,day]=dateText.split('-').map(Number),targetMonth=month-1+months,targetYear=year+Math.floor(targetMonth/12),normalizedMonth=((targetMonth%12)+12)%12,lastDay=new Date(Date.UTC(targetYear,normalizedMonth+1,0)).getUTCDate();
  return`${targetYear}-${String(normalizedMonth+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
}

export function suggestedInstallmentDates(count,firstDue=''){
  count=Math.min(24,Math.max(1,Math.trunc(Number(count)||1)));
  if(!isoDate(firstDue)){const date=new Date();date.setDate(date.getDate()+30);firstDue=date.toISOString().slice(0,10)}
  return Array.from({length:count},(_,index)=>addMonths(firstDue,index));
}

export function createInstallmentPlan(amount,count,dueDates=[]){
  count=Math.min(24,Math.max(1,Math.trunc(Number(count)||1)));
  const cents=moneyCents(amount),base=Math.floor(cents/count),remainder=cents-base*count;
  return Array.from({length:count},(_,index)=>({number:index+1,amount:(base+(index<remainder?1:0))/100,dueDate:isoDate(dueDates[index])}));
}

export function normalizeCreditInstallments(credit){
  const amount=Math.max(0,Number(credit?.amount)||0),saved=Array.isArray(credit?.installments)?credit.installments:[];
  if(saved.length){const dates=saved.map(item=>item?.dueDate||''),plan=createInstallmentPlan(amount,saved.length,dates);return plan}
  return amount?createInstallmentPlan(amount,1,[credit?.dueDate||'']):[];
}
