const CACHE_NAME = 'budget-buddy-cache-v1';
const urlsToCache = [
  '/', // Caches the root path (index.html)
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png', // Don't forget your icons!
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap', // Google Fonts CSS
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css', // Font Awesome CSS
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js' // Chart.js library
];

// Install event - caching resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Cache addAll failed:', err);
      })
  );
});

// Fetch event - serving cached content
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // If not in cache, fetch from network
        return fetch(event.request);
      })
  );
});

// Activate event - cleaning up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    })
  );
});