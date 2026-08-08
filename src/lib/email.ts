// ════════════════════════════════════════════════════════════════════════════
//  Email — Resend transactional email (via REST, no SDK dependency)
//  FAIL SAFE: if RESEND_API_KEY is not set, sends are skipped silently so the
//  app behaves exactly as before. Emails start flowing once the key + verified
//  domain are configured in the environment.
// ════════════════════════════════════════════════════════════════════════════

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Brand palette (matches the Valeo logo)
const FOREST = "#2A4A1A";
const GREEN  = "#8DC63F";
const ORANGE = "#F7941D";

export interface SendArgs {
  to:      string | string[];
  subject: string;
  html:    string;
}

export async function sendEmail({ to, subject, html }: SendArgs): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — skipping "${subject}"`);
    return { ok: false, skipped: true };
  }
  const recipients = (Array.isArray(to) ? to : [to]).map(t => (t || "").trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn(`[email] empty "to" — skipping "${subject}"`);
    return { ok: false, skipped: true, error: "empty recipient" };
  }
  const from = process.env.EMAIL_FROM || "Valeo Experience <noreply@valeoexperience.com>";
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from, to: recipients.length === 1 ? recipients[0] : recipients, subject, html }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[email] send failed", res.status, txt, { to: recipients, subject });
      return { ok: false, error: txt };
    }
    console.log(`[email] sent "${subject}" → ${recipients.join(", ")}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[email] send error", err?.message ?? err);
    return { ok: false, error: err?.message ?? "send error" };
  }
}

// ── Branded HTML template ───────────────────────────────────────────────────
export interface EmailContent {
  heading:    string;
  greeting?:  string;          // e.g. "Hi Jane,"
  paragraphs: string[];
  details?:   { label: string; value: string }[];
  cta?:       { label: string; url: string };
  footerNote?: string;
}

// HTML-escape a plain-text value before interpolating into email markup.
export function esc(s?: string): string {
  return (s ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}

export function renderEmail(c: EmailContent): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";
  const details = c.details?.length
    ? `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">${c.details.map(d => `
        <tr>
          <td style="padding:8px 0;color:#8A9BA8;font-size:13px;width:40%;">${esc(d.label)}</td>
          <td style="padding:8px 0;color:${FOREST};font-size:14px;font-weight:600;">${esc(d.value)}</td>
        </tr>`).join("")}
      </table>`
    : "";
  const cta = c.cta
    ? `<a href="${c.cta.url}" style="display:inline-block;margin:8px 0 4px;padding:12px 28px;background:linear-gradient(135deg,${FOREST},#3D6B24);color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">${esc(c.cta.label)}</a>`
    : "";
  const greeting = c.greeting ? `<p style="margin:0 0 12px;color:${FOREST};font-size:15px;font-weight:600;">${esc(c.greeting)}</p>` : "";
  const note = c.footerNote ? `<p style="margin:16px 0 0;color:#8A9BA8;font-size:12px;line-height:1.6;">${c.footerNote}</p>` : "";

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F2F8EA;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#F2F8EA;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 6px rgba(42,74,26,0.1);">
        <tr><td style="height:5px;background:linear-gradient(90deg,${GREEN},${ORANGE});"></td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:${FOREST};font-family:Georgia,'Times New Roman',serif;">Valeo Experience</p>
          <p style="margin:2px 0 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${GREEN};font-weight:600;">Caribbean Mental Health</p>
        </td></tr>
        <tr><td style="padding:12px 32px 28px;">
          <h1 style="margin:8px 0 16px;font-size:20px;color:${FOREST};">${esc(c.heading)}</h1>
          ${greeting}
          ${c.paragraphs.map(p => `<p style="margin:0 0 12px;color:#4A5568;font-size:14px;line-height:1.7;">${p}</p>`).join("")}
          ${details}
          ${cta}
          ${note}
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid rgba(42,74,26,0.08);">
          <p style="margin:0;color:#8A9BA8;font-size:11px;line-height:1.6;">
            You're receiving this because you have an account at
            <a href="${appUrl}" style="color:${GREEN};text-decoration:none;">Valeo Experience</a>.
            Manage email preferences in your account settings.
          </p>
          <p style="margin:8px 0 0;color:#C4C4C4;font-size:11px;">© ${new Date().getFullYear()} The Valeo Experience · All Rights Reserved</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

// Notification-preference gate. Defaults to true when unset.
export function prefAllows(notifPrefs: any, key: "emailAppointments" | "emailMessages" | "emailAssessments"): boolean {
  if (!notifPrefs) return true;
  return notifPrefs[key] !== false;
}

// Render a doctor's display name with a single "Dr." prefix (no doubling).
export function formatDoctorName(name?: string): string {
  const n = (name || "").trim();
  if (!n) return "your therapist";
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
}
