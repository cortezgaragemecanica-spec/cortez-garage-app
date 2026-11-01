// Atualiza os compromissos previstos e a distribuição quinzenal dos custos fixos.
const CACHE='cortez-garage-v318-mechanic-request-access';
const ROOT=new URL('./',self.location).pathname;
const SHELL=[
  './',
  './index.html',
  './src/style.css?v=20261031-5&w=25',
  './src/checklist.css?v=20260829-3',
  './src/monthly-closing.css?v=20261001-1',
  './src/boot.js?v=20261017-2',
  './src/main.js?v=20261017-1&w=25',
  './src/access-control.js?v=20261009-2',
  './src/budget-order.js?v=20261017-1',
  './src/pdf-order.js?v=20261017-1',
  './src/owner-diagnosis-observation.js?v=20261031-1',
  './src/order-workflow.js?v=20261031-1',
  './src/order-stock-links.js?v=20261008-1',
  './src/order-status.js?v=20261009-3',
  './src/delete-order.js?v=20260905-1',
  './src/entry-receipt.js?v=20260911-2',
  './src/closed-order-receipt.js?v=20261006-1',
  './src/dialog-accessibility.js?v=20260924-1',
  './src/order-layout.js?v=20261017-1',
  './src/vehicle-table.js?v=20260924-3',
  './src/checklist-history.js?v=20260924-1',
  './src/shopping.js?v=20261024-1',
  './src/shopping-checklist-data.js?v=20261023-8',
  './src/stock.js?v=20261008-1&w=4',
  './src/admin.js?v=20261031-10&w=48',
  './src/luizinho-returns.js?v=20261009-1',
  './src/reports.js?v=20260918-1&w=5',
  './src/agenda.js?v=20261003-2',
  './src/agenda-enhancements.js?v=20261003-2',
  './src/service-quote-requests.js?v=20261031-1',
  './src/order-review-requests.js?v=20261009-2',
  './src/technical-report.js?v=20260914-1',
  './src/mechanic-commissions.js?v=20261003-2',
  './src/help.js?v=20261031-1',
  './src/ui-events.js?v=20260930-1',
  './src/stock-save-plan.js?v=20261008-1',
  './src/supabase.js?v=20261031-4',
  './src/card-fees.js?v=20261006-1',
  './src/monthly-closing.js?v=20261006-1&w=5',
  './src/financial-recovery.js?v=20261020-2',
  './src/mechanic-saturday.js?v=20261003-2',
  './src/mechanic-privacy.js?v=20261002-1',
  './manifest.webmanifest',
  './official-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new URL(path,self.location).href))).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  const windows=await self.clients.matchAll({type:'window'});
  await Promise.all(windows.map(client=>{
    const url=new URL(client.url);
    if(url.searchParams.get('release')==='20261031-14')return null;
    url.searchParams.set('release','20261031-14');
    return client.navigate(url.href);
  }));
})()));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!new URL(event.request.url).pathname.startsWith(ROOT))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(response=>response||(event.request.mode==='navigate'?caches.match(new URL('./index.html',self.location).href,{ignoreSearch:true}):undefined))));
});
