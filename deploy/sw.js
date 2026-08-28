// Service Worker - 魔耳 Magic Ear
const CACHE_NAME = 'moer-v4.4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/zip.js',
  './js/db.js',
  './js/ui.js',
  './js/data.js',
  './js/feed.js',
  './js/pages.js',
  './js/submit.js',
  './js/cloud.js',
  './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // 只缓存同源静态资源
        if (res.ok && new URL(req.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
