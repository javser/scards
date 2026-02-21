const CACHE_VERSION = 'v2.2.0';
const CACHE_NAME = 'shell-cache-' + CACHE_VERSION;

const ASSETS = [
    './s-index.html',
    './s-styles.css',
    './s-app.js',
    './s-manifest.json',
    './s-version.json',
    './g-game.js',
    './g-styles.css',
    './g-config.js',
    './g-version.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
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

    // version.json всегда из сети
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
                    return caches.match('./s-index.html');
                }
                return null;
            });
        })
    );
});
