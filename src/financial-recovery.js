const cents=value=>Math.round((Number(value)||0)*100)/100;
const clean=value=>String(value||'').trim();
const normalized=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const quantity=item=>Math.max(1,Number(item?.quantity)||1);

export function isRetificaPart(item){
  const description=normalized(item?.description);
  return /\bretifica\b/.test(description)||/\bplaina\s+(?:de\s+)?cabecote\b/.test(description);
}

export function recoveryOrderDate(order){
  return String(order?.closingReceipt?.closedAt||order?.deliveredAt||order?.updatedAt||order?.created||'').slice(0,10);
}

export function financialRecoveryRows(orders=[],month=''){
  const rows=[];
  for(const order of orders){
    if(order?.status!=='Entregue')continue;
    const orderDate=recoveryOrderDate(order);
    if(month&&orderDate.slice(0,7)!==month)continue;
    let parts=(order?.budget?.parts||[]).filter(item=>!item?.refused);
    if(!parts.length&&Number(order?.partsValue||0)>0)parts=[{description:'Peças sem detalhamento (O.S. antiga)',quantity:1,cost:0,value:Number(order.partsValue),supplier:''}];
    const grouped=new Map();
    for(const part of parts){
      const retifica=isRetificaPart(part),supplier=retifica?'Retífica':clean(part.supplier)||'Fornecedor não identificado',key=`${retifica?'retifica':'pecas'}::${normalized(supplier)}`,current=grouped.get(key)||{order,date:orderDate,type:retifica?'retifica':'pecas',supplier,items:[],cost:0,sale:0};
      const units=quantity(part),cost=cents(Number(part.cost||0)*units),sale=cents(Number(part.value||0)*units);
      current.items.push({description:clean(part.description)||'Peça sem descrição',quantity:units,cost,sale});
      current.cost=cents(current.cost+cost);current.sale=cents(current.sale+sale);grouped.set(key,current);
    }
    for(const row of grouped.values())rows.push({...row,profit:cents(row.sale-row.cost)});
  }
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.order?.number||'').localeCompare(String(b.order?.number||''),undefined,{numeric:true})||a.supplier.localeCompare(b.supplier));
}

export function financialRecoveryTotals(rows=[]){
  return rows.reduce((totals,row)=>{const bucket=row.type==='retifica'?totals.retifica:totals.parts;bucket.cost=cents(bucket.cost+row.cost);bucket.sale=cents(bucket.sale+row.sale);bucket.profit=cents(bucket.profit+row.profit);return totals},{parts:{cost:0,sale:0,profit:0},retifica:{cost:0,sale:0,profit:0}});
}
