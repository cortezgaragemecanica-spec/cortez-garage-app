const CACHE='cortez-garage-v64',ROOT=new URL('./',self.location).pathname,ASSETS=['./','./index.html','./src/style.css?v=20260829-19','./src/checklist.css?v=20260829-3','./src/main.js?v=20260829-19','./src/sync.js','./src/supabase.js?v=20260829-19','./src/image-utils.js','./src/delete-order.js?v=20260828-11','./src/budget-order.js?v=20260828-11','./src/pdf-order.js?v=20260828-11','./src/stock.js?v=20260828-11','./src/admin.js?v=20260829-19','./src/reports.js?v=20260829-12','./manifest.webmanifest','./official-logo.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new URL(path,self.location).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!new URL(event.request.url).pathname.startsWith(ROOT))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response}).catch(()=>caches.match(event.request).then(response=>response||(event.request.mode==='navigate'?caches.match(new URL('./index.html',self.location).href):undefined))))});




