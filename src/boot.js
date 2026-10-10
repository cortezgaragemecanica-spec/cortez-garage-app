const RELEASE='20261010-2';
const RELEASE_KEY='cortez-web-release';
const activateRelease=async()=>{
  if(localStorage.getItem(RELEASE_KEY)===RELEASE)return;
  localStorage.setItem(RELEASE_KEY,RELEASE);
  const tasks=[];
  if(window.caches?.keys)tasks.push(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));
  if(navigator.serviceWorker?.getRegistrations)tasks.push(navigator.serviceWorker.getRegistrations().then(items=>Promise.all(items.map(item=>item.unregister()))));
  await Promise.allSettled(tasks);
  const url=new URL(location.href);url.searchParams.set('release',RELEASE);location.replace(url.href);
  await new Promise(()=>{});
};
await activateRelease();

const loadModules=async(names,label)=>{
  const results=await Promise.allSettled(names.map(name=>import(name)));
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.error(`Falha ao carregar ${label}`,failed.map(result=>result.reason));
  return failed.length===0;
};

const manifest=document.querySelector('#moduleManifest');
const modules=value=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
if(!manifest)throw new Error('Manifesto de módulos não encontrado.');
await import(manifest.dataset.main);
const workflowModules=modules(manifest.dataset.workflow),featureModules=modules(manifest.dataset.features);

const workflowReady=loadModules(workflowModules,'recursos da O.S.');
const schedule=window.requestIdleCallback||((callback,options)=>setTimeout(callback,Math.min(options?.timeout||500,500)));
schedule(async()=>{
  const[,featuresReady]=await Promise.all([workflowReady,loadModules(featureModules,'áreas complementares')]);
  document.documentElement.dataset.modulesReady=featuresReady?'true':'partial';
  document.dispatchEvent(new CustomEvent('cortez:modules-ready',{detail:{featuresReady}}));
},{timeout:700});
