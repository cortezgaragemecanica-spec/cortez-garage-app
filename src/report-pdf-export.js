const WIDTH=1240,HEIGHT=1754,MARGIN=64,CONTENT=WIDTH-MARGIN*2;
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const safeName=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'')||'Relatorio';

function wrap(ctx,value,width){
  const words=text(value||'—').split(' '),lines=[];let line='';
  for(const word of words){const next=(line+' '+word).trim();if(line&&ctx.measureText(next).width>width){lines.push(line);line=word}else line=next}
  if(line)lines.push(line);return lines.length?lines:['—']
}
function jpegBytes(canvas){const binary=atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function canvasesToPdf(canvases){
  const images=canvases.map(canvas=>({bytes:jpegBytes(canvas),width:canvas.width,height:canvas.height})),pageIds=images.map((_,index)=>3+index*3),objects=[];
  objects[1]=['<< /Type /Catalog /Pages 2 0 R >>'];objects[2]=[`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`];
  images.forEach((image,index)=>{const pageId=pageIds[index],contentId=pageId+1,imageId=pageId+2,stream=`q ${WIDTH} 0 0 ${HEIGHT} 0 0 cm /Im${index} Do Q`;objects[pageId]=[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`];objects[contentId]=[`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];objects[imageId]=[`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,image.bytes,'\nendstream']});
  const encoder=new TextEncoder(),parts=[encoder.encode('%PDF-1.4\n')],offsets=[0];let length=parts[0].length;
  for(let id=1;id<objects.length;id++){offsets[id]=length;const head=encoder.encode(`${id} 0 obj\n`),tail=encoder.encode('\nendobj\n');parts.push(head);length+=head.length;for(const part of objects[id]){const bytes=typeof part==='string'?encoder.encode(part):part;parts.push(bytes);length+=bytes.length}parts.push(tail);length+=tail.length}
  const xref=length;let end=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)end+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;end+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;parts.push(encoder.encode(end));return new Blob(parts,{type:'application/pdf'})
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)})}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}

function reportCanvases(container,title){
  const pages=[];let canvas,ctx,y=0;
  const header=()=>{ctx.fillStyle='#111';ctx.fillRect(MARGIN,50,CONTENT,118);ctx.fillStyle='#d6b718';ctx.fillRect(MARGIN,168,CONTENT,8);ctx.font='bold 29px Arial';ctx.fillText('CORTEZ GARAGE MECÂNICA E AUTO ELÉTRICA',MARGIN+20,91);ctx.fillStyle='#fff';ctx.font='18px Arial';ctx.fillText('Av. Brasil, 5452 · Itapoá/SC · (47) 99124-7442',MARGIN+20,124);ctx.fillStyle='#111';ctx.font='bold 31px Arial';ctx.fillText(text(title).slice(0,70),MARGIN,225);ctx.font='16px Arial';ctx.fillText(`Gerado em ${new Date().toLocaleString('pt-BR')}`,MARGIN,256);y=292};
  const page=()=>{canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,HEIGHT);pages.push(canvas);header()};
  const ensure=height=>{if(y+height>HEIGHT-MARGIN)page()};
  const line=(label,value)=>{ctx.font='bold 19px Arial';const prefix=`${text(label)}: `,prefixWidth=ctx.measureText(prefix).width;ctx.font='19px Arial';const lines=wrap(ctx,value,CONTENT-prefixWidth-8);ensure(lines.length*26+12);ctx.font='bold 19px Arial';ctx.fillText(prefix,MARGIN,y);ctx.font='19px Arial';lines.forEach((part,index)=>ctx.fillText(part,index?MARGIN:MARGIN+prefixWidth,y+index*26));y+=lines.length*26+12};
  const heading=value=>{ensure(55);ctx.fillStyle='#222';ctx.fillRect(MARGIN,y,CONTENT,38);ctx.fillStyle='#fff';ctx.font='bold 18px Arial';ctx.fillText(text(value).toUpperCase(),MARGIN+12,y+25);ctx.fillStyle='#111';y+=52};
  const drawTable=table=>{const rows=[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(cell=>text(cell.innerText))).filter(row=>row.length);if(!rows.length)return;const columns=Math.max(...rows.map(row=>row.length)),width=CONTENT/columns,drawHeader=()=>{const headers=rows[0];ctx.fillStyle='#111';ctx.fillRect(MARGIN,y,CONTENT,42);ctx.fillStyle='#fff';ctx.font='bold 13px Arial';headers.forEach((value,index)=>wrap(ctx,value,width-12).slice(0,2).forEach((part,lineIndex)=>ctx.fillText(part,MARGIN+index*width+6,y+17+lineIndex*14)));y+=42};ensure(85);drawHeader();for(const row of rows.slice(1)){ctx.font='13px Arial';const cells=Array.from({length:columns},(_,index)=>wrap(ctx,row[index]||'—',width-12)),height=Math.max(35,...cells.map(lines=>lines.length*16+12));if(y+height>HEIGHT-MARGIN){page();drawHeader()}ctx.fillStyle=(Math.round(y/35)%2)?'#f4f4f4':'#fff';ctx.fillRect(MARGIN,y,CONTENT,height);ctx.strokeStyle='#bbb';cells.forEach((lines,index)=>{ctx.strokeRect(MARGIN+index*width,y,width,height);ctx.fillStyle='#111';lines.forEach((part,lineIndex)=>ctx.fillText(part,MARGIN+index*width+6,y+18+lineIndex*16))});y+=height}y+=24};
  page();
  const summary=[...container.querySelectorAll('.finance-summary article')];if(summary.length){heading('Resumo');for(const item of summary)line(item.querySelector('span')?.innerText,item.querySelector('b')?.innerText)}
  const summaryTables=[...container.querySelectorAll('.report-summary-table table')];for(const table of summaryTables){heading('Resumo');drawTable(table)}
  const tables=[...container.querySelectorAll('table')].filter(table=>!table.closest('.report-summary-table'));tables.forEach((table,index)=>{heading(tables.length>1?`Tabela ${index+1}`:'Detalhamento');drawTable(table)});
  if(!summary.length&&!summaryTables.length&&!tables.length){heading('Relatório');line('Conteúdo',container.innerText)}
  return pages
}

export async function exportReportPdf(container,title,{print=false}={}){
  if(!container)throw new Error('Relatório não encontrado.');
  if(print&&!window.CortezAndroid?.savePdf){window.print();return}
  const blob=canvasesToPdf(reportCanvases(container,title)),name=`Cortez-Garage-${safeName(title)}.pdf`;
  if(window.CortezAndroid?.savePdf)return window.CortezAndroid.savePdf(await blobBase64(blob),name);
  if(!print)return download(blob,name);
  window.print()
}
