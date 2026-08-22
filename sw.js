// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  return self.clients.claim();
});

// Intercepta as requisições (necessário para ser reconhecido como PWA)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
