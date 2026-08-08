"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const POLL_MS = 5 * 60 * 1000; // every 5 minutes while the tab is open
const STORAGE_KEY = "valeo_app_build_id";

/**
 * Keeps installed PWAs / long-lived tabs on the latest deploy:
 * 1) Service worker controllerchange → hard reload (skipWaiting is on)
 * 2) Poll /version.json for a new buildId → prompt + reload
 */
export default function AppVersionGuard() {
  const [updateReady, setUpdateReady] = useState(false);
  const knownBuild = useRef<string | null>(null);
  const reloading = useRef(false);

  function reloadNow() {
    if (reloading.current) return;
    reloading.current = true;
    try {
      if ("caches" in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
      }
    } catch { /* ignore */ }
    window.location.reload();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onControllerChange() {
      // New SW took control — load the fresh bundle.
      reloadNow();
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    async function checkVersion() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { buildId?: string };
        const buildId = data.buildId || "";
        if (!buildId || buildId === "dev") return;

        if (!knownBuild.current) {
          const stored = localStorage.getItem(STORAGE_KEY);
          knownBuild.current = stored || buildId;
          localStorage.setItem(STORAGE_KEY, buildId);
          // First visit after a deploy while an old SW is active
          if (stored && stored !== buildId) {
            setUpdateReady(true);
          }
          return;
        }

        if (knownBuild.current !== buildId) {
          localStorage.setItem(STORAGE_KEY, buildId);
          setUpdateReady(true);
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
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
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
        bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        background: "#2A4A1A",
        color: "white",
      }}
      role="status"
    >
      <p className="text-sm font-medium min-w-0">
        A new version of Valeo is ready.
      </p>
      <button
        type="button"
        onClick={reloadNow}
        className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{ background: "#8DC63F", color: "#2A4A1A" }}
      >
        <RefreshCw size={13} /> Update
      </button>
    </div>
  );
}
