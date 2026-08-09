/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker (web push).
// Initializes Firebase at startup (fetch public config) so background pushes
// work even when the page hasn't posted FIREBASE_CONFIG yet.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

let messagingReady = null;
let bgHandlerBound = false;

function bindBackgroundHandler(messaging) {
  if (bgHandlerBound) return;
  bgHandlerBound = true;
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
}

async function initFirebase(config) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    const messaging = firebase.messaging();
    bindBackgroundHandler(messaging);
    return messaging;
  } catch (e) {
    console.warn("[fcm-sw] init failed", e);
    return null;
  }
}

async function ensureFirebase() {
  if (messagingReady) return messagingReady;
  messagingReady = (async () => {
    try {
      const res = await fetch("/api/public-firebase-config", { credentials: "same-origin" });
      if (!res.ok) throw new Error("config " + res.status);
      const config = await res.json();
      return initFirebase(config);
    } catch (e) {
      console.warn("[fcm-sw] config fetch failed", e);
      messagingReady = null;
      return null;
    }
  })();
  return messagingReady;
}

// Cold start — prepare before push events arrive
ensureFirebase();

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(ensureFirebase());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), ensureFirebase()]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && event.data.config) {
    event.waitUntil(initFirebase(event.data.config));
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
