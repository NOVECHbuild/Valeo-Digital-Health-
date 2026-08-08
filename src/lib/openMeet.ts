/** Extract a Meet room code (e.g. ayp-gvpr-naj) from a hangout / Meet URL. */
export function meetCodeFromLink(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (!/meet\.google\.com$/i.test(u.hostname) && !/\.meet\.google\.com$/i.test(u.hostname)) {
      return null;
    }
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || "";
    if (!seg || /^accounts?/i.test(seg) || /^landing/i.test(seg)) return null;
    // Standard Meet codes: xxx-yyyy-zzz
    if (/^[a-z0-9]{2,4}-[a-z0-9]{3,5}-[a-z0-9]{2,4}$/i.test(seg)) return seg.toLowerCase();
    // Fallback: bare path segment that looks like a code
    if (/^[a-z0-9-]{6,20}$/i.test(seg)) return seg.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

/**
 * Open a Google Meet link without navigating the current Valeo page away.
 * On mobile (esp. PWA / iOS), a plain <a href> to Meet can replace the app;
 * Cancel on the "Open Meet?" prompt then leaves a blank screen.
 */
export function openMeetLink(url: string, e?: { preventDefault(): void; stopPropagation(): void }) {
  e?.preventDefault();
  e?.stopPropagation();
  if (!url || typeof window === "undefined") return;

  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    return;
  }

  // Popup blocked. Never assign location in standalone PWA — that blanks the app on Cancel.
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  if (standalone) {
    try {
      void navigator.clipboard?.writeText(url);
    } catch {
      /* ignore */
    }
    window.alert(
      "Couldn't open Meet automatically. The link was copied — paste it in Safari or Chrome to join."
    );
    return;
  }

  window.location.assign(url);
}
