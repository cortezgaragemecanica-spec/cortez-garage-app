const DIALOG_SELECTOR='.check-popup,.pdf-preview,.report-pdf-preview,.part-popup';
const CLOSE_SELECTOR='#cancelCheckDescription,#cancelDeliveryCash,.cancel-finance-popup,.cancel-agenda-popup,.close-weekly,.close-commission-summary,.pdf-preview-back,.pdf-preview-close,.close-report-pdf,.close-agenda-pdf,.part-popup-close';
let previousFocus=null;

function focusable(dialog){
  return [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hidden&&element.offsetParent!==null);
}

function prepareDialog(dialog){
  if(dialog.dataset.accessibleDialog)return;
  dialog.dataset.accessibleDialog='true';
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  const heading=dialog.querySelector('h1,h2,h3');
  if(heading){
    heading.id||=`dialog-title-${crypto.randomUUID()}`;
    dialog.setAttribute('aria-labelledby',heading.id);
  }else dialog.setAttribute('aria-label','Janela de diálogo');
  previousFocus=document.activeElement;
  requestAnimationFrame(()=>focusable(dialog)[0]?.focus());
}

function activeDialog(){return [...document.querySelectorAll(DIALOG_SELECTOR)].at(-1)}

new MutationObserver(mutations=>{
  for(const mutation of mutations)for(const node of mutation.addedNodes){
    if(!(node instanceof Element))continue;
    if(node.matches(DIALOG_SELECTOR))prepareDialog(node);
    node.querySelectorAll?.(DIALOG_SELECTOR).forEach(prepareDialog);
  }
}).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('keydown',event=>{
  const dialog=activeDialog();
  if(!dialog)return;
  if(event.key==='Escape'){
    const close=dialog.querySelector(CLOSE_SELECTOR);
    if(close){event.preventDefault();close.click();requestAnimationFrame(()=>previousFocus?.focus?.())}
    return;
  }
  if(event.key!=='Tab')return;
  const elements=focusable(dialog);
  if(!elements.length){event.preventDefault();return}
  const first=elements[0],last=elements.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

