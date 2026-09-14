const VERSION = 'engineer-os-v1.2.0'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const DATA_CACHE = `${VERSION}-data`
const CORE = ['/', '/learn', '/review', '/history', '/more', '/glossary', '/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const req=event.request
  if(req.method!=='GET') return
  const url=new URL(req.url)
  if(url.origin!==self.location.origin) return
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cached=await caches.match(req)
      try{const res=await fetch(req);if(res.ok){const c=await caches.open(PAGE_CACHE);c.put(req,res.clone())}return res}catch{return cached || (await caches.match('/offline'))}
    })())
    return
  }
  if(['style','script','image','font'].includes(req.destination)){
    event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const res=await fetch(req);if(res.ok){const c=await caches.open(STATIC_CACHE);c.put(req,res.clone())}return res}catch{return cached}})())
    return
  }
  if(url.pathname.startsWith('/api/')){
    event.respondWith((async()=>{try{const res=await fetch(req);if(res.ok){const c=await caches.open(DATA_CACHE);c.put(req,res.clone())}return res}catch{return (await caches.match(req)) || new Response(JSON.stringify({offline:true}),{headers:{'Content-Type':'application/json'}})}})())
  }
})
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()})
self.addEventListener('notificationclick', event => {event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list[0]?.focus?.()||clients.openWindow('/')))})
