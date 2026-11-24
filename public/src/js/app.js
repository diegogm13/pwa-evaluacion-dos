var deferredPrompt;

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