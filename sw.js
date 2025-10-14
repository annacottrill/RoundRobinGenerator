/**
 * Service Worker for Round Robin Roping PWA
 *
 * This service worker enables offline functionality by caching
 * the app shell and assets. It uses a Cache First strategy for
 * static assets and Network First for dynamic content.
 */

const CACHE_NAME = 'round-robin-roping-v1';
const RUNTIME_CACHE = 'round-robin-roping-runtime';

// Assets to cache on install (App Shell)
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/js/db.js',
    '/js/router.js',
    '/js/app.js',
    '/js/pages/home.js',
    '/js/pages/ropers.js',
    '/js/pages/events.js',
    '/js/pages/record.js',
    '/js/pages/results.js',
    // External CDN resources (will be cached when first loaded)
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.js'
];

/**
 * Install Event
 * Triggered when the service worker is first installed
 * Pre-caches the app shell and critical assets
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                // Use addAll to cache all assets atomically
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Install failed:', error);
            })
    );
});

/**
 * Activate Event
 * Triggered when the service worker becomes active
 * Cleans up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Delete old caches that don't match the current version
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                        })
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

/**
 * Fetch Event
 * Intercepts all network requests
 * Implements a Cache First strategy with Network Fallback
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests that aren't for our CDN resources
    if (url.origin !== location.origin &&
        !url.href.includes('cdn.tailwindcss.com') &&
        !url.href.includes('unpkg.com/dexie')) {
        return;
    }

    // For navigation requests (page loads)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // If network fails, serve the cached index.html
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // For all other requests: Cache First, falling back to Network
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version if available
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Don't cache if it's not a success response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                            return networkResponse;
                        }

                        // Clone the response (can only be consumed once)
                        const responseToCache = networkResponse.clone();

                        // Add to runtime cache for future use
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // Could return a custom offline page here
                        throw error;
                    });
            })
    );
});

/**
 * Message Event
 * Allows the app to communicate with the service worker
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Handle cache refresh request
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

/**
 * Background Sync Event (Optional - for future enhancement)
 * Can be used to sync data when connection is restored
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Implement sync logic here
            Promise.resolve()
        );
    }
});

console.log('[Service Worker] Loaded');
