const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const rounded=value=>Number((Number(value)||0).toFixed(2));

export const purchasedItem=item=>Boolean(item?.purchased||item?.purchasedAt);

export function quotedPartForItem(item,order){
  const parts=(Array.isArray(order?.budget?.parts)?order.budget.parts:[]).filter(part=>!part?.refused),description=normalized(item?.description),code=normalized(item?.code);
  if(!parts.length||(!description&&!code))return null;
  return parts.find(part=>code&&normalized(part.code)===code)||parts.find(part=>description&&normalized(part.description)===description)||parts.find(part=>{const quoted=normalized(part.description);return description&&quoted&&(quoted.includes(description)||description.includes(quoted))})||null;
}

export function quotedPurchaseItem(item,order){
  const quoted=quotedPartForItem(item,order),quantity=Math.max(1,Number(item?.quantity)||1),rawCost=item?.unitCost??item?.cost??quoted?.cost,hasCost=rawCost!==undefined&&rawCost!==null&&rawCost!==''&&Number.isFinite(Number(rawCost)),unitCost=hasCost?rounded(rawCost):null;
  return{...item,supplier:text(item?.supplier||quoted?.supplier)||'Fornecedor não informado',unitCost,costTotal:unitCost===null?0:rounded(unitCost*quantity),costIdentified:unitCost!==null};
}

const quotedOrderCost=order=>rounded((Array.isArray(order?.budget?.parts)?order.budget.parts:[]).filter(part=>!part?.refused).reduce((sum,part)=>sum+Math.max(1,Number(part?.quantity)||1)*(Number(part?.cost)||0),0));

export function approvedShoppingOrder(order){
  if(!order||order.budget?.approved===false)return false;
  return text(order.status)==='Em andamento';
}

export function shoppingGroups(requests,orders=[]){
  const orderById=new Map((orders||[]).map(order=>[String(order.id),order])),groups=new Map();
  for(const request of requests||[]){
    const orderId=String(request.orderId||''),key=orderId||`numero:${text(request.orderNumber)}`,order=orderById.get(orderId);
    if(!approvedShoppingOrder(order))continue;
    const current=groups.get(key)||{key,orderId,orderNumber:text(request.orderNumber||order?.number),client:order?.client||{},vehicle:request.vehicle||order?.vehicle||{},createdAt:request.createdAt||'',orderCost:quotedOrderCost(order),items:[]};
    for(const[itemIndex,item]of(request.items||[]).entries())current.items.push({...quotedPurchaseItem(item,order),requestId:request.id,itemIndex,requestedBy:request.requestedBy,requestedAt:request.createdAt||'',requestStatus:request.status||''});
    if(String(request.createdAt||'')>String(current.createdAt||''))current.createdAt=request.createdAt;
    groups.set(key,current);
  }
  return[...groups.values()].map(group=>{const purchasedItems=group.items.filter(purchasedItem),requestedCost=rounded(group.items.reduce((sum,item)=>sum+item.costTotal,0)),totalCost=group.orderCost||requestedCost,purchasedCost=Math.min(totalCost,rounded(purchasedItems.reduce((sum,item)=>sum+item.costTotal,0)));return{...group,total:group.items.length,purchased:purchasedItems.length,pending:group.items.length-purchasedItems.length,totalCost,purchasedCost,pendingCost:rounded(Math.max(0,totalCost-purchasedCost)),unidentifiedCostItems:group.items.filter(item=>!item.costIdentified).length}}).sort((a,b)=>Number(Boolean(b.pending))-Number(Boolean(a.pending))||String(b.createdAt).localeCompare(String(a.createdAt))||String(b.orderNumber).localeCompare(String(a.orderNumber),undefined,{numeric:true}));
}
