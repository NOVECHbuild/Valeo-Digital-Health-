"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "valeo_pwa_install_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true
  );
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Soft, once-dismissed hint to Add to Home Screen. No install spam.
 */
export default function PwaInstallHint() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIos(ios);
    const t = window.setTimeout(() => setShow(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div
      className="fixed left-3 right-3 z-[90] rounded-2xl p-4 shadow-lg"
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        background: "white",
        border: "1px solid rgba(42,74,26,0.12)",
        boxShadow: "0 12px 40px rgba(42,74,26,0.18)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(141,198,63,0.15)" }}
        >
          <Download size={18} style={{ color: "#6BA028" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
            Install Valeo on your phone
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#8A9BA8" }}>
            {isIos
              ? "Tap Share, then “Add to Home Screen” for the full app experience."
              : "Use your browser menu → “Install app” or “Add to Home Screen”."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-2 rounded-lg hover:bg-black/5 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} style={{ color: "#8A9BA8" }} />
        </button>
      </div>
    </div>
  );
}
