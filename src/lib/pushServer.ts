// Server-side FCM send via Firebase Admin. Fail-safe if messaging unavailable.
import admin, { adminDb } from "@/lib/firebaseAdmin";

export type PushPrefKey = "pushEnabled" | "pushAppointments" | "pushMessages" | "pushAssessments" | "pushReminders";

export function pushPrefAllows(notifPrefs: any, key: PushPrefKey): boolean {
  if (!notifPrefs) return true;
  // Master kill-switch
  if (notifPrefs.pushEnabled === false) return false;
  // Category defaults to on when unset
  if (key === "pushEnabled") return true;
  return notifPrefs[key] !== false;
}

async function tokensForUser(uid: string): Promise<string[]> {
  if (!uid) return [];
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return [];
    const data = snap.data() as any;
    const tokens = data?.fcmTokens;
    if (Array.isArray(tokens)) return tokens.filter((t: unknown) => typeof t === "string" && t);
    return [];
  } catch {
    return [];
  }
}

async function pruneBadTokens(uid: string, bad: string[]) {
  if (!uid || bad.length === 0) return;
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return;
    const current: string[] = (snap.data() as any)?.fcmTokens || [];
    const next = current.filter(t => !bad.includes(t));
    await adminDb.collection("users").doc(uid).update({ fcmTokens: next });
  } catch { /* ignore */ }
}

/**
 * Send a non-PHI web push to a user. No-ops if no tokens / messaging not configured.
 */
export async function sendPushToUser(
  uid: string,
  opts: { title: string; body: string; url: string; prefKey?: PushPrefKey },
): Promise<{ ok: boolean; sent?: number; skipped?: boolean; error?: string }> {
  try {
    if (!admin.apps.length) return { ok: true, skipped: true, error: "admin not ready" };
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) return { ok: false, skipped: true, error: "user missing" };
    const prefs = (userSnap.data() as any)?.notifPrefs;
    if (!pushPrefAllows(prefs, opts.prefKey || "pushEnabled")) {
      return { ok: true, skipped: true };
    }

    const tokens = await tokensForUser(uid);
    if (tokens.length === 0) {
      console.warn("[pushServer] no fcmTokens for", uid);
      return { ok: true, skipped: true, error: "no_tokens" };
    }

    const messaging = admin.messaging();
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: opts.title,
        body: opts.body,
      },
      data: {
        title: opts.title,
        body: opts.body,
        url: opts.url,
      },
      webpush: {
        fcmOptions: { link: opts.url },
      },
    });

    const bad: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = (r.error as any)?.code || "";
        if (
          code.includes("registration-token-not-registered")
          || code.includes("invalid-registration-token")
        ) {
          bad.push(tokens[i]);
        }
      }
    });
    if (bad.length) await pruneBadTokens(uid, bad);

    return { ok: true, sent: res.successCount };
  } catch (e: any) {
    console.warn("[pushServer]", e?.message || e);
    return { ok: false, error: e?.message || "push failed" };
  }
}
