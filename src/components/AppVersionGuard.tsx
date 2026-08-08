"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/** While the app is visible, check often — soft-launch / PWA users stay on stale shells otherwise. */
const POLL_MS = 30 * 1000;
const STORAGE_KEY = "valeo_app_build_id";
/** Auto-reload shortly after a new deploy is detected (stronger than a dismissible banner alone). */
const AUTO_RELOAD_MS = 2500;

async function clearAppCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {
    /* ignore */
  }
}

async function pingServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  } catch {
    /* ignore */
  }
}

/**
 * Keeps installed PWAs / long-lived tabs on the latest deploy:
 * 1) Poll /api/version (network-only) for a new buildId
 * 2) Ask the service worker to update
 * 3) Clear caches + auto-reload (banner shown briefly)
 */
export default function AppVersionGuard() {
  const [updateReady, setUpdateReady] = useState(false);
  const knownBuild = useRef<string | null>(null);
  const reloading = useRef(false);
  const autoTimer = useRef<number | null>(null);

  function reloadNow() {
    if (reloading.current) return;
    reloading.current = true;
    if (autoTimer.current) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    void clearAppCaches().finally(() => {
      // Cache-bust navigation so iOS Safari / PWA does not reuse a stale document.
      const url = new URL(window.location.href);
      url.searchParams.set("_v", String(Date.now()));
      window.location.replace(url.toString());
    });
  }

  function offerUpdate(buildId: string) {
    localStorage.setItem(STORAGE_KEY, buildId);
    knownBuild.current = buildId;
    setUpdateReady(true);
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => reloadNow(), AUTO_RELOAD_MS);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onControllerChange() {
      reloadNow();
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    async function checkVersion() {
      if (document.visibilityState === "hidden") return;
      try {
        await pingServiceWorkerUpdate();

        const res = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const buildId = (data.buildId || "").trim();
        if (!buildId || buildId === "dev") return;

        if (!knownBuild.current) {
          const stored = localStorage.getItem(STORAGE_KEY);
          knownBuild.current = stored || buildId;
          if (!stored) {
            localStorage.setItem(STORAGE_KEY, buildId);
            return;
          }
          if (stored !== buildId) {
            offerUpdate(buildId);
          }
          return;
        }

        if (knownBuild.current !== buildId) {
          offerUpdate(buildId);
        }
      } catch {
        // offline / fail-safe
      }
    }

    checkVersion();
    const id = window.setInterval(checkVersion, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache restore — force a fresh check
      if (e.persisted) checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(id);
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[100] flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg"
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        background: "#2A4A1A",
        color: "white",
      }}
      role="status"
    >
      <p className="text-sm font-medium min-w-0">
        Updating Valeo to the latest version…
      </p>
      <button
        type="button"
        onClick={reloadNow}
        className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{ background: "#8DC63F", color: "#2A4A1A" }}
      >
        <RefreshCw size={13} className="animate-spin" /> Now
      </button>
    </div>
  );
}
