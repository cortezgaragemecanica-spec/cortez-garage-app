const text=value=>String(value??'').trim();

export const purchasedItem=item=>Boolean(item?.purchased||item?.purchasedAt);

export function approvedShoppingOrder(order){
  if(!order||order.budget?.approved===false)return false;
  return text(order.status)==='Em andamento';
}

export function shoppingGroups(requests,orders=[]){
  const orderById=new Map((orders||[]).map(order=>[String(order.id),order])),groups=new Map();
  for(const request of requests||[]){
    const orderId=String(request.orderId||''),key=orderId||`numero:${text(request.orderNumber)}`,order=orderById.get(orderId);
    if(!approvedShoppingOrder(order))continue;
    const current=groups.get(key)||{key,orderId,orderNumber:text(request.orderNumber||order?.number),client:order?.client||{},vehicle:request.vehicle||order?.vehicle||{},createdAt:request.createdAt||'',items:[]};
    for(const[itemIndex,item]of(request.items||[]).entries())current.items.push({...item,requestId:request.id,itemIndex,requestedBy:request.requestedBy,requestedAt:request.createdAt||'',requestStatus:request.status||''});
    if(String(request.createdAt||'')>String(current.createdAt||''))current.createdAt=request.createdAt;
    groups.set(key,current);
  }
  return[...groups.values()].map(group=>({...group,total:group.items.length,purchased:group.items.filter(purchasedItem).length,pending:group.items.filter(item=>!purchasedItem(item)).length})).sort((a,b)=>Number(Boolean(b.pending))-Number(Boolean(a.pending))||String(b.createdAt).localeCompare(String(a.createdAt))||String(b.orderNumber).localeCompare(String(a.orderNumber),undefined,{numeric:true}));
}
