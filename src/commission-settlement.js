import{mechanicCommissionWeekStart}from'./mechanic-saturday.js?v=20261003-2';

const number=value=>Number(value)||0;
const text=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export const commissionSettlementWeek=(value,mechanic='')=>mechanicCommissionWeekStart(mechanic,value);

function personIn(description,names,requiredWord){
  const normalized=` ${text(description)} `;
  if(!normalized.includes(` ${requiredWord} `)&&!(requiredWord==='comissao'&&normalized.includes(' comissoes ')))return'';
  return[...new Set(names.filter(Boolean))].sort((a,b)=>text(b).length-text(a).length).find(name=>normalized.includes(` ${text(name)} `))||'';
}

const category=row=>row.categoria||row.category;
const kind=row=>row.movimento||row.kind;
const status=row=>row.status;
const description=row=>row.descricao||row.description;
const amount=row=>number(row.valor??row.amount);
const mechanic=row=>row.mecanico||row.mechanic||'';
const dueDate=row=>row.vencimento||row.dueDate||row.criado_em||row.createdAt;
const week=row=>row.semana_inicio||row.weekStart||commissionSettlementWeek(dueDate(row),mechanic(row));

export function planMechanicCommissionSettlements(rows,names){
  const normalizedNames=new Map(names.filter(Boolean).map(name=>[text(name),name])),groups=new Map();
  const group=(name,weekStart)=>{const key=`${text(name)}|${weekStart}`;if(!groups.has(key))groups.set(key,{name,weekStart,pending:[],realized:0,payments:0,advances:0});return groups.get(key)};
  for(const row of rows){
    if(category(row)!=='Comissões')continue;const name=normalizedNames.get(text(mechanic(row)));if(!name)continue;const entry=group(name,week(row));if(status(row)==='Realizado')entry.realized+=amount(row);else entry.pending.push(row)
  }
  for(const row of rows){
    if(category(row)!=='Fluxo de caixa'||kind(row)!=='Saída'||status(row)!=='Realizado')continue;
    const paymentPerson=personIn(description(row),names,'comissao'),advancePerson=personIn(description(row),names,'vale'),name=paymentPerson||advancePerson;if(!name)continue;
    const weekStart=commissionSettlementWeek(dueDate(row),name);
    const entry=group(name,weekStart);if(paymentPerson)entry.payments+=amount(row);else entry.advances+=amount(row)
  }
  const fullIds=[],partial=[];
  for(const entry of groups.values()){
    let available=Math.max(0,entry.payments+entry.advances-entry.realized);
    entry.pending.sort((a,b)=>String(dueDate(a)).localeCompare(String(dueDate(b)))||String(a.id).localeCompare(String(b.id)));
    for(const row of entry.pending){const value=amount(row);if(available<=.009)break;if(available+0.009>=value){fullIds.push(row.id);available-=value}else{const paid=Number(available.toFixed(2)),remaining=Number((value-paid).toFixed(2));partial.push({row,paid,remaining});available=0}}
  }
  return{fullIds,partial};
}
