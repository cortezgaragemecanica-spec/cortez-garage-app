import{getCurrentUser,getManagedUser}from'./supabase.js?v=20261023-1';
import{canUseOrderRequestForms}from'./order-request-access.js?v=20261031-1';

const requestAccess=()=>{const user=getCurrentUser();return canUseOrderRequestForms(user,getManagedUser(user.email))};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function closeEditor(modal){
  modal.remove();
  document.body.classList.remove('pdf-preview-open');
}

function openEditor(){
  if(!requestAccess())return alert('Solicite pelo grupo do WhatsApp Diagnóstico e Observações.');
  const diagnosis=document.querySelector('#diagnosis'),observation=document.querySelector('#services');
  if(!diagnosis||!observation)return;
  document.querySelector('.owner-diagnosis-modal')?.remove();
  const modal=document.createElement('div');
  modal.className='check-popup owner-diagnosis-modal';
  modal.innerHTML=`<form class="check-popup-card"><span class="eyebrow">DIAGNÓSTICO E OBSERVAÇÕES</span><h3>Informações que entrarão no PDF</h3><p>Preencha os textos e salve. Eles ficarão registrados na O.S. e serão incluídos no orçamento ou ordem de serviço.</p><label><span>Diagnóstico técnico</span><textarea name="diagnosis" rows="7" placeholder="Informe o diagnóstico técnico">${esc(diagnosis.value)}</textarea></label><label><span>Observações</span><textarea name="observation" rows="5" placeholder="Digite as observações do serviço">${esc(observation.value)}</textarea></label><div class="check-popup-actions"><button type="button" class="secondary cancel-owner-diagnosis">Cancelar</button><button class="primary">Salvar diagnóstico e observações</button></div></form>`;
  const form=modal.querySelector('form');
  modal.querySelector('.cancel-owner-diagnosis').onclick=()=>closeEditor(modal);
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=event.submitter;
    button.disabled=true;
    button.textContent='Salvando…';
    diagnosis.value=form.elements.diagnosis.value.trim();
    observation.value=form.elements.observation.value.trim();
    diagnosis.dispatchEvent(new Event('input',{bubbles:true}));
    observation.dispatchEvent(new Event('input',{bubbles:true}));
    const save=document.querySelector('#saveOs');
    if(save?._persistTextFields){const saved=await save._persistTextFields();if(!saved){button.disabled=false;button.textContent='Salvar diagnóstico e observações';return}}
    else save?.click();
    closeEditor(modal);
  };
  document.body.append(modal);
  form.elements.diagnosis.focus();
}

function install(){
  const diagnosis=document.querySelector('#diagnosis');
  if(!diagnosis||document.querySelector('#ownerDiagnosisObservation'))return;
  const section=diagnosis.closest('section');
  if(!section)return;
  const button=document.createElement('button');
  button.type='button';
  button.id='ownerDiagnosisObservation';
  button.className='secondary';
  button.textContent='✎ Inserir diagnóstico e observações';
  button.onclick=openEditor;
  section.querySelector('h3')?.insertAdjacentElement('afterend',button);
}

new MutationObserver(install).observe(document.querySelector('#app'),{childList:true,subtree:true});
install();
