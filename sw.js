const REPO_NAME = 'I-Can-Study-Pro';
const CACHE_NAME = 'i-can-study-pro-cache-v5';

const assetsToCache = [
  `/${REPO_NAME}/`,
  `/${REPO_NAME}/index.html`,
  `/${REPO_NAME}/manifest.json`,
  `/${REPO_NAME}/icon-192.png`,
  `/${REPO_NAME}/icon-512.png`,
  `/${REPO_NAME}/icon-maskable-512.png`,
  `/${REPO_NAME}/screenshot-mobile.png`, 
  `/${REPO_NAME}/screenshot-desktop.png`,
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap'
];

const externalAssetURLs = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap',
  'https://fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell assets.');
        return cache.addAll(assetsToCache);
      })
    
      .catch(error => {
        console.error('Failed to cache assets during install:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestURL = new URL(event.request.url);
  const isExternalAsset = externalAssetURLs.some(url => requestURL.href.startsWith(url));

  if (isExternalAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => {
            return cache.match(event.request);
          });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
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
