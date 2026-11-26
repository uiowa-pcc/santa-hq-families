/* Santa HQ family edition. Never cache account, gift, invitation, or claim API responses. */
const CACHE='santa-hq-v77-kid-favorites';
const CORE=['./','./index.html','./santa-hq-design.css','./santa-hq-details.css','./santa-home.webp','./family-sync.js','./family-hq.js','./family.html','./hunt.html','./hunt.js','./hunt-photos.webp','./elf-avatars.webp','./kid-santa-new.webp'];
const OPTIONAL=['./manifest.webmanifest','./icon-192.png','./icon-512.png','./art/crayons.svg','./art/elf.svg','./art/letter.svg','./art/mailbox.svg','./art/microphone.svg','./art/ornament.svg','./art/present.svg','./art/santa-full.svg','./art/santa-peek.svg','./art/stocking.svg','./art/tree.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(CORE);await Promise.all(OPTIONAL.map(a=>cache.add(a).catch(()=>{})))}));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('santa-hq-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
  // All account, household and published-list data is always checked against the live server.
  if(u.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(r=>{
    if(r.ok&&!u.search&&!u.hash){const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)))}
    return r;
  }).catch(async()=>{
    const found=await caches.match(event.request,{ignoreSearch:false});if(found)return found;
    if(event.request.mode==='navigate')return await caches.match('./index.html')||Response.error();
    return Response.error();
  }));
});
