# Valeo — Master Setup & Launch Checklist

_Living checklist. Mark items `[x]` when done. Owner: **You** (Benny) · **Me** (Cursor) · **Both**._

**Decisions locked (2026-08-07)**
- Payments → **Stripe → Mercury** (WiPay dormant until Stripe live; do not delete WiPay yet)
- Stay **invite-only** until Stripe checkout works
- Homepage public CTAs stay on **Calendly** until public registration opens
- Last private→business migration step → **GoDaddy DNS ↔ Vercel domain ownership**

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked / waiting

---

## Phase 0 — Workbench (this machine + access)

| # | Owner | Item | Status |
|---|--------|------|--------|
| 0.1 | You | Confirm Cursor is open on `E:/NOVECH Projects/valeo-digital-health` only | `[x]` |
| 0.2 | You | Log into **business** accounts (not personal): Vercel, Firebase, Google Cloud, GitHub, Resend, Stripe, Mercury, GoDaddy | `[~]` Cloud ✅; Resend domain + Stripe Cursor plugin next |
| 0.2b | Both | Fill **Account map** below (emails / project IDs only — no secrets) | `[x]` 2026-08-07 |
| 0.3 | Me | Install **Vercel CLI** + log in to business team | `[~]` CLI installed — login next |
| 0.4 | Me | Install **Firebase CLI** + log in; confirm project `valeo-digital-health` | `[~]` CLI installed — login next |
| 0.5 | Both | Confirm GitHub remote / Vercel project link to business team | `[x]` origin → `NOVECHbuild/Valeo-Digital-Health-` (+ safe.directory) |
| 0.6 | You | Confirm admin user `users/{uid}.role == "admin"` in Firestore | `[ ]` login `ewilkins25@gmail.com` |

### Account map (confirmed 2026-08-07 — NO secrets)

