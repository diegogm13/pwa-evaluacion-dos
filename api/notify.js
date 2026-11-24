// Función serverless de Vercel: envía una notificación push a todos los dispositivos suscritos.
// POST /api/notify  { "title": "...", "location": "..." }
const webpush = require('web-push');

const DB = 'https://proyeto-del-curso-default-rtdb.firebaseio.com';
const APP_URL = 'https://public-cyan-rho-52.vercel.app';
const VAPID_PUBLIC_KEY = 'BISbiRcCNAf0Phj_T0w3e_3xyh-gckI_G3ASl501Kfp2dDXT41AZg5wz4wcEDKe0DO0mRgQCEGwtdgGz_Ut5Wng';

const clip = (value, max) => String(value || '').slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Falta la variable VAPID_PRIVATE_KEY' });
  }

  webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const payload = JSON.stringify({
    title: 'Nueva publicación en UTEQGram',
    content: clip(body.title, 80) + (body.location ? ' · ' + clip(body.location, 80) : ''),
    openUrl: '/'
  });

  const subsRes = await fetch(DB + '/subscriptions.json');
  const subs = (await subsRes.json()) || {};

  let sent = 0, removed = 0, failed = 0;
  await Promise.all(Object.keys(subs).map(async (key) => {
    try {
      await webpush.sendNotification(subs[key], payload);
      sent++;
    } catch (err) {
      // 404/410: la suscripción ya no existe (el usuario revocó el permiso); se borra.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await fetch(DB + '/subscriptions/' + encodeURIComponent(key) + '.json', { method: 'DELETE' });
        removed++;
      } else {
        failed++;
        console.error('Push fallido', key, err.statusCode, err.body);
      }
    }
  }));

  return res.status(200).json({ sent, removed, failed });
};
