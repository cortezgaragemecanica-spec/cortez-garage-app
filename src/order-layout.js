import{onUiUpdated}from'./ui-events.js';

const SECONDARY_ACTIONS=[
  'editOsIdentity',
  'advanceOs',
  'releaseOrderCommissions',
  'toggleOrderChecklist',
  'requestParts',
  'savedEntryReceipt',
  'requestServiceQuote',
  'openTechnicalReport',
  'deleteOs'
];

const ACTION_LABELS={
  print:'Gerar PDF da ordem de serviço',
  openClosing:'Abrir fechamento da ordem de serviço',
  closedOrderReceipt:'Gerar recibo da ordem de serviço',
  editOsIdentity:'Editar dados da ordem de serviço',
  advanceOs:'Registrar adiantamento',
  releaseOrderCommissions:'Liberar comissões antecipadas',
  toggleOrderChecklist:'Exibir ou ocultar checklist',
  requestParts:'Solicitar peças',
  savedEntryReceipt:'Gerar comprovante de entrada',
  requestServiceQuote:'Solicitar orçamento de serviços',
  openTechnicalReport:'Abrir laudo técnico',
  deleteOs:'Excluir ordem de serviço',
  ownerDiagnosisObservation:'Inserir diagnóstico e observações'
};

function actionMenu(actions){
  let details=actions.querySelector('#orderMoreActions');
  if(details)return details;
  details=document.createElement('details');
  details.id='orderMoreActions';
  details.className='order-more-actions';
  details.innerHTML='<summary aria-label="Abrir mais ações da ordem de serviço"><span aria-hidden="true">•••</span> Mais ações</summary><div class="order-more-actions-menu" role="group" aria-label="Ações adicionais da ordem de serviço"></div>';
  details.addEventListener('click',event=>{
    if(event.target.closest('.order-more-actions-menu button')&&!event.target.disabled)details.open=false;
  });
  actions.append(details);
  return details;
}

function labelControls(root){
  const labels={status:'Status da ordem de serviço',complaint:'Reclamação do cliente',diagnosis:'Diagnóstico técnico',services:'Observações do serviço',parts:'Peças e materiais',labor:'Valor da mão de obra',partsValue:'Valor das peças e materiais',discount:'Valor do desconto',payment:'Forma de pagamento',sign:'Assinatura do cliente',saveOs:'Salvar ordem de serviço'};
  for(const[id,label]of Object.entries(labels)){
    const element=root.querySelector(`#${id}`);
    if(element&&!element.getAttribute('aria-label'))element.setAttribute('aria-label',label);
  }
  root.querySelectorAll('.pdf-preview-close,.check-popup-close').forEach(button=>button.setAttribute('aria-label','Fechar'));
}

function decorateOrder(){
  const head=document.querySelector('.os-head'),grid=document.querySelector('.os-grid');
  if(!head||!grid)return;
  const actions=head.querySelector(':scope>div:last-child');
  if(!actions)return;

  head.classList.add('order-command-bar');
  actions.classList.add('order-primary-actions');
  grid.querySelector(':scope>div>.detail')?.classList.add('order-summary-card');
  document.querySelector('#diagnosis')?.closest('.detail')?.classList.add('order-diagnosis-card');
  grid.querySelector('.billing')?.classList.add('order-closing-card');

  const details=actionMenu(actions),menu=details.querySelector('.order-more-actions-menu');
  for(const id of SECONDARY_ACTIONS){
    const button=document.querySelector(`#${id}`);
    if(button&&button.parentElement!==menu)menu.append(button);
  }
  details.hidden=!menu.children.length;

  for(const[id,label]of Object.entries(ACTION_LABELS)){
    const button=document.querySelector(`#${id}`);
    if(button&&!button.getAttribute('aria-label'))button.setAttribute('aria-label',label);
  }
  labelControls(document);
}

onUiUpdated(decorateOrder);
document.addEventListener('cortez:modules-ready',decorateOrder);
