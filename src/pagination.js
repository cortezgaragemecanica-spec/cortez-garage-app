export function paginate(items,page=1,pageSize=25){
  const source=Array.isArray(items)?items:[],size=Math.max(1,Math.trunc(Number(pageSize)||25)),pages=Math.max(1,Math.ceil(source.length/size)),current=Math.min(pages,Math.max(1,Math.trunc(Number(page)||1))),start=(current-1)*size;
  return{items:source.slice(start,start+size),page:current,pages,total:source.length,from:source.length?start+1:0,to:Math.min(start+size,source.length)};
}

export function pagerHtml(result,label='registros'){
  if(!result||result.pages<=1)return'';
  return`<nav class="data-pager" aria-label="Paginação"><button type="button" class="secondary" data-page="${result.page-1}" ${result.page<=1?'disabled':''}>← Anterior</button><span>${result.from}–${result.to} de ${result.total} ${label} · página ${result.page} de ${result.pages}</span><button type="button" class="secondary" data-page="${result.page+1}" ${result.page>=result.pages?'disabled':''}>Próxima →</button></nav>`;
}

export function enableProgressiveTables(container,{pageSize=50}={}){
  if(!container)return;
  container.querySelectorAll('.report-table tbody,.finance-table tbody').forEach(body=>{
    if(body.dataset.progressive==='ready')return;
    const rows=[...body.children];
    if(rows.length<=pageSize)return;
    body.dataset.progressive='ready';
    let visible=pageSize;
    const update=()=>{
      rows.forEach((row,index)=>row.hidden=index>=visible);
      control.querySelector('span').textContent=`Exibindo ${Math.min(visible,rows.length)} de ${rows.length} registros`;
      button.hidden=visible>=rows.length;
    },control=document.createElement('div'),button=document.createElement('button');
    control.className='progressive-table-control';button.type='button';button.className='secondary';button.textContent='Mostrar mais';control.innerHTML='<span></span>';control.append(button);body.closest('.table-card')?.after(control);
    button.onclick=()=>{visible+=pageSize;update()};update();
  });
}
