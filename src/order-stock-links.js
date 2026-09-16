const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

export function resolveOrderStockLinks(parts,stock){
  const selections=[],unresolved=new Set(),byStockId=new Map();
  for(const [partIndex,part] of (parts||[]).entries()){
    if(part.refused)continue;
    if(!['stock','include'].includes(part.stockMode)){unresolved.add(partIndex);continue}
    let found=part.stockId?stock.find(item=>String(item.id)===String(part.stockId)):null;
    if(!found){
      const code=normalize(part.code),description=normalize(part.description);
      const matches=code?stock.filter(item=>normalize(item.code)===code):description?stock.filter(item=>normalize(item.description)===description):[];
      if(matches.length===1)found=matches[0];
    }
    if(!found){unresolved.add(partIndex);continue}
    const needed=Math.max(1,Number(part.quantity||1));
    selections.push({partIndex,stockId:found.id});
    const group=byStockId.get(found.id)||{available:Number(found.quantity||0),needed:0,indices:[]};
    group.needed+=needed;group.indices.push(partIndex);byStockId.set(found.id,group);
  }
  for(const group of byStockId.values())if(group.needed>group.available)group.indices.forEach(index=>unresolved.add(index));
  return{selections:selections.filter(item=>!unresolved.has(item.partIndex)),unresolved:[...unresolved].sort((a,b)=>a-b)};
}
