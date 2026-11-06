const CACHE = 'vbt-lab-static-v1';
const FILES = ['./', './index.html', './styles.css', './icon.svg', './manifest.webmanifest',
  './js/app.js', './js/chart.js', './js/core.js', './js/capture.js', './js/storage.js', './js/bluetooth.js'];

self.addEventListener('install', event => {
  // An update waits until old tabs close; it never reloads an active capture.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vbt-lab-static-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && FILES.some(file => new URL(file, self.location.href).href === url.href)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match(new URL('./index.html', self.location.href));
    return Response.error();
  }));
});
