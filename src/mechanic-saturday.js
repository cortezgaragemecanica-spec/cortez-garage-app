const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const SATURDAY_MECHANICS=new Set(['gustavo','tony']);

const localDate=value=>{
  if(value instanceof Date)return new Date(value);
  const raw=String(value||'').slice(0,10),[year,month,day]=raw.split('-').map(Number);
  return new Date(year,month-1,day,12,0,0,0)
};
const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export const hasSaturdaySchedule=mechanic=>SATURDAY_MECHANICS.has(normalized(mechanic));
export const isSaturday=value=>localDate(value).getDay()===6;
export const mechanicWorksOnDate=(mechanic,value)=>{
  const day=localDate(value).getDay();
  return day!==0&&(day!==6||hasSaturdaySchedule(mechanic))
};
export function commissionWeekStart(value=new Date()){
  const date=localDate(value),day=date.getDay();
  date.setDate(date.getDate()-((day+1)%7));
  return iso(date)
}
export function mechanicCommissionWeekStart(mechanic,value=new Date()){
  if(!hasSaturdaySchedule(mechanic))return commissionWeekStart(value);
  const date=localDate(value),day=date.getDay();
  date.setDate(date.getDate()-(day===0?6:day-1));
  return iso(date)
}
export function mechanicCommissionWeekEnd(mechanic,value=new Date()){
  const date=localDate(mechanicCommissionWeekStart(mechanic,value));
  date.setDate(date.getDate()+(hasSaturdaySchedule(mechanic)?5:6));
  return iso(date)
}
