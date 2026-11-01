const RELEASE='20261101-6';
const RELEASE_KEY='cortez-web-release';
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const activateRelease=async()=>{
  let previousRelease='';
  try{previousRelease=localStorage.getItem(RELEASE_KEY)||''}catch(error){console.warn('Não foi possível consultar a versão local:',error)}
  try{localStorage.setItem(RELEASE_KEY,RELEASE)}catch(error){console.warn('Não foi possível registrar a versão localmente:',error)}
  const url=new URL(location.href);
  if(url.searchParams.get('release')!==RELEASE){url.searchParams.set('release',RELEASE);history.replaceState(history.state,'',url.href)}
  if(previousRelease===RELEASE)return;
  const cleanup=[];
  if(window.caches?.keys)cleanup.push(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));
  if(navigator.serviceWorker?.getRegistrations)cleanup.push(navigator.serviceWorker.getRegistrations().then(items=>Promise.all(items.map(item=>item.unregister()))));
  await Promise.race([Promise.allSettled(cleanup),wait(1800)]);
};
await activateRelease();

const loadModules=async(names,label)=>{
  const failed=[];
  for(let index=0;index<names.length;index+=3){
    const batch=names.slice(index,index+3),results=await Promise.allSettled(batch.map(name=>import(name)));
    failed.push(...results.filter(result=>result.status==='rejected'));
    await wait(0);
  }
  if(failed.length)console.error(`Falha ao carregar ${label}`,failed.map(result=>result.reason));
  return failed.length===0;
};

const manifest=document.querySelector('#moduleManifest');
const modules=value=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
if(!manifest)throw new Error('Manifesto de módulos não encontrado.');
try{
  const mainUrl=new URL(manifest.dataset.main,import.meta.url);
  mainUrl.searchParams.set('release',RELEASE);
  await import(mainUrl.href);
}catch(error){
  console.error('Falha ao iniciar o aplicativo',error);
  const app=document.querySelector('#app');
  if(app)app.innerHTML=`<main class="login-page"><div class="login-card"><img src="./official-logo.png" alt="Cortez Garage"><h1>Não foi possível abrir o aplicativo</h1><p>O carregamento foi interrompido. Atualize para tentar novamente sem apagar os dados deste aparelho.</p><button class="primary wide" id="retryAppBoot">Tentar novamente</button><small>${String(error?.message||'Falha de inicialização').replace(/[<>&]/g,'')}</small></div></main>`;
  document.querySelector('#retryAppBoot')?.addEventListener('click',()=>location.reload());
  throw error;
}
const workflowModules=modules(manifest.dataset.workflow),featureModules=modules(manifest.dataset.features);

const workflowReady=loadModules(workflowModules,'recursos da O.S.');
const schedule=window.requestIdleCallback||((callback,options)=>setTimeout(callback,Math.min(options?.timeout||500,500)));
schedule(async()=>{
  const[,featuresReady]=await Promise.all([workflowReady,loadModules(featureModules,'áreas complementares')]);
  document.documentElement.dataset.modulesReady=featuresReady?'true':'partial';
  document.dispatchEvent(new CustomEvent('cortez:modules-ready',{detail:{featuresReady}}));
},{timeout:700});
