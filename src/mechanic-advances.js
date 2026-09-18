export const normalizeCommissionText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function commissionWeekRange(value=new Date()){
  const raw=value instanceof Date?value:String(value||'').slice(0,10),reference=value instanceof Date?new Date(value):new Date(`${raw}T12:00:00`),saturday=new Date(reference);
  saturday.setDate(reference.getDate()-((reference.getDay()+1)%7));
  const friday=new Date(saturday);friday.setDate(saturday.getDate()+6);
  const local=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return{start:local(saturday),end:local(friday)};
}

export function mechanicAdvanceName(description,names=[]){
  const text=` ${normalizeCommissionText(description)} `;
  if(!text.includes(' vale '))return'';
  const candidates=[...new Set(names.filter(Boolean))].sort((a,b)=>normalizeCommissionText(b).length-normalizeCommissionText(a).length);
  const exact=candidates.find(name=>text.includes(` ${normalizeCommissionText(name)} `));
  if(exact)return exact;
  return candidates.find(name=>{const first=normalizeCommissionText(name).split(' ')[0];return first&&text.includes(` ${first} `)})||'';
}

export function mechanicAdvanceRows(records,names,weekStart){
  return records.filter(record=>record.category==='Fluxo de caixa'&&record.kind==='Saída'&&record.status==='Realizado')
    .map(record=>({...record,advanceMechanic:mechanicAdvanceName(record.description,names),advanceWeek:commissionWeekRange(record.dueDate||record.createdAt).start}))
    .filter(record=>record.advanceMechanic&&(!weekStart||record.advanceWeek===weekStart));
}
