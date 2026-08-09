"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Keeps FCM tokens fresh after login and surfaces foreground message pushes.
 * Fail-safe — never blocks the app.
 */
export default function PushBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { refreshPushToken, listenForForegroundPush } = await import("@/lib/push");
        if (cancelled) return;
        await refreshPushToken(user.uid);
        if (cancelled) return;
        unsub = await listenForForegroundPush(({ title, body }) => {
          // Soft in-app cue when system notification is suppressed (tab focused).
          if (typeof document !== "undefined" && document.visibilityState === "visible") {
            console.info("[push]", title, body);
          }
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      try { unsub?.(); } catch { /* ignore */ }
    };
  }, [user?.uid]);

  return null;
}
