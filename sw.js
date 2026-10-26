const CACHE='loymar-v23-3';
const STATIC_ASSETS=['./','./index.html','./styles.css','./app.js','./data/catalog.js','./data/catalog.json','./data/base_maestra.csv','./manifest.webmanifest','./icons/icon.svg'];
const BLOCKED_IMAGES=new Set(['1466.webp']);
const VERIFIED_EXTRA_IMAGES=['./productos/5.webp'];

async function cacheProductImages(cache){
  try{
    const response=await fetch('./data/catalog.json',{cache:'no-store'});
    if(!response.ok)return;
    const catalog=await response.json();
    const urls=[...new Set((catalog.products||[])
      .map(product=>String(product.image||'').trim())
      .filter(name=>name&&!BLOCKED_IMAGES.has(name))
      .map(name=>`./productos/${encodeURIComponent(name)}`))];
    await Promise.all([...urls,...VERIFIED_EXTRA_IMAGES].map(url=>cache.add(url).catch(()=>undefined)));
  }catch(_){
    // La interfaz y los datos estáticos siguen disponibles aunque falle una foto.
  }
}

self.addEventListener('install',event=>{event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(STATIC_ASSETS);
  await cacheProductImages(cache);
  await self.skipWaiting();
})())});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match('./index.html'))))});
