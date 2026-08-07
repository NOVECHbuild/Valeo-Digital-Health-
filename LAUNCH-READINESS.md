# Valeo Experience — Launch Readiness Review

> **Superseded for day-to-day work by [`CHECKLIST.md`](./CHECKLIST.md)**  
> (Stripe → Mercury, GoDaddy↔Vercel DNS, phased setup). Keep this file as historical context.

_A go-live assessment for taking on real clients. Status is one of:_
**✅ Done** · **⚠️ Action needed (you)** · **⛔ Blocked** · **➡️ Decision**

The platform is **feature-complete**. Critical path updated Aug 2026: **Stripe + domain migration**, not WiPay.

---

## TL;DR — the critical path

**Payment direction (Aug 2026):** Stripe → Mercury. WiPay is dormant. See `CHECKLIST.md`.

Phased launch:

1. **Phase 0–2 — workbench + GoDaddy/Vercel DNS + env** (invite-only; free/manual until Stripe).
2. **Phase 3 — Stripe online payments** (test → live) + soft launch with paid bookings.
3. **Phase 5 — public** (self-registration) + Google OAuth verification + more doctors.

---

## P0 — Must clear before charging real money

| Item | Status | Notes |
|------|--------|-------|
| WiPay end-to-end test | ⛔ Blocked | Awaiting WiPay support. Until then, **don't take online card payments** — use free consults + manual/cash. |
| Currency mismatch | ⚠️ Action (code, when WiPay unfreezes) | Booking UI shows **USD**, the payment record/charge is tagged **TTD**. Must reconcile before real charges. Flag me to fix when the WiPay freeze lifts. |
| Sandbox → live WiPay switch | ⚠️ Action | When ready: set `WIPAY_ENVIRONMENT=live` + live `WIPAY_ACCOUNT_NUMBER` / `WIPAY_API_KEY`. No code change needed. |
| Dr. Miller fully set up | ⚠️ Verify | Her schedule hours, **Services + prices**, and **Google Calendar connected** all configured in the Doctor console. |
| Admin account role | ⚠️ Verify | Your `users/{uid}.role` must be `"admin"` (the Firestore rules depend on it). |

## P1 — Should do before real clients

| Item | Status | Notes |
|------|--------|-------|
| Email deliverability | ⚠️ Verify | `EMAIL_FROM` on the verified `valeoexperience.com` domain; send a test booking and confirm the email arrives (check Resend → Logs). |
| Reminder cron | ⚠️ Verify | `CRON_SECRET` set in Vercel; confirm the daily job runs (Vercel → Cron / function logs). |
| Google Analytics | ✅ Done (set env) | `NEXT_PUBLIC_GA_ID` added — confirm Realtime shows traffic. |
| Final cross-role QA | ⚠️ Action | Walk `TESTING.md` as client + doctor + admin on the live site. |
| Legal pages review | ⚠️ Action | Still say **WiPay** — Phase **B** in `CHECKLIST.md` (mechanical Stripe swap after Benny approves; optional lawyer before public). |
| Firestore + Storage backups | ⚠️ Action | Enable scheduled Firestore backups (Firebase console) so client/clinical data is recoverable. |
| Rollback plan | ✅ Available | Vercel keeps every deployment — one-click "Promote to Production" on a prior build if something breaks. |

## P2 — Post-launch / as you scale

| Item | Status | Notes |
|------|--------|-------|
| Public self-registration | ➡️ Deferred | Build + enable once WiPay clears (decided). |
| Google OAuth verification | ⚠️ Pre-public | App is in **Testing** mode (100-user cap, test users only). Fine while it's just Dr. Miller; verify before opening doctor sign-ups broadly. |
| Security hardening | ➡️ Optional | Resource-upload writes via custom claims; encrypt OAuth refresh tokens at rest; tighten the broad signed-in Firestore reads. |
| Duration-aware slots | ✅ Done | 90-min sessions now block overlapping slots. |
| Monitoring/alerting | ➡️ Nice-to-have | Consider Vercel/Sentry error alerts + uptime monitoring once you have steady traffic. |

---

## Operational notes

- **NUL-byte corruption (local):** the recurring null-byte issue is handled by the
  `prebuild` guard (`npm run clean:nul`), so builds self-heal. Still worth confirming the
  folder is excluded from any sync/AV so it stops at the source.
- **Deploys:** code → `npm run build` + git push (Vercel). Rules → `firebase deploy --only
  firestore:rules`. Storage → `firebase deploy --only storage`.
- **Invite-only today:** new clients are created by you (admin) → they complete onboarding
  → get matched → book. That's the controlled funnel until public registration opens.

## Suggested go-live sequence

1. **Now:** Verify P0 setup (Dr. Miller's services/calendar, admin role) + P1 email/QA →
   soft-launch **invite-only with free consults / manual payments**.
2. **WiPay resolved:** fix currency, switch WiPay to live, full payment test → turn on
   **online paid bookings**.
3. **Scale:** OAuth verification → open **public self-registration** → onboard additional
   doctors (each sets their own services, pricing, and Google Calendar).
