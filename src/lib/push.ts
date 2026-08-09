// Client-side FCM token registration (fail-safe if messaging unsupported / unset).
"use client";

import { getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, deleteToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";

function firebaseWebConfig() {
  return {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

async function ensureMessagingSw(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    // Pass config into the SW (it cannot read Next env vars).
    reg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseWebConfig() });
    navigator.serviceWorker.ready.then(r => {
      r.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseWebConfig() });
    });
    return reg;
  } catch (e) {
    console.warn("[push] messaging SW register failed", e);
    return null;
  }
}

export async function pushSupported(): Promise<boolean> {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** Request permission, get token, store on users/{uid}.fcmTokens */
export async function enablePush(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!uid) return { ok: false, error: "Not signed in" };
  if (!(await pushSupported())) {
    return { ok: false, error: "Push is not supported in this browser." };
  }
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid) {
    return { ok: false, error: "Push is not configured yet (missing VAPID key)." };
  }
  if (!getApps().length) return { ok: false, error: "Firebase not ready." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission was not granted." };
  }

  const reg = await ensureMessagingSw();
  if (!reg) return { ok: false, error: "Could not register push service worker." };

  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, error: "No push token returned." };

    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayUnion(token),
      "notifPrefs.pushEnabled": true,
    });
    return { ok: true };
  } catch (e: any) {
    console.warn("[push] enable failed", e);
    return { ok: false, error: e?.message || "Could not enable push." };
  }
}

/**
 * Soft re-register: if permission already granted, refresh token onto users/{uid}.
 * Call after login so phones keep a valid FCM token without opening Settings.
 */
export async function refreshPushToken(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!uid) return { ok: false, error: "Not signed in" };
  if (!(await pushSupported())) return { ok: false, error: "unsupported" };
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid || !getApps().length) return { ok: false, error: "not configured" };
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return { ok: false, error: "permission not granted" };
  }

  const reg = await ensureMessagingSw();
  if (!reg) return { ok: false, error: "sw failed" };

  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, error: "no token" };
    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayUnion(token),
    });
    return { ok: true };
  } catch (e: any) {
    console.warn("[push] refresh failed", e);
    return { ok: false, error: e?.message || "refresh failed" };
  }
}

/** Show in-app / system notification when a push arrives while Valeo is open. */
export async function listenForForegroundPush(
  onNotify: (n: { title: string; body: string; url: string }) => void,
): Promise<() => void> {
  if (!(await pushSupported()) || !getApps().length) return () => {};
  try {
    const { onMessage } = await import("firebase/messaging");
    const messaging = getMessaging();
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || "Valeo";
      const body = payload.notification?.body || payload.data?.body || "";
      const url = payload.data?.url || "/";
      onNotify({ title, body, url });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/android-chrome-192x192.png", data: { url } });
        } catch {
          /* some browsers block Notification from insecure contexts */
        }
      }
    });
  } catch (e) {
    console.warn("[push] foreground listen failed", e);
    return () => {};
  }
}

export async function disablePush(uid: string): Promise<void> {
  if (!uid) return;
  try {
    if (await pushSupported() && getApps().length) {
      const messaging = getMessaging();
      const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      const reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (vapid && reg) {
        try {
          const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: reg });
          if (token) {
            await updateDoc(doc(db, "users", uid), {
              fcmTokens: arrayRemove(token),
              "notifPrefs.pushEnabled": false,
            });
            await deleteToken(messaging).catch(() => {});
            return;
          }
        } catch { /* fall through */ }
      }
    }
    await updateDoc(doc(db, "users", uid), { "notifPrefs.pushEnabled": false });
  } catch (e) {
    console.warn("[push] disable failed", e);
  }
}
