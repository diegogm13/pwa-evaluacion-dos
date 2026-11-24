var deferredPrompt;
var enableNotificationsButtons = document.querySelectorAll('.enable-notifications');
var VAPID_PUBLIC_KEY = 'BISbiRcCNAf0Phj_T0w3e_3xyh-gckI_G3ASl501Kfp2dDXT41AZg5wz4wcEDKe0DO0mRgQCEGwtdgGz_Ut5Wng';
var SUBSCRIPTIONS_URL = 'https://proyeto-del-curso-default-rtdb.firebaseio.com/subscriptions/';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
            return registration.update();
        })
        .then(function() {
            console.log('Service Worker registered successfully.');
        })
        .catch(function(err) {
            console.error('Service Worker registration or update failed.', err);
        });
}

window.addEventListener('beforeinstallprompt', function (event) {
    console.log('beforeinstallprompt fired');
    event.preventDefault();
    deferredPrompt = event;
    return false;
});

// ---------- Notificaciones ----------

function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Clave estable por dispositivo: SHA-256 del endpoint, para no duplicar suscripciones.
function subscriptionKey(endpoint) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
        .then(function (hash) {
            return Array.from(new Uint8Array(hash)).map(function (b) {
                return b.toString(16).padStart(2, '0');
            }).join('');
        });
}

function displayConfirmNotification() {
    return navigator.serviceWorker.ready.then(function (registration) {
        return registration.showNotification('¡Notificaciones activadas!', {
            body: 'Te avisaremos cuando alguien comparta un nuevo momento en UTEQGram.',
            icon: '/src/images/icons/app-icon-192x192.png',
            badge: '/src/images/icons/app-icon-144x144.png',
            image: '/src/images/main-image-sm.jpg',
            dir: 'ltr',
            lang: 'es-MX',
            vibrate: [100, 50, 200],
            tag: 'confirm-notification',
            renotify: true,
            data: { url: '/' },
            actions: [
                { action: 'confirm', title: 'Ver el feed' },
                { action: 'cancel', title: 'Cerrar' }
            ]
        });
    });
}

function configurePushSub() {
    var reg;
    return navigator.serviceWorker.ready
        .then(function (registration) {
            reg = registration;
            return reg.pushManager.getSubscription();
        })
        .then(function (sub) {
            if (sub) {
                return sub;
            }
            return reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        })
        .then(function (sub) {
            var json = sub.toJSON();
            return subscriptionKey(json.endpoint).then(function (key) {
                // POST "simple" (text/plain) que Firebase trata como PUT: evita el preflight CORS.
                return fetch(SUBSCRIPTIONS_URL + key + '.json?x-http-method-override=PUT', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
                });
            });
        })
        .then(function (res) {
            if (!res.ok) {
                throw new Error('No se pudo guardar la suscripción: ' + res.status);
            }
            console.log('[Push] Suscripción guardada en Firebase.');
            return displayConfirmNotification();
        });
}

function setNotificationButtons(label, disabled) {
    enableNotificationsButtons.forEach(function (button) {
        button.textContent = label;
        button.disabled = disabled;
    });
}

function askForNotificationPermission() {
    Notification.requestPermission().then(function (result) {
        console.log('[Push] Permiso de notificaciones:', result);
        if (result !== 'granted') {
            setNotificationButtons('Notificaciones bloqueadas', true);
            return;
        }
        setNotificationButtons('Activando…', true);
        return configurePushSub()
            .then(function () {
                setNotificationButtons('Notificaciones activadas', false);
            });
    }).catch(function (err) {
        console.error('[Push] No se pudieron activar las notificaciones.', err);
        setNotificationButtons('Habilitar Notificaciones', false);
    });
}

if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
    enableNotificationsButtons.forEach(function (button) {
        button.style.display = 'inline-block';
        button.addEventListener('click', askForNotificationPermission);
    });
    if (Notification.permission === 'granted') {
        setNotificationButtons('Notificaciones activadas', false);
    } else if (Notification.permission === 'denied') {
        setNotificationButtons('Notificaciones bloqueadas', true);
    }
} else {
    enableNotificationsButtons.forEach(function (button) {
        button.style.display = 'none';
    });
}
