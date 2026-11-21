/* blanko – Service Worker: hält beim ersten Besuch die ganze App vor (Seite, CSS, JavaScript, Symbole, Katalog).
   Danach startet blanko aus dem Vorrat, auch ohne Netz. Eine neue Version erkennt der Browser an dieser Datei
   (BL_V ändert sich mit jedem Update), holt alles einmal frisch und räumt den alten Vorrat weg.
   BL_V und BL_FILES setzt index.php davor. */
const CACHE = 'blanko-' + BL_V;
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(BL_FILES.map(u =>
        fetch(u, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})
    ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('blanko-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    const action = url.searchParams.get('action');
    // Nur die Seite von blanko selbst (auch mit ?p=… für ein Papier), nicht etwa einen Installer im selben Ordner
    const isPage = req.mode === 'navigate' && !action && (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.php');
    const isFile = action === 'asset' || action === 'manifest';
    if (!isPage && !isFile) return;
    if (isPage) {
        // Aus dem Vorrat starten, im Hintergrund die Seite auffrischen
        e.respondWith(caches.open(CACHE).then(c => c.match('./').then(hit => {
            const net = fetch(url.pathname, { credentials: 'same-origin' }).then(r => { if (r.ok) c.put('./', r.clone()); return r; });
            if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
            return fetch(req).catch(() => Response.error());
        })));
        return;
    }
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok && url.searchParams.has('v')) c.put(req, r.clone());
        return r;
    }))));
});
