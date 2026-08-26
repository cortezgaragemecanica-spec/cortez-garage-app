const DB_KEY='cortez-garage-v1';
const CONFIG_KEY='cortez-garage-sync-v1';

const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};

async function removeFromServer(order,config){
  const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteOrder',token:config.token,number:order.number,id:order.id})});
  if(!response.ok)throw new Error(`Falha na sincronização (${response.status})`);
  const result=await response.json();
  if(!result.ok)throw new Error(result.error||'Falha ao excluir a ordem');
}

async function deleteCurrentOrder(button){
  const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();
  const database=readJson(DB_KEY,{orders:[]});
  const order=database.orders?.find(item=>String(item.number)===number);
  if(!order)return alert('Não foi possível localizar esta ordem de serviço.');
  if(!confirm(`Excluir permanentemente a OS #${order.number}?\n\nEla será removida da planilha e de todos os aparelhos sincronizados.`))return;
  button.disabled=true;button.textContent='Excluindo…';
  try{
    const config=readJson(CONFIG_KEY,null);
    if(config)await removeFromServer(order,config);
    database.orders=database.orders.filter(item=>item.id!==order.id);
    localStorage.setItem(DB_KEY,JSON.stringify(database));
    location.reload();
  }catch(error){
    button.disabled=false;button.textContent='Excluir O.S.';
    alert(`Não foi possível excluir. Nenhum dado foi apagado.\n\n${error.message}`);
  }
}

function addDeleteButton(){
  const actions=document.querySelector('.os-head>div:last-child');
  if(!actions||document.querySelector('#deleteOs'))return;
  const button=document.createElement('button');
  button.id='deleteOs';button.className='danger';button.type='button';button.textContent='Excluir O.S.';
  button.addEventListener('click',()=>deleteCurrentOrder(button));
  actions.append(button);
}

new MutationObserver(addDeleteButton).observe(document.querySelector('#app'),{childList:true,subtree:true});
addDeleteButton();

