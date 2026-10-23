const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const rounded=value=>Number((Number(value)||0).toFixed(2));

export const purchasedItem=item=>Boolean(item?.purchased||item?.purchasedAt);

export function approvedShoppingOrder(order){
  if(!order||order.budget?.approved===false)return false;
  return text(order.status)==='Em andamento';
}

export function shoppingPartKey(part,index,parts=[]){
  const identity=normalized(part?.code)||normalized(part?.description)||`item-${index}`,previous=(parts||[]).slice(0,index).filter(candidate=>(normalized(candidate?.code)||normalized(candidate?.description))===identity).length;
  return`${identity}:${previous+1}`;
}

function shoppingPart(part,state,order,index,parts){
  const quantity=Math.max(1,Number(part?.quantity)||1),rawCost=part?.cost,hasCost=rawCost!==undefined&&rawCost!==null&&rawCost!==''&&Number.isFinite(Number(rawCost)),unitCost=hasCost?rounded(rawCost):null;
  return{...part,...state,orderId:String(order.id),partKey:shoppingPartKey(part,index,parts),partIndex:index,quantity,supplier:text(part?.supplier)||'Fornecedor não informado',unitCost,costTotal:unitCost===null?0:rounded(unitCost*quantity),costIdentified:unitCost!==null};
}

export function shoppingGroups(orders=[],checklists=[]){
  const checklistByOrder=new Map((checklists||[]).map(entry=>[String(entry.orderId||entry.id||''),entry]));
  return(orders||[]).filter(approvedShoppingOrder).map(order=>{
    const parts=Array.isArray(order?.budget?.parts)?order.budget.parts:[],states=checklistByOrder.get(String(order.id))?.items||{},items=parts.map((part,index)=>shoppingPart(part,states[shoppingPartKey(part,index,parts)]||{},order,index,parts)).filter(item=>!item.refused&&!item.excluded),purchasedItems=items.filter(purchasedItem),totalCost=rounded(items.reduce((sum,item)=>sum+item.costTotal,0)),purchasedCost=rounded(purchasedItems.reduce((sum,item)=>sum+item.costTotal,0));
    return{key:String(order.id),orderId:String(order.id),orderNumber:text(order.number),client:order.client||{},vehicle:order.vehicle||{},createdAt:order.updatedAt||order.createdAt||'',items,total:items.length,purchased:purchasedItems.length,pending:items.length-purchasedItems.length,totalCost,purchasedCost,pendingCost:rounded(Math.max(0,totalCost-purchasedCost)),unidentifiedCostItems:items.filter(item=>!item.costIdentified).length};
  }).filter(group=>group.total>0).sort((a,b)=>Number(Boolean(b.pending))-Number(Boolean(a.pending))||String(b.createdAt).localeCompare(String(a.createdAt))||String(b.orderNumber).localeCompare(String(a.orderNumber),undefined,{numeric:true}));
}
