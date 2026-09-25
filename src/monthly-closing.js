const number=value=>Number(value)||0;
const dateOnly=value=>String(value||'').slice(0,10);
const inMonth=(value,month)=>dateOnly(value).slice(0,7)===month;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const orderRevenue=order=>order?.warranty?0:number(order?.total);

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
  const paysCommission=!order?.warranty||Boolean(order?.warrantyPayCommissions);
  if(services.length)return services.map(item=>({mechanic:item.mechanic||order.mechanic||'Não informado',production:number(item.value),commission:paysCommission?number(item.value)*(Number.isFinite(Number(item.commissionRate))?Math.min(1,Math.max(0,Number(item.commissionRate))):.5):0}));
  return[{mechanic:order?.mechanic||'Não informado',production:number(order?.labor),commission:paysCommission?number(order?.labor)*.5:0}];
}

function fallbackOrderProfit(order){
  const laborCommission=serviceRows(order).reduce((sum,item)=>sum+item.commission,0),partsCost=(order?.budget?.parts||[]).filter(item=>!item.refused).reduce((sum,item)=>sum+number(item.cost)*Math.max(1,number(item.quantity)||1),0),orderValue=orderRevenue(order),real=orderValue-laborCommission-partsCost;
  return{order,orderValue,laborCommission,partsCost,real,net:real};
}

function grouped(rows,keyField,valueFields){
  const result=new Map();
  for(const row of rows){const key=row[keyField]||'Não informado',current=result.get(key)||Object.fromEntries(valueFields.map(field=>[field,0]));for(const field of valueFields)current[field]+=number(row[field]);result.set(key,current)}
  return[...result].map(([name,values])=>({name,...values})).sort((a,b)=>b[valueFields[0]]-a[valueFields[0]]||a.name.localeCompare(b.name));
}

function mechanicOrderRows(order,profit){
  const people=grouped(serviceRows(order),'mechanic',['production','commission']),productionTotal=people.reduce((sum,item)=>sum+item.production,0),equalShare=people.length?1/people.length:0;
  return people.map(item=>{const share=productionTotal>0?item.production/productionTotal:equalShare,billing=orderRevenue(order)*share;return{mechanic:item.name,carCount:1,production:item.production,billing,profit:number(profit?.real)*share,commission:item.commission}});
}

function supplierPurchases(month,suppliers,records,orders=[]){
  const luizinho=(suppliers?.luizinho||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.amount),0),luizinhoCredits=(suppliers?.luizinhoReturns||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.amount),0),retifica=(suppliers?.retifica||[]).filter(item=>inMonth(item.date,month)).reduce((sum,item)=>sum+number(item.debit),0),rows=[];
  if(luizinho||luizinhoCredits)rows.push({name:'Luizinho',amount:luizinho,credits:luizinhoCredits});
  if(retifica)rows.push({name:'Retífica',amount:retifica,credits:0});
  for(const record of records){const text=normalize(record.description);if(record.category!=='Fluxo de caixa'||record.kind!=='Saída'||record.status!=='Realizado'||!inMonth(record.dueDate||record.createdAt,month)||!/compr\w*.*pecas?|pecas?.*compr\w*/.test(text)||/luizinho|retifica/.test(text))continue;const identified=String(record.description||'').match(/(?:compr\w*.*pe[cç]as?|pe[cç]as?.*compr\w*)\s*[-–—:·]\s*(.+)$/i)?.[1]?.trim();rows.push({name:identified||'Fornecedor não informado',amount:number(record.amount),credits:0})}
  for(const order of orders.filter(item=>item.warranty))for(const part of(order.budget?.parts||[]).filter(item=>!item.refused)){const amount=number(part.cost)*Math.max(1,number(part.quantity)||1);if(amount>0)rows.push({name:part.supplier||'Garantia sem fornecedor',amount,credits:0})}
  return grouped(rows,'name',['amount','credits']);
}

export function summarizeMonthlyClosing({month,orders=[],records=[],suppliers={},profitEvents=[],orderProfits=[],partnerNames=[]}){
  const delivered=orders.filter(order=>inMonth(deliveredDate(order),month)),previous=previousMonth(month),previousDelivered=orders.filter(order=>inMonth(deliveredDate(order),previous)),billed=delivered.reduce((sum,order)=>sum+orderRevenue(order),0),previousBilled=previousDelivered.reduce((sum,order)=>sum+orderRevenue(order),0),firstOrderByClient=new Map();
  for(const order of orders){const key=clientKey(order),created=dateOnly(order.created);if(key&&created&&(!firstOrderByClient.has(key)||created<firstOrderByClient.get(key)))firstOrderByClient.set(key,created)}
  const deliveredClientKeys=new Set(delivered.map(clientKey).filter(Boolean)),newClients=[...deliveredClientKeys].filter(key=>inMonth(firstOrderByClient.get(key),month)).length,profitByOrder=new Map(orderProfits.map(item=>[item.order?.id||item.order?.number,item])),deliveredProfits=delivered.map(order=>profitByOrder.get(order.id||order.number)||fallbackOrderProfit(order)),mechanics=grouped(delivered.flatMap((order,index)=>mechanicOrderRows(order,deliveredProfits[index])),'mechanic',['production','billing','profit','commission','carCount']).map(item=>({...item,ticketAverage:item.carCount?item.billing/item.carCount:0})),deliveredIds=new Set(delivered.flatMap(order=>[order.id,order.number].filter(Boolean))),receipts=profitEvents.filter(item=>deliveredIds.has(item.order?.id)||deliveredIds.has(item.order?.number));
  let partsProfit=0,laborProfit=0;
  for(let index=0;index<delivered.length;index++){const order=delivered[index],profit=deliveredProfits[index],gross=Math.max(0,number(order.partsValue)+number(order.labor)),partsShare=gross?number(order.partsValue)/gross:0,laborShare=gross?number(order.labor)/gross:1;partsProfit+=number(profit.orderValue)*partsShare-number(profit.partsCost);laborProfit+=number(profit.orderValue)*laborShare-number(profit.laborCommission)}
  const partners=partnerNames.map(name=>({name,commission:deliveredProfits.reduce((sum,item)=>sum+number(item[normalize(name)]),0)})),paymentTypes=grouped(receipts.map(item=>({name:item.record?.paymentType||'Não informado',amount:item.orderValue})),'name',['amount']),purchases=supplierPurchases(month,suppliers,records,delivered),paidAccounts=records.filter(record=>record.category==='Fluxo de caixa'&&record.kind==='Saída'&&record.status==='Realizado'&&inMonth(record.dueDate||record.createdAt,month)&&String(record.reference||'').startsWith('pagamento-conta-')).reduce((sum,record)=>sum+number(record.amount),0),received=receipts.reduce((sum,item)=>sum+number(item.orderValue),0),totalProfit=deliveredProfits.reduce((sum,item)=>sum+number(item.real),0),netProfit=deliveredProfits.reduce((sum,item)=>sum+number(item.net),0);
  return{month,deliveredCount:delivered.length,newClients,ticketAverage:delivered.length?billed/delivered.length:0,billed,received,partsProfit,laborProfit,totalProfit,netProfit,paidAccounts,mechanics,partners,paymentTypes,purchases,purchasesTotal:purchases.reduce((sum,item)=>sum+item.amount,0),growth:previousBilled>0?(billed-previousBilled)/previousBilled*100:null,previousBilled};
}
