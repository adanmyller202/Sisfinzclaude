/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', (event: PushEvent) => {
  let payload: any = {
    type: 'FINZY_REMINDER_PUSH',
    title: 'Finzy • Lembrete Importante',
    body: 'Você tem um lembrete pendente no SisFinz.',
    tag: 'sisfinz_rem_push',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const txt = event.data.text();
      if (txt) payload.body = txt;
    }
  }

  const title = String(payload.title || 'Finzy • Lembrete Importante');
  const options: NotificationOptions = {
    body: String(payload.body || ''),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: String(payload.tag || 'sisfinz_rem_push'),
    data: {
      reminderId: payload.reminderId,
      url: payload.url || '/',
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        client.postMessage({
          type: 'FINZY_REMINDER_PUSH',
          payload,
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = String((event.notification.data as any)?.url || '/');

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'FINZY_REMINDER_PUSH',
            payload: event.notification.data || null,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
