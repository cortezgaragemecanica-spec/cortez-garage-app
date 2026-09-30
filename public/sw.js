const CACHE='cortez-garage-v238-modern-home';
const ROOT=new URL('./',self.location).pathname;
const SHELL=[
  './',
  './index.html',
  './src/style.css?v=20260928-2&w=6',
  './src/checklist.css?v=20260829-3',
  './src/monthly-closing.css?v=20260924-2',
  './src/boot.js?v=20260930-1',
  './src/main.js?v=20260925-2&w=10',
  './src/access-control.js?v=20260915-1',
  './src/budget-order.js?v=20260928-1',
  './src/pdf-order.js?v=20260929-1',
  './src/owner-diagnosis-observation.js?v=20260929-1',
  './src/order-workflow.js?v=20260928-1',
  './src/delete-order.js?v=20260905-1',
  './src/entry-receipt.js?v=20260911-2',
  './src/closed-order-receipt.js?v=20260928-1',
  './src/dialog-accessibility.js?v=20260924-1',
  './src/vehicle-table.js?v=20260924-3',
  './src/checklist-history.js?v=20260924-1',
  './src/client-history.js?v=20260924-1',
  './src/stock.js?v=20260922-1&w=3',
  './src/admin.js?v=20260925-2&w=18',
  './src/luizinho-returns.js?v=20260924-1',
  './src/reports.js?v=20260918-1&w=5',
  './src/agenda.js?v=20260908-2',
  './src/agenda-enhancements.js?v=20260914-1',
  './src/service-quote-requests.js?v=20260918-1',
  './src/order-review-requests.js?v=20260924-1',
  './src/technical-report.js?v=20260914-1',
  './src/mechanic-commissions.js?v=20260914-1',
  './src/ui-events.js?v=20260930-1',
  './src/stock-save-plan.js?v=20260922-1',
  './src/supabase.js?v=20260930-1',
  './manifest.webmanifest',
  './official-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new URL(path,self.location).href))).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!new URL(event.request.url).pathname.startsWith(ROOT))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(response=>response||(event.request.mode==='navigate'?caches.match(new URL('./index.html',self.location).href,{ignoreSearch:true}):undefined))));
});
