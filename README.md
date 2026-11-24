# UTEQGram

Aplicación web progresiva (PWA) tipo Instagram para compartir momentos de la comunidad UTEQ, con o sin conexión a internet.

**App publicada:** https://public-cyan-rho-52.vercel.app

## Funcionalidades

- **Pantallas:** Home / Feed, formulario para crear publicaciones, Ayuda y página sin conexión.
- **Vistas del lado del cliente:** el feed se arma en el navegador con JavaScript (`public/src/js/feed.js`).
- **Datos remotos:** Firebase Realtime Database (`/post.json`).
- **Datos locales:** IndexedDB (`posts-store`: almacenes `posts` y `sync-posts`).
- **Offline:** Service Worker con Cache Storage (App Shell) y Background Sync para enviar publicaciones al recuperar la conexión.
- **Instalable:** `manifest.json` con iconos de 144, 192 y 512 px.
- **Notificaciones push:** permiso, suscripción VAPID guardada en Firebase (`/subscriptions`) y función serverless `api/notify.js` (web-push) que avisa de cada post nuevo.
- **Hardware del dispositivo:** cámara (`getUserMedia`) para la foto del post, con respaldo de elegir archivo, y GPS (`geolocation`) para la ubicación.

## Estructura

```
api/
  notify.js           Función serverless: envía las notificaciones push
vercel.json           Publica la carpeta public/ y las funciones de api/
public/
  index.html          Home / Feed
  help/index.html     Ayuda
  offline.html        Página sin conexión
  manifest.json       Manifiesto de la PWA
  sw.js               Service Worker
  src/js/             app.js, feed.js, utility.js, idb.js, material.min.js
  src/css/            Estilos (MDL + propios)
  src/images/         Imágenes e iconos
docs/
  Documento_UTEQGram.docx   Documento del proyecto
  evidencias/               Capturas de las pruebas
```

## Ejecutar en local

```bash
npm install
npm start        # sirve la carpeta public en http://localhost:8080 sin caché HTTP
```

## Desplegar en Vercel

```bash
npx vercel deploy --prod
```

La función de notificaciones necesita la variable de entorno `VAPID_PRIVATE_KEY` en Vercel (la clave pública está en `public/src/js/app.js` y `api/notify.js`). Para generar un par nuevo: `npx web-push generate-vapid-keys`.

En local (`npm start`) la función `/api/notify` no existe; las notificaciones push solo se envían en Vercel (o con `npx vercel dev`).

Al cambiar archivos del App Shell, sube la versión de `CACHE_STATIC_NAME` en `public/sw.js` para que los navegadores descarguen la versión nueva.
