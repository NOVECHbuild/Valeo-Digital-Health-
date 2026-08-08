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
