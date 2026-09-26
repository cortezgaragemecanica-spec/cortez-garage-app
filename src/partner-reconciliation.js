import {allocatePartnerCommission} from './partner-commission-ledger.js?v=20260919-2';

// Saldos remanescentes confirmados pelo proprietário em 25/09/2026,
// após os pagamentos do fechamento anterior registrados em 19 e 20/09.
export const PARTNER_OPENING = {start:'2026-09-19', balances:{Fabiano:0,Marcelino:298}};
const previousPayments = {Fabiano:{date:'2026-09-20',amount:1890.68},Marcelino:{date:'2026-09-19',amount:1090.02}};
const day = row => String(row.dueDate||row.createdAt||'').slice(0,10);
const cents = value => Math.round((Number(value)||0)*100);
export const partnerEventKey = event => String(event.record?.id||event.id||'');

export function activePartnerConferences(entries=[],partner=''){
  const active=new Map();
  for(const entry of [...entries].sort((a,b)=>String(a.confirmedAt||a.canceledAt||'').localeCompare(String(b.confirmedAt||b.canceledAt||'')))){
    if(entry.partner!==partner)continue;
    const key=String(entry.eventKey||partnerEventKey(entry.event));
    if(!key)continue;
    if(entry.canceledAt)active.delete(key);else if(entry.event)active.set(key,entry);
  }
  return[...active.values()];
}

export function excludedPartnerCommissions(entries=[],partner=''){
  const excluded=new Map();
  for(const entry of [...entries].sort((a,b)=>String(a.excludedAt||a.restoredAt||'').localeCompare(String(b.excludedAt||b.restoredAt||'')))){
    if(entry.partner!==partner)continue;
    const key=String(entry.eventKey||partnerEventKey(entry.event));
    if(!key)continue;
    if(entry.restoredAt)excluded.delete(key);else if(entry.excludedAt)excluded.set(key,entry);
  }
  return[...excluded.values()];
}

export function reconciledPartnerLedger(events,payments,partner,locked=[]){
  const opening=PARTNER_OPENING.balances[partner]||0, issues=[],unique=new Map();
  for(const event of events){
    if(event.date<PARTNER_OPENING.start)continue;
    const key=partnerEventKey(event);
    if(!key){issues.push('Recebimento sem identificação: revisar antes de conferir.');continue}
    if(unique.has(key)){issues.push(`Recebimento repetido ${key}: considerado somente uma vez.`);continue}
    unique.set(key,event);
  }
  for(const saved of locked){
    const key=partnerEventKey(saved),current=unique.get(key);
    if(!current||cents(current.commission)!==cents(saved.commission)||current.date!==saved.date||['real','orderValue','partsCost','laborCommission'].some(field=>cents(current[field])!==cents(saved[field])))issues.push(`O.S. #${saved.order?.number||'—'}: origem alterada após conferência; valor protegido foi mantido.`);
    unique.set(key,saved);
  }
  const previous=previousPayments[partner],historicalPayments=[],activePayments=[];let matched=false;
  for(const payment of [...payments].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
    const prior=day(payment)<PARTNER_OPENING.start,closing=!matched&&previous&&day(payment)===previous.date&&cents(payment.amount)===cents(previous.amount);
    if(closing)matched=true;
    (prior||closing?historicalPayments:activePayments).push(payment);
  }
  if(previous&&!matched)issues.push('Pagamento do fechamento anterior não localizado: conferir o histórico do caixa.');
  const openingEvent={id:`opening-${partner}`,date:'2026-09-18',week:{start:'2026-09-12',end:'2026-09-18'},commission:opening,real:0,opening:true,order:{number:'Saldo confirmado',vehicle:{model:'Fechamento anterior'}},record:{description:'Saldo confirmado pelo proprietário'}};
  const ledger=allocatePartnerCommission([...(opening?[openingEvent]:[]),...unique.values()],activePayments);
  return {...ledger,openingBalance:opening,historicalPayments,issues,lockedCount:locked.length};
}
