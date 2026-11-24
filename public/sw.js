importScripts('src/js/idb.js');
importScripts('src/js/utility.js');


var CACHE_STATIC_NAME = 'static-v13';
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
                            body: JSON.stringify({
                                id: dt.id,
                                title: dt.title,
                                location: dt.location,
                                image: 'https://firebasestorage.googleapis.com/v0/b/proyeto-del-curso.firebasestorage.app/o/sf-boat.jpg?alt=media&token=1c264061-7918-4a64-b15e-d14f8d7ed95f'
                            })
                        })
                            .then(function (res) {
                                if (!res.ok) {
                                    throw new Error('Post sync failed with status ' + res.status);
                                }
                                console.log('Synced post', dt.id);
                                return deleteItemFromData('sync-posts', dt.id);
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