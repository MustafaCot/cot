// service-worker.js
const CACHE_NAME = 'ccp-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/units.html',
  '/cards.html',
  '/styles.css',
  '/script.js',
  '/units.js',
  '/cards.js',
  '/auth-guard.js',
  '/firebase-init.js'
];

self.addEventListener('install', (event) => {
  // Kurulumda dosyaları önbelleğe al
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Her istek geldiğinde önce önbelleğe bak, yoksa ağdan al
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
