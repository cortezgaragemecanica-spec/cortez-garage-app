const number=value=>Number(value)||0;
const dateOnly=value=>String(value||'').slice(0,10);
const inMonth=(value,month)=>dateOnly(value).slice(0,7)===month;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function previousMonth(month){
  const [year,value]=String(month).split('-').map(Number),date=new Date(year,value-2,1);
  return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export function deliveredDate(order){
  if(order?.status!=='Entregue')return'';
  return dateOnly(order.deliveredAt||order.closingReceipt?.closedAt||order.updatedAt||order.created);
}

function clientKey(order){
  const client=order?.client||{},phone=String(client.phone||'').replace(/\D/g,'');
  return client.id||phone||normalize(client.name);
}

function serviceRows(order){
  const services=(order?.budget?.services||[]).filter(item=>!item.refused);
  if(services.length)return services.map(item=>({mechanic:item.mechanic||order.mechanic||'Não informado',production:number(item.value),commission:number(item.value)*(Number.isFinite(Number(item.commissionRate))?Math.min(1,Math.max(0,Number(item.commissionRate))):.5)}));
  return[{mechanic:order?.mechanic||'Não informado',production:number(order?.labor),commission:number(order?.labor)*.5}];
}

function grouped(rows,keyField,valueFields){
  const result=new Map();
  for(const row of rows){const key=row[keyField]||'Não informado',current=result.get(key)||Object.fromEntries(valueFields.map(field=>[field,0]));for(const field of valueFields)current[field]+=number(row[field]);result.set(key,current)}
  return[...result].map(([name,values])=>({name,...values})).sort((a,b)=>b[valueFields[0]]-a[valueFields[0]]||a.name.localeCompare(b.name));
}

function supplierPurchases(month,suppliers,records){
  const luizinho=(suppliers?.luizinho||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.amount),0),luizinhoCredits=(suppliers?.luizinhoReturns||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.amount),0),retifica=(suppliers?.retifica||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.debit),0),rows=[];
  if(luizinho||luizinhoCredits)rows.push({name:'Luizinho',amount:luizinho,credits:luizinhoCredits});
  if(retifica)rows.push({name:'Retífica',amount:retifica,credits:0});
  for(const record of records){const text=normalize(record.description);if(record.category!=='Fluxo de caixa'||record.kind!=='Saída'||record.status!=='Realizado'||!inMonth(record.dueDate||record.createdAt,month)||!/compr\w*.*pecas?|pecas?.*compr\w*/.test(text)||/luizinho|retifica/.test(text))continue;const identified=String(record.description||'').match(/(?:compr\w*.*pe[cç]as?|pe[cç]as?.*compr\w*)\s*[-–—:·]\s*(.+)$/i)?.[1]?.trim();rows.push({name:identified||'Fornecedor não informado',amount:number(record.amount),credits:0})}
  return grouped(rows,'name',['amount','credits']);
}

export function summarizeMonthlyClosing({month,orders=[],records=[],suppliers={},profitEvents=[],partnerNames=[]}){
  const delivered=orders.filter(order=>inMonth(deliveredDate(order),month)),previous=previousMonth(month),previousDelivered=orders.filter(order=>inMonth(deliveredDate(order),previous)),billed=delivered.reduce((sum,order)=>sum+number(order.total),0),previousBilled=previousDelivered.reduce((sum,order)=>sum+number(order.total),0),firstOrderByClient=new Map();
  for(const order of orders){const key=clientKey(order),created=dateOnly(order.created);if(key&&created&&(!firstOrderByClient.has(key)||created<firstOrderByClient.get(key)))firstOrderByClient.set(key,created)}
  const newClients=[...firstOrderByClient.values()].filter(value=>inMonth(value,month)).length,mechanicRows=delivered.flatMap(serviceRows),mechanics=grouped(mechanicRows,'mechanic',['production','commission']),receipts=profitEvents.filter(item=>inMonth(item.date,month));
  let partsProfit=0,laborProfit=0;
  for(const event of receipts){const gross=Math.max(0,number(event.order?.partsValue)+number(event.order?.labor)),partsShare=gross?number(event.order?.partsValue)/gross:0,laborShare=gross?number(event.order?.labor)/gross:1;partsProfit+=number(event.orderValue)*partsShare-number(event.partsCost);laborProfit+=number(event.orderValue)*laborShare-number(event.laborCommission)}
  const partners=partnerNames.map(name=>({name,commission:receipts.reduce((sum,item)=>sum+number(item[normalize(name)]),0)})),paymentTypes=grouped(receipts.map(item=>({name:item.record?.paymentType||'Não informado',amount:item.orderValue})),'name',['amount']),purchases=supplierPurchases(month,suppliers,records),paidAccounts=records.filter(record=>record.category==='Fluxo de caixa'&&record.kind==='Saída'&&record.status==='Realizado'&&inMonth(record.dueDate||record.createdAt,month)&&String(record.reference||'').startsWith('pagamento-conta-')).reduce((sum,record)=>sum+number(record.amount),0),received=receipts.reduce((sum,item)=>sum+number(item.orderValue),0);
  return{month,deliveredCount:delivered.length,newClients,ticketAverage:delivered.length?billed/delivered.length:0,billed,received,partsProfit,laborProfit,paidAccounts,mechanics,partners,paymentTypes,purchases,purchasesTotal:purchases.reduce((sum,item)=>sum+item.amount,0),growth:previousBilled>0?(billed-previousBilled)/previousBilled*100:null,previousBilled};
}

