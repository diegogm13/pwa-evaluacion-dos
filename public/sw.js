importScripts('src/js/idb.js');
importScripts('src/js/utility.js');


var CACHE_STATIC_NAME = 'static-v17';
var CACHE_DYNAMIC_NAME = 'dynamic-v2';
var STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    '/help/index.html',
    '/favicon.svg',
    '/manifest.json',
    '/src/images/icons/app-icon-144x144.png',
    '/src/images/icons/app-icon-192x192.png',
    '/src/images/icons/app-icon-512x512.png',
    '/src/images/icons/apple-icon-180x180.png',
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/js/idb.js',
    '/src/js/utility.js',
    '/src/js/material.min.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/css/help.css',
    '/src/css/material.indigo-pink.min.css',
    '/src/css/material-icons.css',
    '/src/fonts/material-icons.ttf',
    '/src/images/main-image.jpg',
    '/src/images/main-image-sm.jpg',
    '/src/images/sf-boat.jpg',
]

self.addEventListener('install', function (event) {
    console.log('[Service Worker] installing Service Worker...', event);
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
            .then(function (cache) {
                console.log('[Service Worker] Precaching App Shell');
                return cache.addAll(STATIC_FILES);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', function (event) {
    console.log('[Service Worker] activating Service Worker...', event);
    event.waitUntil(
        caches.keys()
            .then(function (keyList) {
                return Promise.all(keyList.map(function (key) {
                    if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                        console.log('[Service Worker] removing old cache.', key);
                        return caches.delete(key);
                    }
                }));
            })
    );
    return self.clients.claim();
});

function isInArray(string, array) {
    var cachePath;
    if (string.indexOf(self.origin) === 0) {
        console.log('matched ', string);
        cachePath = string.substring(self.origin.length);
    } else {
        cachePath = string;
    }
    return array.indexOf(cachePath) > -1;
}

// cache then network-offline (o estrategia de red con respaldo)
self.addEventListener('fetch', function (event) {
    // Solo se cachean peticiones GET; los PUT/POST (envío de posts) van directo a la red.
    if (event.request.method !== 'GET') {
        return;
    }

    var url = 'https://proyeto-del-curso-default-rtdb.firebaseio.com/post.json';

    if (event.request.url.indexOf(url) > -1) {
        event.respondWith(
            fetch(event.request)
                .then(function (res) {
                    var clonedRes = res.clone();

                    clearAllData('posts')
                        .then(function () {
                            return clonedRes.json();
                        })
                        .then(function (data) {
                            for (var key in data) {
                                writeData('posts', data[key]);
                            }
                        });

                    return res;
                })
                .catch(function (err) {
                    console.warn('[Service Worker] Feed request failed; returning saved posts.', err);
                    return readAllData('posts')
                        .then(function (posts) {
                            if (!posts.length) {
                                throw err;
                            }
                            return new Response(JSON.stringify(posts), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                        });
                })
        );
    } else if (isInArray(event.request.url, STATIC_FILES)) {
        event.respondWith(
            caches.match(event.request)
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(function (response) {
                    if (response) {
                        return response;
                    } else {
                        return fetch(event.request)
                            .then(function (res) {
                                return caches.open(CACHE_DYNAMIC_NAME)
                                    .then(function (cache) {
                                        cache.put(event.request, res.clone());
                                        return res;
                                    })
                            })
                            .catch(function (err) {
                                return caches.open(CACHE_STATIC_NAME)
                                    .then(function (cache) {
                                        if ((event.request.headers.get('accept') || '').includes('text/html')) {
                                            return cache.match('/offline.html');
                                        }
                                        if (event.request.destination === 'image') {
                                            return cache.match('/src/images/main-image.jpg');
                                        }
                                        throw err;
                                    });
                            });
                    }
                })
        );
    }
});

self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts');
        event.waitUntil(
            readAllData('sync-posts')
                .then(function (data) {
                    return Promise.all(data.map(function (dt) {
                        var postId = dt.id.replace(/[.#$\/\[\]]/g, '_');
                        return fetch('https://proyeto-del-curso-default-rtdb.firebaseio.com/post/' +
                            encodeURIComponent(postId) + '.json?x-http-method-override=PUT', {
                            // POST "simple" (text/plain) para evitar el preflight CORS; Firebase lo trata como PUT.
                            method: 'POST',
                            headers: {
                                'Content-Type': 'text/plain;charset=UTF-8'
                            },
                            body: JSON.stringify(dt)
                        })
                            .then(function (res) {
                                if (!res.ok) {
                                    throw new Error('Post sync failed with status ' + res.status);
                                }
                                console.log('Synced post', dt.id);
                                return deleteItemFromData('sync-posts', dt.id);
                            })
                            .then(function () {
                                return notifyNewPost(dt);
                            })
                            .catch(function (err) {
                                console.error('Error while syncing post', dt.id, err);
                                throw err;
                            });
                    }));
                })
        );
    }
});
// ---------- Notificaciones push ----------

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push recibido', event);
    var data = { title: 'UTEQGram', content: 'Hay novedades en el feed.', openUrl: '/' };
    if (event.data) {
        try {
            data = Object.assign(data, event.data.json());
        } catch (e) {
            data.content = event.data.text();
        }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.content,
            icon: '/src/images/icons/app-icon-192x192.png',
            badge: '/src/images/icons/app-icon-144x144.png',
            vibrate: [100, 50, 200],
            tag: 'new-post',
            renotify: true,
            data: { url: data.openUrl },
            actions: [
                { action: 'confirm', title: 'Ver el feed' },
                { action: 'cancel', title: 'Cerrar' }
            ]
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    var notification = event.notification;
    var url = (notification.data && notification.data.url) || '/';
    console.log('[Service Worker] Notificación pulsada:', event.action || 'cuerpo');
    notification.close();
    if (event.action === 'cancel') {
        return;
    }
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clis) {
                var client = clis.find(function (c) { return c.visibilityState === 'visible'; }) || clis[0];
                if (client) {
                    return client.navigate(url).then(function (c) { return (c || client).focus(); });
                }
                return self.clients.openWindow(url);
            })
    );
});

self.addEventListener('notificationclose', function (event) {
    console.log('[Service Worker] Notificación cerrada', event.notification.tag);
});
