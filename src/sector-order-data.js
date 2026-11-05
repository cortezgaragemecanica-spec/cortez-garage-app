import{allocateSectorAmount}from'./business-sectors.js';
const operational=new Set(['mecanica','auto_eletrica']);
export const itemSector=(item,order)=>operational.has(item?.sector)?item.sector:order?.sourceSector==='auto_eletrica'||order?.sector==='auto_eletrica'?'auto_eletrica':'mecanica';
export function orderSectors(order){const items=[...(order?.budget?.parts||[]),...(order?.budget?.services||[])].filter(item=>!item.refused);return [...new Set(items.length?items.map(item=>itemSector(item,order)):[order?.sourceSector||order?.sector||'mecanica'])].filter(value=>operational.has(value))}
export const mixedOrder=order=>orderSectors(order).length>1;
export function sectorOrderValues(order){
 const values={mecanica:{parts:0,labor:0},auto_eletrica:{parts:0,labor:0}};
 for(const item of order?.budget?.parts||[])if(!item.refused)values[itemSector(item,order)].parts+=Number(item.value||0)*Number(item.quantity||1);
 for(const item of order?.budget?.services||[])if(!item.refused)values[itemSector(item,order)].labor+=Number(item.value||0);
 if(!(order?.budget?.parts?.length||order?.budget?.services?.length)){const sector=itemSector(null,order);values[sector].parts=Number(order.partsValue||0);values[sector].labor=Number(order.labor||0)}
 const weights=Object.fromEntries(Object.entries(values).map(([sector,value])=>[sector,value.parts+value.labor]));
 const allocation=amount=>allocateSectorAmount(Math.max(0,Number(amount)||0),weights);
 return{values,totals:allocation(order.total),discounts:allocation(order.discount),advances:allocation(order.advance)};
}
export function projectOrderForSector(order,sector){
 const sectors=orderSectors(order);if(!sectors.includes(sector))return null;
 if(sectors.length===1)return{...order,sector,sourceSector:sector};
 const{values,totals,discounts,advances}=sectorOrderValues(order),budget=order.budget||{},parts=(budget.parts||[]).filter(item=>itemSector(item,order)===sector),services=(budget.services||[]).map((item,index)=>({...item,originalIndex:item.originalIndex??index})).filter(item=>itemSector(item,order)===sector);
 const advanceRows=(order.advances||[]).map(item=>({...item,amount:allocateSectorAmount(item.amount,Object.fromEntries(Object.entries(values).map(([s,v])=>[s,v.parts+v.labor])))[sector]}));
 const closingReceipt=order.closingReceipt?{...order.closingReceipt}:null;if(closingReceipt){const weights=Object.fromEntries(Object.entries(values).map(([s,v])=>[s,v.parts+v.labor]));for(const field of ['total','advance','receivedNow','netReceived','creditAmount','cardFeeAmount'])closingReceipt[field]=allocateSectorAmount(order.closingReceipt[field]||0,weights)[sector]}
 return{...order,sector,sourceSector:sector,partsValue:values[sector].parts,labor:values[sector].labor,total:totals[sector],discount:discounts[sector],advance:advances[sector],advances:advanceRows,closingReceipt,budget:{...budget,parts,services,partsTotal:values[sector].parts,servicesTotal:values[sector].labor,total:totals[sector]}};
}
export function mergeSectorOrders(groups){const selected=new Map();for(const group of groups)for(const order of group){const previous=selected.get(order.id);if(!previous||order.sector==='mista'||previous.projectionOnly&&!order.projectionOnly)selected.set(order.id,order)}return [...selected.values()].sort((a,b)=>Number(b.number)-Number(a.number))}
