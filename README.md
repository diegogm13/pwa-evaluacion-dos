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

## Estructura

```
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
npx vercel deploy public --prod
```

Al cambiar archivos del App Shell, sube la versión de `CACHE_STATIC_NAME` en `public/sw.js` para que los navegadores descarguen la versión nueva.
