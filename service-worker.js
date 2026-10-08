const C='inventario-v5',A=['./','index.html','styles.css','app.js','manifest.json','icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(!e.request.url.startsWith(self.location.origin)&&!e.request.url.includes('gstatic.com'))return; // Firebase DB va directo a la red
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;
  }).catch(()=>caches.match('index.html'))));
});