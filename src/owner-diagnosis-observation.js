import {getCurrentUser} from './supabase.js?v=20261009-5';

const OWNER_EMAIL='cortezgaragemecanica@gmail.com';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const owner=()=>getCurrentUser().email.toLowerCase()===OWNER_EMAIL;

function closeEditor(modal){
  modal.remove();
  document.body.classList.remove('pdf-preview-open');
}

function openEditor(){
  const diagnosis=document.querySelector('#diagnosis'),observation=document.querySelector('#services');
  if(!diagnosis||!observation)return;
  document.querySelector('.owner-diagnosis-modal')?.remove();
  const modal=document.createElement('div');
  modal.className='check-popup owner-diagnosis-modal';
  modal.innerHTML=`<form class="check-popup-card"><span class="eyebrow">DIAGNÓSTICO E OBSERVAÇÕES</span><h3>Informações que entrarão no PDF</h3><p>Preencha os textos e salve. Eles ficarão registrados na O.S. e serão incluídos no orçamento ou ordem de serviço.</p><label><span>Diagnóstico técnico</span><textarea name="diagnosis" rows="7" placeholder="Informe o diagnóstico técnico">${esc(diagnosis.value)}</textarea></label><label><span>Observações</span><textarea name="observation" rows="5" placeholder="Digite as observações do serviço">${esc(observation.value)}</textarea></label><div class="check-popup-actions"><button type="button" class="secondary cancel-owner-diagnosis">Cancelar</button><button class="primary">Salvar diagnóstico e observações</button></div></form>`;
  const form=modal.querySelector('form');
  modal.querySelector('.cancel-owner-diagnosis').onclick=()=>closeEditor(modal);
  form.onsubmit=event=>{
    event.preventDefault();
    diagnosis.value=form.elements.diagnosis.value.trim();
    observation.value=form.elements.observation.value.trim();
    diagnosis.dispatchEvent(new Event('input',{bubbles:true}));
    observation.dispatchEvent(new Event('input',{bubbles:true}));
    closeEditor(modal);
    document.querySelector('#saveOs')?.click();
  };
  document.body.append(modal);
  form.elements.diagnosis.focus();
}

function install(){
  const diagnosis=document.querySelector('#diagnosis');
  if(!owner()||!diagnosis||document.querySelector('#ownerDiagnosisObservation'))return;
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
