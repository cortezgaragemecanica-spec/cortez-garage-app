const SPREADSHEET_ID='1wUDxNwi1ks752davu0Aoa41yCXFWAwS-_W350ZgmrFA';
const HEADER_ROW=3;
const APP_DATA_SHEET='App Dados';
const DRIVE_FOLDER='Cortez Garage - Arquivos do App';

function doGet(){return json_({ok:true,service:'Cortez Garage Sync',version:1})}
function doPost(event){
  try{
    const body=JSON.parse(event.postData.contents||'{}');
    const expected=PropertiesService.getScriptProperties().getProperty('CORTEZ_API_TOKEN');
    if(!expected||body.token!==expected)return json_({ok:false,error:'Acesso não autorizado'});
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{
      if(body.action==='deleteOrder'){deleteOrder_(body.number,body.id);return json_({ok:true})}
      if(body.action!=='sync')return json_({ok:false,error:'Ação inválida'});
      const db=body.db||{};writeDatabase_(db);return json_({ok:true,db:readDatabase_()})
    }finally{lock.releaseLock()}
  }catch(error){return json_({ok:false,error:String(error&&error.message||error)})}
}

function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function rows_(name,width){const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);const last=Math.max(sheet.getLastRow(),HEADER_ROW);return{sheet,values:last>HEADER_ROW?sheet.getRange(HEADER_ROW+1,1,last-HEADER_ROW,width).getValues():[]}}
function clean_(value){return String(value==null?'':value).trim()}
function phone_(value){return clean_(value).replace(/\D/g,'')}
function plate_(value){return clean_(value).replace(/[^a-z0-9]/gi,'').toUpperCase()}
function dateText_(value){if(!value)return'';if(value instanceof Date)return Utilities.formatDate(value,Session.getScriptTimeZone(),'yyyy-MM-dd');const match=clean_(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return match?`${match[3]}-${match[2]}-${match[1]}`:clean_(value).slice(0,10)}
function sheetDate_(value){const text=dateText_(value);if(!text)return'';const parts=text.split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2])}
function statusToSheet_(value){return({'Em andamento':'Em serviço','Pronto para entrega':'Pronto','Entregue':'Concluído'})[value]||value||'Aguardando diagnóstico'}
function statusToApp_(value){return({'Em serviço':'Em andamento','Pronto':'Pronto para entrega','Concluído':'Entregue','Concluído - veículo entregue':'Entregue','Pronto - aguardando entrega':'Pronto para entrega'})[value]||value||'Aguardando diagnóstico'}
function appData_(){const book=SpreadsheetApp.openById(SPREADSHEET_ID);let sheet=book.getSheetByName(APP_DATA_SHEET);if(!sheet){sheet=book.insertSheet(APP_DATA_SHEET);sheet.getRange(1,1,1,2).setValues([['Ordem','Dados JSON']]);sheet.hideSheet()}return sheet}
function metadata_(){const sheet=appData_(),last=sheet.getLastRow(),map=new Map();if(last>1)sheet.getRange(2,1,last-1,2).getValues().forEach((row,i)=>{try{map.set(clean_(row[0]),{row:i+2,data:JSON.parse(row[1]||'{}')})}catch{}});return{sheet,map}}
function folder_(){const folders=DriveApp.getFoldersByName(DRIVE_FOLDER);return folders.hasNext()?folders.next():DriveApp.createFolder(DRIVE_FOLDER)}
function storeMedia_(value,name){if(!clean_(value).startsWith('data:'))return value;const match=String(value).match(/^data:([^;]+);base64,(.+)$/);if(!match)return value;const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[match[1]]||'bin',file=folder_().createFile(Utilities.newBlob(Utilities.base64Decode(match[2]),match[1],`${name}.${extension}`));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return`https://drive.google.com/uc?export=view&id=${file.getId()}`}
function saveMetadata_(order,store){
  const key=clean_(order.number).replace(/^0+/,'')||'0',found=store.map.get(key),previous=found?.data||{},incomingPhotos=order.photos||[],photos=[...(previous.photos||[]),...incomingPhotos].filter((value,index,list)=>value&&list.indexOf(value)===index).map((value,index)=>storeMedia_(value,`OS-${key}-foto-${index+1}`)),signature=storeMedia_(order.signature||previous.signature||'',`OS-${key}-assinatura-cliente`),previousBudget=previous.budget||{},incomingBudget=order.budget||{},budgetPhotos=[...(previousBudget.photos||[]),...(incomingBudget.photos||[])].filter((value,index,list)=>value&&list.indexOf(value)===index).map((value,index)=>storeMedia_(value,`OS-${key}-servico-${index+1}`)),mechanicSignature=storeMedia_(incomingBudget.mechanicSignature||previousBudget.mechanicSignature||'',`OS-${key}-assinatura-mecanico`),budget={...previousBudget,...incomingBudget,photos:budgetPhotos,mechanicSignature},merged={...previous,...order,photos,signature,budget,checklist:(order.checklist||[]).length?order.checklist:(previous.checklist||[]),notes:order.notes||previous.notes||'',damage:order.damage||previous.damage||''},json=JSON.stringify(merged);
  if(found)store.sheet.getRange(found.row,2).setValue(json);else{store.sheet.appendRow([key,json]);store.map.set(key,{row:store.sheet.getLastRow(),data:merged})}return merged
}

