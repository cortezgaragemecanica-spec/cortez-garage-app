const cents=value=>Math.round((Number(value)||0)*100)/100;
const safeRate=value=>Math.min(100,Math.max(0,Number(value)||0));
const itemKey=(item,index)=>String(item?.id||item?.stockId||item?.description||index);

export const PARTNER_SETTLEMENT_PREFIX='partner-weekly-v2';
export const PARTNER_SETTLEMENT_RATES={Fabiano:25,Marcelino:20};

export function weeklySettlementRows(events=[],weekStart='',drafts=new Map()){
  const grouped=new Map();
  for(const event of events){
    if(String(event?.week?.start||'')!==weekStart||!event?.order?.id)continue;
    const id=String(event.order.id),entry=grouped.get(id)||{order:event.order,events:[]};
    entry.events.push(event);grouped.set(id,entry);
  }
  return[...grouped.values()].map(({order,events:orderEvents})=>{
    const recognized=cents(orderEvents.reduce((sum,event)=>sum+Number(event.grossOrderValue||0),0));
    const received=cents(orderEvents.reduce((sum,event)=>sum+Number(event.orderValue||0),0));
    const cardFee=cents(orderEvents.reduce((sum,event)=>sum+Number(event.cardFee||0),0));
    const mechanicCommission=cents(orderEvents.reduce((sum,event)=>sum+Number(event.laborCommission||0),0));
    const orderTotal=Math.max(0,Number(order.total||0)),ratio=orderTotal?Math.min(1,recognized/orderTotal):1;
    let parts=(order.budget?.parts||[]).filter(item=>!item.refused).map((item,index)=>({
      key:itemKey(item,index),description:String(item.description||`Peça ${index+1}`),quantity:Math.max(1,Number(item.quantity||1)),
      originalCost:cents(Number(item.cost||0)*Math.max(1,Number(item.quantity||1))*ratio)
    }));
    const calculatedParts=cents(orderEvents.reduce((sum,event)=>sum+Number(event.partsCost||0),0));
    if(!parts.length&&calculatedParts>0)parts=[{key:'legacy-parts',description:'Custo de peças salvo na O.S.',quantity:1,originalCost:calculatedParts}];
    const draft=drafts.get(String(order.id))||{},partCosts=draft.partCosts||{};
    parts=parts.map(item=>({...item,cost:cents(partCosts[item.key]??item.originalCost)}));
    const services=(order.budget?.services||[]).filter(item=>!item.refused).map((service,index)=>{
      const value=cents(Number(service.value||0)*ratio),rate=Number.isFinite(Number(service.commissionRate))?Math.min(1,Math.max(0,Number(service.commissionRate))):.5,commission=cents(value*rate);
      return{description:String(service.description||`Serviço ${index+1}`),value,commission,net:cents(value-commission)};
    });
    const rates={Fabiano:safeRate(draft.rates?.Fabiano??PARTNER_SETTLEMENT_RATES.Fabiano),Marcelino:safeRate(draft.rates?.Marcelino??PARTNER_SETTLEMENT_RATES.Marcelino)};
    const partsCost=cents(parts.reduce((sum,item)=>sum+item.cost,0)),totalCost=cents(partsCost+mechanicCommission+cardFee),grossProfit=cents(Math.max(0,recognized-totalCost)),base=grossProfit;
    return{order,weekStart,received,recognized,cardFee,mechanicCommission,parts,services,partsCost,totalCost,grossProfit,base,rates,commissions:{Fabiano:cents(base*rates.Fabiano/100),Marcelino:cents(base*rates.Marcelino/100)}};
  }).sort((a,b)=>String(a.order.number).localeCompare(String(b.order.number),undefined,{numeric:true}));
}

export function settlementTotals(rows=[]){return rows.reduce((sum,row)=>({received:cents(sum.received+row.received),parts:cents(sum.parts+row.partsCost),services:cents(sum.services+row.services.reduce((value,item)=>value+item.net,0)),cost:cents(sum.cost+row.totalCost),base:cents(sum.base+row.base),Fabiano:cents(sum.Fabiano+row.commissions.Fabiano),Marcelino:cents(sum.Marcelino+row.commissions.Marcelino)}),{received:0,parts:0,services:0,cost:0,base:0,Fabiano:0,Marcelino:0})}

