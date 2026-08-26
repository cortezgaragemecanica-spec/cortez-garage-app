const DB_KEY='cortez-garage-v1';
const readDb=()=>{try{return JSON.parse(localStorage.getItem(DB_KEY)||'null')}catch{return null}};
const plain=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ');
const brl=value=>`R$ ${Number(value||0).toFixed(2).replace('.',',')}`;
const wrap=(value,width=78)=>{const words=plain(value).split(/\s+/).filter(Boolean),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>width){if(line)lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines.length?lines:['-']};
const field=(label,value)=>[plain(label.toUpperCase()),...wrap(value).map(line=>`  ${line}`),''];
const currentOrder=()=>{const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();return readDb()?.orders?.find(order=>String(order.number)===number)};

function reportLines(order){
  const budget=order.budget||{},parts=budget.parts||[],services=budget.services||[],checklist=budget.checklist||[];
  const lines=['CORTEZ GARAGE - ORDEM DE SERVICO',`OS #${plain(order.number)}`,'==============================================','',`Cliente: ${plain(order.client?.name)}`,`Telefone: ${plain(order.client?.phone)}`,`Veiculo: ${plain(order.vehicle?.model)}`,`Placa: ${plain(order.vehicle?.plate)}`,`Ano/Cor: ${plain(order.vehicle?.year)} / ${plain(order.vehicle?.color)}`,`Status: ${plain(order.status)}`,'',...field('Reclamacao do cliente',order.complaint),...field('Diagnostico',order.diagnosis),...field('Servicos a executar',order.services),'PECAS UTILIZADAS','----------------------------------------------'];
  if(!parts.length)lines.push('Nenhuma peca informada.');else parts.forEach((item,index)=>lines.push(`${index+1}. ${plain(item.description)} | Qtd: ${Number(item.quantity||0)} | Unit.: ${brl(item.value)} | Subtotal: ${brl(Number(item.quantity||0)*Number(item.value||0))}`));
  lines.push('',`Total de pecas: ${brl(budget.partsTotal)}`,'','SERVICOS EXECUTADOS','----------------------------------------------');
  if(!services.length)lines.push('Nenhum servico informado.');else services.forEach((item,index)=>lines.push(`${index+1}. ${plain(item.description)} | Mecanico: ${plain(item.mechanic)} | Valor: ${brl(item.value)}`));
  lines.push('',`Total de servicos: ${brl(budget.servicesTotal)}`,`TOTAL GERAL: ${brl(budget.total||order.total)}`,'',...field('Condicoes de pagamento',budget.paymentTerms||order.payment),...field('Termo de garantia',budget.warrantyTerms),'CHECKLIST DOS SERVICOS','----------------------------------------------');
  if(!checklist.length)lines.push('Nenhum item informado.');else checklist.forEach(item=>lines.push(`${item.ok?'[X]':'[ ]'} ${plain(item.label)}`));
  lines.push('',`Fotos de entrada: ${(order.photos||[]).length}`,`Fotos dos servicos: ${(budget.photos||[]).length}`,`Assinatura do cliente: ${order.signature?'Registrada':'Nao registrada'}`,`Assinatura do mecanico: ${budget.mechanicSignature?'Registrada':'Nao registrada'}`,'',`Documento gerado em ${new Date().toLocaleString('pt-BR')}`);
  return lines.flatMap(line=>wrap(line));
}

function pdfBlob(lines){
  const chunks=[];for(let index=0;index<lines.length;index+=48)chunks.push(lines.slice(index,index+48));
  const pageIds=chunks.map((_,index)=>4+index*2),contentIds=chunks.map((_,index)=>5+index*2),objects=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
  chunks.forEach((page,index)=>{const stream=`BT\n/F1 9 Tf\n42 800 Td\n12 TL\n${page.map(line=>`(${plain(line).replace(/([\\()])/g,'\\$1')}) Tj T*`).join('\n')}\nET`;objects[pageIds[index]]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;objects[contentIds[index]]=`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`});
  let pdf='%PDF-1.4\n',offsets=[0];for(let id=1;id<objects.length;id++){offsets[id]=new TextEncoder().encode(pdf).length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}const xref=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)pdf+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Blob([pdf],{type:'application/pdf'})
}

async function generatePdf(button){
  const order=currentOrder();if(!order)return alert('Não foi possível localizar esta ordem de serviço.');
  const original=button.textContent;button.disabled=true;button.textContent='Gerando PDF…';
  try{const fileName=`Cortez-Garage-OS-${plain(order.number)}-${plain(order.vehicle?.plate||'sem-placa')}.pdf`,blob=pdfBlob(reportLines(order)),file=new File([blob],fileName,{type:'application/pdf'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`OS #${order.number}`,text:`Ordem de serviço #${order.number} - Cortez Garage`,files:[file]})}else{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=fileName;link.target='_blank';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}}catch(error){if(error.name!=='AbortError')alert(`Não foi possível gerar o PDF.\n\n${error.message}`)}finally{button.disabled=false;button.textContent=original}
}

function wire(){const button=document.querySelector('#print');if(!button||button.dataset.pdfReady)return;button.dataset.pdfReady='1';button.textContent='▣ Gerar PDF';button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();generatePdf(button)},{capture:true})}
new MutationObserver(wire).observe(document.querySelector('#app'),{childList:true,subtree:true});wire();

