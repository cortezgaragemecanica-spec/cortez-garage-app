const COLUMNS=['Placa','Veículo','Ano','Cor','Quilometragem','Ações'];

function splitLast(value,fallback){
  const parts=String(value||'').split(' · ');
  if(parts.length<2)return [String(value||fallback),fallback];
  return [parts.slice(0,-1).join(' · '),parts.at(-1)];
}

function cell(value,className){
  const element=document.createElement('span');
  element.className=`vehicle-table-cell ${className}`;
  element.setAttribute('role','cell');
  element.textContent=value;
  return element;
}

function enhanceVehicleTable(){
  const list=document.querySelector('.people-cards');
  if(!list?.querySelector('.delete-vehicle')||list.dataset.vehicleTable==='ready')return;

  list.dataset.vehicleTable='ready';
  list.classList.add('vehicle-table');
  list.setAttribute('role','table');
  list.setAttribute('aria-label','Veículos cadastrados');

  const header=document.createElement('div');
  header.className='vehicle-table-head';
  header.setAttribute('role','row');
  COLUMNS.forEach(label=>{
    const heading=document.createElement('span');
    heading.setAttribute('role','columnheader');
    heading.textContent=label;
    header.append(heading);
  });
  list.prepend(header);

  list.querySelectorAll('.people-card').forEach(row=>{
    const source=row.querySelector(':scope > div');
    const plate=source?.querySelector('h3')?.textContent?.trim()||'Sem placa';
    const [model,year]=splitLast(source?.querySelector('p')?.textContent,'Ano não informado');
    const [color,km]=splitLast(source?.querySelector('small')?.textContent,'0 km');
    const remove=row.querySelector('.delete-vehicle');

    row.querySelector(':scope > i')?.remove();
    source?.remove();
    row.setAttribute('role','row');
    row.tabIndex=0;
    row.setAttribute('aria-label',`${plate}, ${model}. Abrir histórico do veículo`);
    row.insertBefore(cell(plate,'vehicle-plate'),remove);
    row.insertBefore(cell(model,'vehicle-model'),remove);
    row.insertBefore(cell(year,'vehicle-year'),remove);
    row.insertBefore(cell(color,'vehicle-color'),remove);
    row.insertBefore(cell(km,'vehicle-km'),remove);
    remove?.setAttribute('aria-label',`Excluir veículo ${plate}`);
  });
}

new MutationObserver(enhanceVehicleTable).observe(document.querySelector('#app'),{childList:true,subtree:true});
enhanceVehicleTable();

document.addEventListener('keydown',event=>{
  const row=event.target.closest?.('.vehicle-table .people-card');
  if(!row||event.target.closest?.('button,input,select,textarea,a')||!['Enter',' '].includes(event.key))return;
  event.preventDefault();
  row.click();
});

export {enhanceVehicleTable,splitLast};