function deleteOrder_(number,id){
  const key=clean_(number).replace(/^0+/,'')||'0',orders=rows_('Ordens de Serviço',13);
  for(let index=orders.values.length-1;index>=0;index--){const rowKey=clean_(orders.values[index][0]).replace(/^0+/,'')||'0';if(rowKey===key)orders.sheet.deleteRow(index+HEADER_ROW+1)}
  const store=metadata_(),found=store.map.get(key);
  if(found&&(!id||!found.data.id||found.data.id===id||String(id)===`sheet-order-${key}`))store.sheet.deleteRow(found.row)
}

function writeDatabase_(db){
  const clients=rows_('Clientes',6),clientIndex=new Map(clients.values.map((row,i)=>[phone_(row[2])||clean_(row[1]).toLowerCase(),i+HEADER_ROW+1]));
  (db.clients||[]).forEach(client=>{const key=phone_(client.phone)||clean_(client.name).toLowerCase();if(!key)return;const row=[clientIndex.size+1,client.name||'',client.phone||'','','',client.notes||'Sincronizado pelo aplicativo'];const found=clientIndex.get(key);if(found)clients.sheet.getRange(found,2,1,5).setValues([row.slice(1)]);else{clients.sheet.appendRow(row);clientIndex.set(key,clients.sheet.getLastRow())}});
  const vehicles=rows_('Veículos',9),vehicleIndex=new Map(vehicles.values.map((row,i)=>[plate_(row[0]),i+HEADER_ROW+1]));
  (db.vehicles||[]).forEach(vehicle=>{const key=plate_(vehicle.plate);if(!key)return;const owner=(db.clients||[]).find(client=>client.id===vehicle.clientId)?.name||'';const model=clean_(vehicle.model),parts=model.split(/\s+/),brand=parts.shift()||'';const row=[key,owner,brand,parts.join(' '),Number(vehicle.year)||'', '',Number(vehicle.km)||'',vehicle.fuel||'',vehicle.color?`Cor: ${vehicle.color}`:''];const found=vehicleIndex.get(key);if(found)vehicles.sheet.getRange(found,1,1,9).setValues([row]);else{vehicles.sheet.appendRow(row);vehicleIndex.set(key,vehicles.sheet.getLastRow())}});
  const orders=rows_('Ordens de Serviço',13),orderIndex=new Map(orders.values.map((row,i)=>[clean_(row[0]),i+HEADER_ROW+1])),store=metadata_();let next=Math.max(0,...orders.values.map(row=>Number(row[0])||0))+1;
  (db.orders||[]).forEach(order=>{let key=clean_(order.number).replace(/^0+/,'')||'0',saved=store.map.get(key)?.data;if(saved?.id&&order.id&&saved.id!==order.id&&!String(order.id).startsWith('sheet-order-')){key=String(next++);order.number=key.padStart(4,'0')}order=saveMetadata_(order,store);const row=[Number(key),sheetDate_(order.created),order.client?.name||'',plate_(order.vehicle?.plate),'',order.complaint||'',order.diagnosis||'',order.services||'',order.parts||'',Number(order.total)||0,statusToSheet_(order.status),sheetDate_(order.delivery),order.mechanic||''];const found=orderIndex.get(key);if(found)orders.sheet.getRange(found,1,1,13).setValues([row]);else{orders.sheet.appendRow(row);orderIndex.set(key,orders.sheet.getLastRow())}});
}

function readDatabase_(){
  const clientRows=rows_('Clientes',6).values.filter(row=>clean_(row[1])),clients=clientRows.map(row=>({id:`sheet-client-${clean_(row[0])}`,name:clean_(row[1]),phone:clean_(row[2]),notes:clean_(row[5])}));
  const vehicleRows=rows_('Veículos',9).values.filter(row=>plate_(row[0])),vehicles=vehicleRows.map(row=>{const owner=clients.find(client=>client.name.toLowerCase()===clean_(row[1]).toLowerCase());return{id:`sheet-vehicle-${plate_(row[0])}`,plate:plate_(row[0]),model:[row[2],row[3]].filter(Boolean).join(' '),year:clean_(row[4]),color:clean_(row[8]).replace(/^Cor:\s*/i,''),km:clean_(row[6]),fuel:clean_(row[7]),clientId:owner?.id||''}});
  const stored=metadata_().map,orderRows=rows_('Ordens de Serviço',13).values.filter(row=>clean_(row[0])),orders=orderRows.map(row=>{const key=clean_(row[0]),plate=plate_(row[3]),vehicle=vehicles.find(item=>item.plate===plate)||{plate,model:''},client=clients.find(item=>item.name.toLowerCase()===clean_(row[2]).toLowerCase())||{name:clean_(row[2]),phone:''},base={id:`sheet-order-${key}`,number:String(row[0]).padStart(4,'0'),created:dateText_(row[1])||new Date().toISOString(),client,vehicle,complaint:clean_(row[5]),notes:'',mechanic:clean_(row[12]),delivery:dateText_(row[11]),damage:'',checklist:[],status:statusToApp_(clean_(row[10])),diagnosis:clean_(row[6]),services:clean_(row[7]),parts:clean_(row[8]),labor:0,partsValue:0,discount:0,total:Number(row[9])||0,payment:'',signature:'',photos:[]};return{...base,...(stored.get(key.replace(/^0+/,'')||'0')?.data||{}),number:base.number,status:base.status,total:base.total}});
  const max=orders.reduce((value,order)=>Math.max(value,Number(order.number)||0),0);return{clients,vehicles,orders,counter:max+1};
}

