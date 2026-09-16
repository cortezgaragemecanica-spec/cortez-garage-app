const number=value=>Number(value)||0;
const text=value=>String(value||'').trim();
const partFields=['description','brand','supplier','stockMode','stockId'];
const serviceFields=['description','mechanic'];
const partCost=item=>number(item?.cost??item?.value);
const partMargin=item=>number(item?.margin);
const partQuantity=item=>number(item?.quantity)||1;
const partValue=item=>number(item?.value)||partCost(item)*(1+partMargin(item)/100);

function unchanged(previous,current,fields,numeric){
  return fields.every(key=>text(previous?.[key])===text(current?.[key]))&&numeric.every(key=>number(previous?.[key])===number(current?.[key]))&&Boolean(previous?.refused)===Boolean(current?.refused);
}
function unchangedPart(previous,current){
  return unchanged(previous,current,partFields,[])&&text(previous?.code).toUpperCase()===text(current?.code).toUpperCase()&&Math.abs(partCost(previous)-partCost(current))<.001&&Math.abs(partMargin(previous)-partMargin(current))<.001&&partQuantity(previous)===partQuantity(current)&&Math.abs(partValue(previous)-partValue(current))<.001;
}

export function appendOrderItemsOnly(remoteBudget,candidateBudget,discount){
  const previous=remoteBudget&&typeof remoteBudget==='object'?remoteBudget:{},candidate=candidateBudget&&typeof candidateBudget==='object'?candidateBudget:{},oldParts=Array.isArray(previous.parts)?previous.parts:[],oldServices=Array.isArray(previous.services)?previous.services:[],newParts=Array.isArray(candidate.parts)?candidate.parts:[],newServices=Array.isArray(candidate.services)?candidate.services:[];
  if(newParts.length<oldParts.length||newServices.length<oldServices.length)throw new Error('Esta permissão não permite excluir peças ou serviços.');
  if(oldParts.some((item,index)=>!unchangedPart(item,newParts[index]))||oldServices.some((item,index)=>!unchanged(item,newServices[index],serviceFields,['value'])))throw new Error('Esta permissão não permite alterar itens já cadastrados.');
  for(const key of['paymentTerms','warrantyTerms','approved','approvedAt','refusedPreviousStatus'])if(text(previous[key])!==text(candidate[key]))throw new Error('Esta permissão permite apenas incluir peças e serviços.');
  const appendedParts=newParts.slice(oldParts.length),appendedServices=newServices.slice(oldServices.length);
  if(!appendedParts.length&&!appendedServices.length)throw new Error('Inclua uma peça ou serviço novo para salvar.');
  for(const item of appendedParts)if(!text(item?.description)||number(item?.quantity)<1||number(item?.value)<0||item?.stockMode==='include'||item?.refused)throw new Error('Informe descrição, quantidade e valor válido para a peça. Inclusão no estoque não está liberada.');
  for(const item of appendedServices)if(!text(item?.description)||number(item?.value)<0||item?.refused)throw new Error('Informe descrição e valor válido para o serviço.');
  const parts=[...oldParts,...appendedParts],services=[...oldServices,...appendedServices],partsTotal=parts.filter(item=>!item.refused).reduce((sum,item)=>sum+partQuantity(item)*partValue(item),0),servicesTotal=services.filter(item=>!item.refused).reduce((sum,item)=>sum+number(item.value),0),total=Math.max(0,partsTotal+servicesTotal-number(discount));
  return{budget:{...previous,parts,services,partsTotal,servicesTotal,total},partsTotal,servicesTotal,total};
}
