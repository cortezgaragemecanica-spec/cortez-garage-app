export const SECTORS=Object.freeze({MECHANICAL:'mecanica',ELECTRICAL:'auto_eletrica',UNCLASSIFIED:'nao_classificado',MIXED:'mista'});
export const SECTOR_LABELS=Object.freeze({mecanica:'Mecânica',auto_eletrica:'Auto elétrica',nao_classificado:'Sem setor',mista:'Mecânica + auto elétrica'});
const operational=new Set([SECTORS.MECHANICAL,SECTORS.ELECTRICAL]);
const owner='cortezgaragemecanica@gmail.com';
const money=value=>{const n=Number(value??0);if(!Number.isFinite(n)||n<0)throw new Error('Valor inválido para o setor.');return Math.round(n*100)};
const units=cents=>cents/100;
export function sectorOf(record){return Object.values(SECTORS).includes(record?.sector)?record.sector:SECTORS.UNCLASSIFIED}
export function canViewSector(sector,email){return String(email||'').trim().toLowerCase()===owner||sector===SECTORS.MECHANICAL}
export function requireOperationalSector(sector){if(!operational.has(sector))throw new Error('Escolha Mecânica ou Auto elétrica.');return sector}

// Distribui centavos por maior resto; a soma permanece exatamente igual ao total.
export function allocateSectorAmount(amount,weights){
  const total=money(amount),entries=Object.entries(weights).map(([sector,value])=>[requireOperationalSector(sector),money(value)]),sum=entries.reduce((s,[,value])=>s+value,0);
  if(!sum){if(total)throw new Error('Não é possível dividir o pagamento sem valores por setor.');return Object.fromEntries(entries.map(([s])=>[s,0]))}
  const rows=entries.map(([sector,value])=>({sector,cents:Math.floor(total*value/sum),remainder:total*value%sum}));
  let remaining=total-rows.reduce((s,row)=>s+row.cents,0);
  for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder||a.sector.localeCompare(b.sector))){if(!remaining)break;row.cents++;remaining--}
  return Object.fromEntries(rows.map(row=>[row.sector,units(row.cents)]));
}

export function splitOrderSectors(order){
  const sector=sectorOf(order);
  if(sector===SECTORS.UNCLASSIFIED)throw new Error('Classifique a O.S. antiga antes de distribuir seus valores.');
  const items=[...(order.budget?.parts||[]).filter(x=>!x.refused).map(x=>({...x,kind:'part'})),...(order.budget?.services||[]).filter(x=>!x.refused).map(x=>({...x,kind:'service'}))];
  const result={};
  for(const item of items){
    const selected=requireOperationalSector(item.sector||(sector!==SECTORS.MIXED?sector:''));
    if(sector!==SECTORS.MIXED&&selected!==sector)throw new Error('O setor do item não corresponde ao setor da O.S.');
    const quantity=item.kind==='part'?Number(item.quantity??1):1;
    if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Quantidade inválida.');
    const row=result[selected]||={sector:selected,partsSale:0,partsCost:0,labor:0,mechanicCommissions:0,items:[]};
    const value=units(money(Number(item.value||0)*quantity));
    if(item.kind==='part'){row.partsSale+=value;row.partsCost+=units(money(Number(item.cost||0)*quantity))}
    else {const rate=Number(item.commissionRate??.5);if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('Comissão do mecânico inválida.');row.labor+=value;row.mechanicCommissions+=units(money(value*rate))}
    row.items.push(item);
  }
  if(!items.length&&sector===SECTORS.MIXED)throw new Error('Informe os itens e seus setores antes de dividir a O.S. mista.');
  if(!items.length){result[sector]={sector,partsSale:Number(order.partsValue||0),partsCost:0,labor:Number(order.labor||0),mechanicCommissions:0,items:[]}}
  const allocations=allocateSectorAmount(order.total||0,Object.fromEntries(Object.entries(result).map(([s,row])=>[s,row.partsSale+row.labor])));
  for(const [s,row]of Object.entries(result)){for(const key of ['partsSale','partsCost','labor','mechanicCommissions'])row[key]=units(money(row[key]));row.total=allocations[s]}
  return result;
}

export function partnerSectorCommissions(sector,base,rates={Fabiano:25,Marcelino:20}){
  requireOperationalSector(sector);const cents=money(base);
  if(sector===SECTORS.ELECTRICAL)return{Fabiano:units(Math.round(cents*.45)),Marcelino:0};
  return Object.fromEntries(['Fabiano','Marcelino'].map(name=>{const rate=Number(rates[name]||0);if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Percentual do sócio inválido.');return[name,units(Math.round(cents*rate/100))]}));
}

export function commissionPaymentsBySector(commissions){
  const groups=new Map(),seen=new Set();
  for(const record of commissions){
    if(!record.id||seen.has(record.id))throw new Error('Comissão duplicada ou sem identificação.');seen.add(record.id);
    if(record.status==='Realizado')continue;
    const sector=requireOperationalSector(sectorOf(record)),person=String(record.mechanic||'').trim();
    if(!person)throw new Error('Informe o beneficiário da comissão.');
    if(sector===SECTORS.ELECTRICAL&&person==='Marcelino')throw new Error('Marcelino não recebe comissão da Auto elétrica.');
    const key=JSON.stringify([sector,person]),group=groups.get(key)||{sector,person,amount:0,commissionIds:[]};
    group.amount+=money(record.amount);group.commissionIds.push(record.id);groups.set(key,group);
  }
  return [...groups.values()].map(group=>({...group,amount:units(group.amount)}));
}

export function sectorCashBalances(records){
  const balances={mecanica:0,auto_eletrica:0,nao_classificado:0};
  for(const record of records){if(record.status!=='Realizado'||record.category!=='Fluxo de caixa')continue;const sector=sectorOf(record);if(sector===SECTORS.MIXED)throw new Error('Lançamento de caixa precisa pertencer a um único setor.');balances[sector]+=(record.kind==='Entrada'?1:-1)*money(record.amount)}
  return Object.fromEntries(Object.entries(balances).map(([s,value])=>[s,units(value)]));
}
