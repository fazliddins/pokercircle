// Простой service worker: позволяет установить сайт как приложение. Всё берётся из сети.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { });
