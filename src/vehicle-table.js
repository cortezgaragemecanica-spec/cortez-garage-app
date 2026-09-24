const TABLES=[
  {
    selector:'.delete-vehicle',className:'vehicle-table',label:'Veículos cadastrados',
    columns:['Placa','Veículo','Ano','Cor','Quilometragem','Ações'],
    values(source){
      const plate=source?.querySelector('h3')?.textContent?.trim()||'Sem placa';
      const [model,year]=splitLast(source?.querySelector('p')?.textContent,'Ano não informado');
      const [color,km]=splitLast(source?.querySelector('small')?.textContent,'0 km');
      return {label:`${plate}, ${model}. Abrir histórico do veículo`,removeLabel:`Excluir veículo ${plate}`,cells:[[plate,'vehicle-plate'],[model,'vehicle-model'],[year,'vehicle-year'],[color,'vehicle-color'],[km,'vehicle-km']]};
    }
  },
  {
    selector:'.delete-client',className:'client-table',label:'Clientes cadastrados',
    columns:['Cliente','Telefone','CPF','Endereço','Veículos','Ações'],
    values(source){
      const name=source?.querySelector('h3')?.textContent?.trim()||'Sem nome';
      const phone=source?.querySelector('p')?.textContent?.trim()||'Não informado';
      const details=String(source?.querySelector('small')?.textContent||'').split(' · ').filter(Boolean);
      if(details.at(-1)?.toLowerCase().includes('toque para'))details.pop();
      const vehicles=details.pop()||'0 veículos';
      const cpf=details[0]?.startsWith('CPF ')?details.shift().slice(4):'Não informado';
      const address=details.join(' · ')||'Não informado';
      return {label:`${name}. Abrir histórico do cliente`,removeLabel:`Excluir cliente ${name}`,cells:[[name,'client-name'],[phone,'client-phone'],[cpf,'client-cpf'],[address,'client-address'],[vehicles,'client-vehicles']]};
    }
  }
];

function splitLast(value,fallback){
  const parts=String(value||'').split(' · ');
  if(parts.length<2)return [String(value||fallback),fallback];
  return [parts.slice(0,-1).join(' · '),parts.at(-1)];
}

function cell(value,className){
  const element=document.createElement('span');
  element.className=`people-table-cell ${className}`;
  element.setAttribute('role','cell');
  element.textContent=value;
  return element;
}

function enhancePeopleTable(){
  const list=document.querySelector('.people-cards');
  if(!list||list.dataset.peopleTable==='ready')return;
  const config=TABLES.find(item=>list.querySelector(item.selector));
  if(!config)return;

  list.dataset.peopleTable='ready';
  list.classList.add('people-table',config.className);
  list.setAttribute('role','table');
  list.setAttribute('aria-label',config.label);

  const header=document.createElement('div');
  header.className='people-table-head';
  header.setAttribute('role','row');
  config.columns.forEach(label=>{
    const heading=document.createElement('span');
    heading.setAttribute('role','columnheader');
    heading.textContent=label;
    header.append(heading);
  });
  list.prepend(header);

  list.querySelectorAll('.people-card').forEach(row=>{
    const source=row.querySelector(':scope > div');
    const {label,removeLabel,cells}=config.values(source);
    const remove=row.querySelector(config.selector);

    row.querySelector(':scope > i')?.remove();
    source?.remove();
    row.setAttribute('role','row');
    row.tabIndex=0;
    row.setAttribute('aria-label',label);
    cells.forEach(([value,className])=>row.insertBefore(cell(value,className),remove));
    remove?.setAttribute('aria-label',removeLabel);
  });
}

new MutationObserver(enhancePeopleTable).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhancePeopleTable();

document.addEventListener('keydown',event=>{
  const row=event.target.closest?.('.people-table .people-card');
  if(!row||event.target.closest?.('button,input,select,textarea,a')||!['Enter',' '].includes(event.key))return;
  event.preventDefault();
  row.click();
});

export {enhancePeopleTable,splitLast};
