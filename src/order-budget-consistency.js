import{calculateOrderTotals}from'./order-surcharge.js';

const money=value=>Math.round((Number(value)||0)*100)/100;
const activePartsTotal=parts=>money(parts.filter(item=>!item?.refused).reduce((sum,item)=>sum+Math.max(1,Number(item?.quantity)||1)*(Number(item?.value)||0),0));
const activeServicesTotal=services=>money(services.filter(item=>!item?.refused).reduce((sum,item)=>sum+(Number(item?.value)||0),0));
const syntheticDescription=/^(?:Peças e materiais|Mão de obra) — (?:diferença recuperada|detalhamento pendente)$/;
const declaredTotalMatches=(value,total)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&money(value)===total;

function normalizeUndetailed(items,description){
 return items.map(item=>item.recovered===true&&syntheticDescription.test(item.description||'')?{...item,description}:item);
}

export function repairBudgetAgainstOrderTotals(source={},row={}){
 const sourceParts=Array.isArray(source.parts)?source.parts.filter(Boolean).map(item=>({...item})):[];
 const sourceServices=Array.isArray(source.services)?source.services.filter(Boolean).map(item=>({...item})):[];
 const partText=String(row.dados_extras?.parts||'').trim(),serviceText=String(row.dados_extras?.services||'').trim();
 const partsDescription=!sourceParts.some(item=>!item.recovered)&&partText?partText:'Peças e materiais — detalhamento pendente';
 const servicesDescription=!sourceServices.some(item=>!item.recovered)&&serviceText?serviceText:'Mão de obra — detalhamento pendente';
 const parts=normalizeUndetailed(sourceParts,partsDescription),services=normalizeUndetailed(sourceServices,servicesDescription);
 const expectedParts=money(row.valor_pecas),expectedLabor=money(row.mao_obra);
 let partsTotal=activePartsTotal(parts),servicesTotal=activeServicesTotal(services);
 // Consistent item lists and their saved totals take precedence over stale
 // aggregate columns. A difference alone does not prove an item was lost.
 const partsAuthoritative=parts.length>0&&(declaredTotalMatches(source.partsTotal,partsTotal)||parts.some(item=>item.refused)&&expectedParts===activePartsTotal(parts.map(item=>({...item,refused:false}))));
 const servicesAuthoritative=services.length>0&&(declaredTotalMatches(source.servicesTotal,servicesTotal)||services.some(item=>item.refused)&&expectedLabor===activeServicesTotal(services.map(item=>({...item,refused:false}))));
 const partsMismatch=partsAuthoritative&&expectedParts!==partsTotal,servicesMismatch=servicesAuthoritative&&expectedLabor!==servicesTotal;
 const missingParts=partsAuthoritative?0:money(expectedParts-partsTotal),missingLabor=servicesAuthoritative?0:money(expectedLabor-servicesTotal);
 if(missingParts>.009){
  parts.push({description:partsDescription,cost:missingParts,margin:0,quantity:1,value:missingParts,refused:false,recovered:true});
  partsTotal=activePartsTotal(parts);
 }
 if(missingLabor>.009){
  services.push({description:servicesDescription,mechanic:String(row.mecanico||''),value:missingLabor,commissionRate:.5,refused:false,recovered:true});
  servicesTotal=activeServicesTotal(services);
 }
 const discount=money(row.desconto),calculated=calculateOrderTotals({partsValue:partsTotal,labor:servicesTotal,discount,surchargeRate:row.dados_extras?.surchargeRate??source.surchargeRate});
 return{...source,parts,services,partsTotal,servicesTotal,aggregateMismatch:{parts:partsMismatch,services:servicesMismatch},undetailedParts:parts.filter(item=>item.recovered&&syntheticDescription.test(item.description)).length,undetailedServices:services.filter(item=>item.recovered&&syntheticDescription.test(item.description)).length,subtotal:calculated.base,surchargeRate:calculated.surchargeRate,surchargeAmount:calculated.surchargeAmount,total:calculated.total};
}

const stable=value=>{
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return typeof value==='number'?money(value):value;
};

export function sameSavedBudget(expected,actual){
 return JSON.stringify(stable(expected||null))===JSON.stringify(stable(actual||null));
}
