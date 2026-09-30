const callbacks=new Set();
let frame=0,observer=null;

function flush(){
  frame=0;
  callbacks.forEach(callback=>{
    try{callback()}catch(error){console.error('Falha ao atualizar a interface',error)}
  });
}

function schedule(){
  if(frame)return;
  frame=requestAnimationFrame(flush);
}

function observe(){
  if(observer)return;
  const app=document.querySelector('#app');
  if(!app)return;
  observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
}

export function onUiUpdated(callback,{immediate=true}={}){
  callbacks.add(callback);
  observe();
  if(immediate)callback();
  return()=>callbacks.delete(callback);
}
