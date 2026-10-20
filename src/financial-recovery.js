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

export function financialRecoveryProfit(order,ratio=1){
  const result={parts:0,retifica:0},factor=Math.min(1,Math.max(0,Number(ratio)||0));
  for(const part of(order?.budget?.parts||[]).filter(item=>!item?.refused)){
    const units=quantity(part),profit=cents((Number(part.value||0)-Number(part.cost||0))*units*factor),bucket=isRetificaPart(part)?'retifica':'parts';
    result[bucket]=cents(result[bucket]+profit);
  }
  result.total=cents(Math.max(0,result.parts)+Math.max(0,result.retifica));
  return result;
}

export function normalizeFinancialRecoveryConfig(value={}){
  const startDate=/^\d{4}-\d{2}-\d{2}$/.test(String(value?.startDate||''))?String(value.startDate):new Date().toISOString().slice(0,7)+'-01';
  const withdrawals=(Array.isArray(value?.withdrawals)?value.withdrawals:[]).map(item=>({id:clean(item?.id),type:item?.type==='retifica'?'retifica':'parts',date:String(item?.date||'').slice(0,10),description:clean(item?.description),amount:cents(Math.max(0,Number(item?.amount)||0)),createdAt:item?.createdAt||''})).filter(item=>item.id&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&item.description&&item.amount>0);
  return{startDate,commissionIntegration:value?.commissionIntegration===true,withdrawals};
}

export function financialRecoveryBalances(totals,config={}){
  const normalizedConfig=normalizeFinancialRecoveryConfig(config),withdrawn={parts:0,retifica:0};
  for(const item of normalizedConfig.withdrawals)withdrawn[item.type]=cents(withdrawn[item.type]+item.amount);
  return{parts:{generated:cents(totals?.parts?.profit),withdrawn:withdrawn.parts,balance:cents(Number(totals?.parts?.profit||0)-withdrawn.parts)},retifica:{generated:cents(totals?.retifica?.profit),withdrawn:withdrawn.retifica,balance:cents(Number(totals?.retifica?.profit||0)-withdrawn.retifica)}};
}

export function financialRecoveryRows(orders=[],period=''){
  const month=typeof period==='string'?period:'',startDate=typeof period==='object'?String(period?.startDate||''):'',endDate=typeof period==='object'?String(period?.endDate||''):'';
  const rows=[];
  for(const order of orders){
    if(order?.status!=='Entregue')continue;
    const orderDate=recoveryOrderDate(order);
    if(month&&orderDate.slice(0,7)!==month)continue;
    if(startDate&&orderDate<startDate)continue;
    if(endDate&&orderDate>endDate)continue;
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
