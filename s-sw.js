const CACHE_VERSION = 'v2.2.9';
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

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(names => {
            return Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    if (url.pathname.includes('version.json')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;

            return fetch(e.request).then(res => {
                if (e.request.method === 'GET' && res.ok) {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
                }
                return res;
            }).catch(() => {
                if (e.request.mode === 'navigate') {
                    return caches.match('/scards/s-index.html');
                }
                return null;
            });
        })
    );
});