| Service | Login / team | Project / resource | Personal or Business? | Notes |
|---------|--------------|--------------------|------------------------|-------|
| Vercel | `info@novech.io` / **NOVECHbuild** | `valeo-digital-health` | Business | Domains Valid; prod = www |
| GitHub | **NOVECHbuild** | [NOVECHbuild/Valeo-Digital-Health-](https://github.com/NOVECHbuild/Valeo-Digital-Health-) | Business | Local `origin` switched |
| Firebase | `info@novech.io` | `valeo-digital-health` | Business | Matches `.firebaserc` |
| Google Cloud | `info@novech.io` | **`valeo-digital-health-504817`** | Business | Setup complete |
| Resend | **New free account** (Valeo Experience Gmail) | `valeoexperience.com` | Valeo-only | Decision A — setup in progress |
| Stripe | **NOVECH LLC** | Test mode | Business | Cursor plugin installed; keys + Mercury next |
| Mercury | **NOVECH** | — | Business | Link as Stripe payout bank |
| GoDaddy | `jozellemiller@gmail.com` | `valeoexperience.com` | Client-owned | DNS for Vercel done |
| Valeo admin (app) | `ewilkins25@gmail.com` | Firestore role `admin` | — | Confirm role in Firebase |
| Google Analytics | — | — | — | Not set up |
| Calendly | — | Homepage public booking | — | Keep until self-serve |

---

## Phase 1 — Domain: GoDaddy ↔ Vercel (do this first)

| # | Owner | Item | Status |
|---|--------|------|--------|
| 1.1 | You | In **business** Vercel → project → Settings → Domains: add `valeoexperience.com` + `www.valeoexperience.com` | `[x]` |
| 1.2 | You | If Vercel asks to **verify ownership**: copy the **TXT** record Host + Value | `[x]` |
| 1.3 | You | In GoDaddy → Domains → `valeoexperience.com` → DNS: add that TXT (do not change nameservers unless intentional) | `[x]` |
| 1.4 | You | Add/confirm apex **A** → `76.76.21.21` (or exact value Vercel shows) | `[x]` Valid Config = OK |
| 1.5 | You | Add/confirm **www CNAME** → value Vercel shows | `[x]` Valid Config = OK |
| 1.6 | You | Wait until Vercel shows domains **Valid**; site loads on HTTPS | `[x]` both Valid; www = Production |
| 1.7 | You | If domain was on a **personal** Vercel team: remove/transfer so only business project owns it | `[x]` Benny: no longer on old account |
| 1.8 | Both | Paste Vercel’s DNS instructions here (or screenshot notes) if anything fails — Me will verify | `[x]` |

**Notes**
- Phase 1 complete 2026-08-07. Apex → www (308). Optional: delete `_vercel` TXT in GoDaddy (no longer needed).

---

## Phase 2 — Env & services (local + Vercel)

Fill every key on **local** `.env.local` **and** Vercel Production env (same names). Never commit secrets.

| # | Owner | Variable / service | Local | Vercel | Notes |
|---|--------|-------------------|-------|--------|-------|
| 2.1 | You | Firebase client `NEXT_PUBLIC_FIREBASE_*` | `[x]` present | `[ ]` | Confirm business Firebase project |
| 2.2 | You | Firebase Admin `FIREBASE_*` | `[x]` present | `[ ]` | |
| 2.3 | You | `NEXT_PUBLIC_APP_URL` = `https://www.valeoexperience.com` | `[ ]` | `[x]` Benny | Mirror locally when convenient |
| 2.4 | You | `NEXT_PUBLIC_BASE_URL` | `[x]` | `[ ]` | Align with APP_URL |
| 2.5 | You | `RESEND_API_KEY` | `[ ]` | `[ ]` | Rotate if ever shared in chat |
| 2.6 | You | `EMAIL_FROM` e.g. `Valeo Experience <noreply@valeoexperience.com>` | `[ ]` | `[ ]` | Domain must be verified in Resend |
| 2.7 | You | `CRON_SECRET` (strong random) | `[ ]` | `[ ]` | Powers `/api/cron/reminders` |
| 2.8 | You | `NEXT_PUBLIC_GA_ID` | `[ ]` | `[ ]` | Confirm GA Realtime later |
| 2.9 | You | `TOKEN_ENCRYPTION_KEY` (64 hex chars) | `[ ]` | `[ ]` | Encrypts Google OAuth tokens |
| 2.10 | You | `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` / `DOCTOR_EMAIL` | `[x]` | `[ ]` | GCP project: `valeo-digital-health-504817` — re-issue OAuth under business if still on old project |
| 2.11 | You | `GOOGLE_REDIRECT_URI` = live callback URL | `[ ]` | `[ ]` | Must match Google Console |
| 2.12 | You | `GEMINI_API_KEY` | `[x]` | `[ ]` | Business Google AI / same project |
| 2.13 | You | Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | `[ ]` | `[x]` keys + webhook secret in Vercel | Deployed 2026-08-07 |
| 2.14 | You | WiPay vars | `[x]` | `[ ]` | Keep for now; unused after Stripe cutover |
| 2.15 | You | Resend: domain `valeoexperience.com` verified (SPF/DKIM in GoDaddy if needed) | `[~]` | — | New free Valeo Resend account (Gmail) — awaiting Benny |
| 2.16 | Both | Redeploy Vercel after env changes | `[ ]` | | |

---

## Phase 3 — Stripe + Mercury (accounts, then code)

### 3A — Accounts (You)

| # | Item | Status |
|---|------|--------|
| 3A.1 | Create/activate **Stripe** under business legal entity | `[x]` NOVECH LLC (Test mode visible) |
| 3A.2 | Complete Stripe KYC / business verification | `[ ]` |
| 3A.3 | Connect **Mercury** as Stripe payout bank | `[ ]` |
| 3A.4 | Turn on **Test mode**; copy test publishable + secret keys | `[x]` in Vercel (Benny) |
| 3A.5 | Stripe webhook endpoint (test) → `/api/stripe/webhook` | `[x]` + secret on Vercel + deployed |
| 3A.6 | Install Stripe **Cursor plugin** (`/add-plugin stripe`) | `[x]` |

### 3B — Build (Me) — start only when 3A.1–3A.4 done + You say go

**Architecture locked:** Stripe **hosted Checkout** (one-time USD session payments) → webhook marks appointment paid. WiPay left dormant. Free consults + manual/cash unchanged.

| # | Item | Status |
|---|------|--------|
| 3B.1 | Add Stripe SDK + env wiring (no WiPay deletion) | `[x]` `stripe` package + `src/lib/stripe.ts` |
| 3B.2 | Create Checkout Session for booking by service price (USD) | `[x]` `/api/payments/initiate` |
| 3B.3 | Success/cancel return pages wired to appointments | `[x]` |
| 3B.4 | Webhook: mark payment + appointment paid (server-authoritative) | `[x]` `/api/stripe/webhook` |
| 3B.5 | Booking UI uses Stripe instead of WiPay redirect | `[x]` |
| 3B.6 | Admin financials / gateway status labels updated | `[x]` |
| 3B.7 | Manual/cash path unchanged | `[x]` |
| 3B.8 | Local + preview test with Stripe test card | `[~]` ready to test on live |
| 3B.9 | Switch to live keys; live $1 test charge + refund | `[ ]` |
| 3B.10 | Cutover: WiPay left dormant (routes kept, unused) | `[ ]` |
| 3B.11 | Legal pages: replace WiPay wording with Stripe (after You approve copy) | `[ ]` |

---

## Phase 4 — Product ops (invite-only soft launch)

| # | Owner | Item | Status |
|---|--------|------|--------|
| 4.1 | You | Dr. Miller: schedule hours set | `[ ]` |
| 4.2 | You | Dr. Miller: Services + prices set | `[ ]` |
| 4.3 | You | Dr. Miller: Google Calendar **Connected** | `[ ]` |
| 4.4 | You | Test booking email (Resend logs show delivered) | `[ ]` |
| 4.5 | You | Confirm Vercel Cron reminders run (`CRON_SECRET` OK) | `[ ]` |
| 4.6 | You | Walk `TESTING.md` as client + doctor + admin | `[ ]` |
| 4.7 | You | Firebase: enable scheduled Firestore backups | `[ ]` |
| 4.8 | You | Soft launch: invite clients; free consults + Stripe (or manual until live) | `[ ]` |

---

## Phase 5 — Global / public scale

| # | Owner | Item | Status |
|---|--------|------|--------|
| 5.1 | You | Google OAuth app: leave Testing → submit **verification** | `[ ]` |
| 5.2 | Me | Enable public self-registration (when You decide) | `[ ]` |
| 5.3 | You | Homepage CTAs: Calendly → in-app book (when self-serve opens) | `[ ]` |
| 5.4 | You | Legal review (privacy / terms / mental-health accuracy) | `[ ]` |
| 5.5 | You | Onboard additional doctors (each: services, pricing, Google Cal) | `[ ]` |
| 5.6 | Both | Optional: error monitoring / uptime alerts | `[ ]` |

---

## Phase 6 — Do-not-break / hygiene

| # | Owner | Item | Status |
|---|--------|------|--------|
| 6.1 | Me | Keep `firebaseAdmin.ts` + `firebase-admin.ts` alias | `[x]` |
| 6.2 | Me | Do not weaken `requireAuth` / `authedFetch` | `[x]` |
| 6.3 | You | Never commit `.env` / keys | `[x]` standing rule |
| 6.4 | You | Exclude project folder from OneDrive/AV if NUL-byte corruption returns | `[ ]` |
| 6.5 | Me | `npm run build` green before each production push | `[ ]` standing |

---

## Critical path (order of work)

```
Phase 0 (access) → Phase 1 (GoDaddy/Vercel DNS) → Phase 2 (env + Resend DNS)
    → Phase 3A (Stripe + Mercury) → Phase 3B (Stripe code) → Phase 4 (soft launch)
    → Phase 5 (public / global)
```

**Current focus:** Finish Resend (A) in parallel → Stripe keys + Mercury (3A) → approve Stripe code (3B). Env gaps: APP_URL, CRON_SECRET, TOKEN_ENCRYPTION_KEY, Resend, Stripe keys on Vercel.

---

## Session log

| Date | What happened |
|------|----------------|
| 2026-08-07 | Checklist created. Stripe chosen. Mercury US bank noted. GoDaddy↔Vercel DNS identified as last migration step. |
| 2026-08-07 | Domains Valid on NOVECHbuild. Account map filled. Local git `origin` still `ebund3m` (needs switch to NOVECHbuild). Cloud/Resend/Stripe not created yet. |
