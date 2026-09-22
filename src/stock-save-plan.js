const clean=value=>String(value||'').trim();
const stockKey=item=>clean(item?.codigo||item?.code).toLowerCase()||`${clean(item?.descricao||item?.description).toLowerCase()}|${clean(item?.aplicacao||item?.application).toLowerCase()}`;

export function planStockUpsert(items,current,metadata,{absolute=false,createId=()=>crypto.randomUUID()}={}){
  const byId=new Map((current||[]).map(row=>[String(row.id),row])),byKey=new Map((current||[]).map(row=>[stockKey(row),row])),nextMetadata={...(metadata||{})},planned=new Map();
  for(const item of items||[]){
    const description=clean(item?.description),addition=Number(item?.quantity),costInput=Number(item?.cost??0),markupInput=Number(item?.markup??0),valueInput=Number(item?.value??0);
    if(!description)continue;
    if(!Number.isFinite(addition)||addition<0||(!absolute&&addition<=0))throw new Error(`Informe uma quantidade válida para ${description}.`);
    if([costInput,markupInput,valueInput].some(value=>!Number.isFinite(value)||value<0))throw new Error(`Confira custo, markup e valor de venda de ${description}.`);
    const key=stockKey(item),found=(item.id&&byId.get(String(item.id)))||byKey.get(key),id=found?.id||createId(),previous=nextMetadata[id]||{},quantity=absolute?addition:Number(found?.quantidade||0)+addition,brand=clean(item.brand??item.application??previous.brand??found?.aplicacao),supplier=clean(item.supplier??previous.supplier),cost=Number(item.cost??previous.cost??found?.valor_unitario??0)||0,markup=Number(item.markup??previous.markup??0)||0,value=Number(item.value??cost*(1+markup/100))||0,body={id,codigo:clean(item.code).toUpperCase()||null,descricao:description,aplicacao:brand||null,quantidade:quantity,valor_unitario:value,foto:item.photo||found?.foto||null};
    nextMetadata[id]={brand,supplier,cost,markup};planned.set(String(id),body);byId.set(String(id),body);byKey.set(key,body);
  }
  return{rows:[...planned.values()],metadata:nextMetadata};
}
