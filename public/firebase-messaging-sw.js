/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker (web push).
// Loads compat SDK from gstatic so it works alongside next-pwa's sw.js.
// Configure NEXT_PUBLIC_FIREBASE_* in the hosting environment; this file
// reads them via a tiny bootstrap posted from the app, with env fallbacks
// injected at register time through query params when available.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && event.data.config) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(event.data.config);
      }
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || "Valeo";
        const body = payload.notification?.body || payload.data?.body || "";
        const url = payload.data?.url || "/";
        self.registration.showNotification(title, {
          body,
          icon: "/android-chrome-192x192.png",
          badge: "/favicon-32x32.png",
          data: { url },
        });
      });
    } catch (e) {
      console.warn("[fcm-sw] init failed", e);
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
