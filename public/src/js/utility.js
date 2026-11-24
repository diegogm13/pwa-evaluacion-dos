var dbPromise = idb.open('posts-store', 2, function(db) {
    if (!db.objectStoreNames.contains('posts')) {
        db.createObjectStore('posts', {keyPath: 'id'});
    }
    if (!db.objectStoreNames.contains('sync-posts')) {
        db.createObjectStore('sync-posts', {keyPath: 'id'});
    }
});

function writeData(st, data) {
    return dbPromise
        .then(function(db) {
            var tx = db.transaction(st, 'readwrite');
            var store = tx.objectStore(st);
            store.put(data);
            return tx.complete;
        });
}

function savePostForSync(post) {
    return dbPromise
        .then(function(db) {
            var tx = db.transaction(['posts', 'sync-posts'], 'readwrite');
            tx.objectStore('posts').put(post);
            tx.objectStore('sync-posts').put(post);
            return tx.complete;
        });
}

function readAllData(st) {
    return dbPromise
        .then(function(db) {
            var tx = db.transaction(st, 'readonly');
            var store = tx.objectStore(st);
            return store.getAll();
        });
}

function clearAllData(st) {
    return dbPromise
        .then(function(db) {
            var tx = db.transaction(st, 'readwrite');
            var store = tx.objectStore(st);
            store.clear();
            return tx.complete;
        }
    );
}

// Pide a la función serverless /api/notify que envíe un push a los dispositivos suscritos.
// Se usa desde la página y desde el Service Worker; un fallo no afecta la publicación.
function notifyNewPost(post) {
    return fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, location: post.location })
    })
        .then(function(res) { return res.json(); })
        .then(function(result) { console.log('[Push] Notificación enviada', result); })
        .catch(function(err) { console.warn('[Push] No se pudo enviar la notificación.', err); });
}

function deleteItemFromData(st, id) {
    return dbPromise
        .then(function(db) {
            var tx = db.transaction(st, 'readwrite');
            var store = tx.objectStore(st);
            store.delete(id);
            return tx.complete;
        })
     .then(function() {
         console.log('Item deleted!');
     });
}