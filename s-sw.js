const CACHE_VERSION = 'v2.4.3';
const CACHE_NAME = 'shell-cache-' + CACHE_VERSION;

const ASSETS = [
    '/scards/s-index.html',
    '/scards/s-styles.css',
    '/scards/s-app.js',
    '/scards/s-manifest.json',
    '/scards/s-version.json',
    '/scards/g-game.js',
    '/scards/g-styles.css',
    '/scards/g-config.js',
    '/scards/g-version.json',
    '/scards/icons/icon-192.png',
    '/scards/icons/icon-512.png'
];

self.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) {
                    return n !== CACHE_NAME;
                }).map(function(n) {
                    return caches.delete(n);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);

    if (url.pathname.includes('version.json')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        caches.match(e.request).then(function(cached) {
            if (cached) return cached;

            return fetch(e.request).then(function(res) {
                if (e.request.method === 'GET' && res.ok) {
                    var resClone = res.clone();
                    caches.open(CACHE_NAME).then(function(c) {
                        c.put(e.request, resClone);
                    });
                }
                return res;
            }).catch(function() {
                if (e.request.mode === 'navigate') {
                    return caches.match('/scards/s-index.html');
                }
                return null;
            });
        })
    );
});
