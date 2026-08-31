import{getCurrentUser,recordOrderDelivery}from'./supabase.js';

const OWNER='cortezgaragemecanica@gmail.com',DB_KEY='cortez-garage-v1';
const owner=()=>getCurrentUser().email.toLowerCase()===OWNER;
const currentOrder=()=>{const number=document.querySelector('.os-head h2')?.textContent.match(/#(.+)/)?.[1]?.trim();try{return(JSON.parse(localStorage.getItem(DB_KEY)||'{}').orders||[]).find(item=>String(item.number)===number)}catch{return null}};

function installWorkflow(){
  const actions=document.querySelector('.os-head>div:last-child'),status=document.querySelector('#status');
  if(!actions||!status)return;
  if(!document.querySelector('#readyOs')){
    const ready=document.createElement('button');ready.id='readyOs';ready.type='button';ready.className='primary';ready.textContent='✓ Veículo pronto para entrega';
    ready.onclick=()=>{if(status.value==='Entregue')return alert('Esta O.S. já foi entregue.');status.value='Pronto para entrega';status.dispatchEvent(new Event('change',{bubbles:true}));ready.disabled=true;ready.textContent='✓ Pronto para entrega'};
    actions.append(ready);
  }
  if(!owner()){document.querySelector('#openClosing')?.remove();return}
  const billing=document.querySelector('.billing'),save=document.querySelector('#saveOs');
  if(!billing||!save)return;
  billing.classList.add('owner-closing-panel');
  if(!document.querySelector('#openClosing')){
    const open=document.createElement('button');open.id='openClosing';open.type='button';open.className='secondary';open.textContent='Fechamento';open.onclick=()=>{billing.classList.add('closing-open');billing.scrollIntoView({behavior:'smooth',block:'start'})};actions.append(open);
  }
  const payment=document.querySelector('#payment');
  const paymentLabel=payment?.closest('label')?.querySelector('span');if(paymentLabel)paymentLabel.textContent='Condição / forma de pagamento';
  for(const value of ['Pix ML','Pix BB'])if(payment&&![...payment.options].some(option=>option.value===value))payment.add(new Option(value,value));
  if(save.dataset.closingInstalled)return;
  save.dataset.closingInstalled='1';save.textContent='Fechar O.S.';
  const originalSave=save.onclick;
  save.onclick=async event=>{
    event.preventDefault();
    if(!payment?.value)return alert('Selecione a condição / forma de pagamento antes de fechar a O.S.');
    if(!confirm('Fechar esta O.S. como Entregue e lançar o recebimento no caixa?'))return;
    save.disabled=true;save.textContent='Fechando…';status.value='Entregue';
    try{await originalSave?.call(save,event);const order=currentOrder();if(!order)throw new Error('Não foi possível localizar a ordem de serviço.');await recordOrderDelivery(order,payment.value);save.disabled=true;save.textContent='✓ O.S. entregue';alert('O.S. fechada. O contas a receber foi baixado e o valor entrou no caixa.')}catch(error){save.disabled=false;save.textContent='Fechar O.S.';alert(error.message)}
  };
}

new MutationObserver(installWorkflow).observe(document.querySelector('#app'),{childList:true,subtree:true});
installWorkflow();
