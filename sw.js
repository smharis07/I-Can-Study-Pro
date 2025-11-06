```javascript
const REPO_NAME = 'I-Can-Study-Pro.html';
const CACHE_NAME = 'i-can-study-pro-cache-v1';

const assetsToCache = [
  `/${REPO_NAME}/`,
  `/${REPO_NAME}/index.html`,
  `/${REPO_NAME}/manifest.json`,
  `/${REPO_NAME}/icon-192.png`,
  `/${REPO_NAME}/icon-512.png`,
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching assets for offline use.');
        return cache.addAll(assetsToCache);
      })
      .catch(error => {
        console.error('Failed to cache assets:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```
