import{calculateOrderTotals}from'./order-surcharge.js';

const money=value=>Math.round((Number(value)||0)*100)/100;
const activePartsTotal=parts=>money(parts.filter(item=>!item?.refused).reduce((sum,item)=>sum+Math.max(1,Number(item?.quantity)||1)*(Number(item?.value)||0),0));
const activeServicesTotal=services=>money(services.filter(item=>!item?.refused).reduce((sum,item)=>sum+(Number(item?.value)||0),0));

export function repairBudgetAgainstOrderTotals(source={},row={}){
  const parts=Array.isArray(source.parts)?source.parts.filter(Boolean).map(item=>({...item})):[];
  const services=Array.isArray(source.services)?source.services.filter(Boolean).map(item=>({...item})):[];
  const expectedParts=money(row.valor_pecas),expectedLabor=money(row.mao_obra);
  let partsTotal=activePartsTotal(parts),servicesTotal=activeServicesTotal(services);
  const missingParts=money(expectedParts-partsTotal),missingLabor=money(expectedLabor-servicesTotal);
  if(missingParts>.009){
    parts.push({description:'Peças e materiais — diferença recuperada',cost:missingParts,margin:0,quantity:1,value:missingParts,refused:false,recovered:true});
    partsTotal=activePartsTotal(parts);
  }
  if(missingLabor>.009){
    services.push({description:'Mão de obra — diferença recuperada',mechanic:String(row.mecanico||''),value:missingLabor,commissionRate:.5,refused:false,recovered:true});
    servicesTotal=activeServicesTotal(services);
  }
  const discount=money(row.desconto),calculated=calculateOrderTotals({partsValue:partsTotal,labor:servicesTotal,discount,surchargeRate:source.surchargeRate});
  return{...source,parts,services,partsTotal,servicesTotal,subtotal:calculated.base,surchargeRate:calculated.surchargeRate,surchargeAmount:calculated.surchargeAmount,total:calculated.total};
}

const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return typeof value==='number'?money(value):value;
};

export function sameSavedBudget(expected,actual){
  return JSON.stringify(stable(expected||null))===JSON.stringify(stable(actual||null));
}
