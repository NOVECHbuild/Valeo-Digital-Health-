# Valeo Experience — Launch Readiness Review

_A go-live assessment for taking on real clients. Status is one of:_
**✅ Done** · **⚠️ Action needed (you)** · **⛔ Blocked** · **➡️ Decision**

The platform is **feature-complete**. What stands between here and launch is mostly
verification, the WiPay payment blocker, and a few operational steps — not new code.

---

## TL;DR — the critical path

The single gating item is **WiPay** (online card payments aren't tested/working yet).
Everything else is either done or a short checklist. So the realistic path is a
**phased launch**:

1. **Phase 0 — soft launch now (invite-only, no online card payments).** Free
   consultations work end-to-end today; paid sessions can be handled as **manual/cash**
   (the admin Financials "manual payment" flow) until WiPay clears. This lets Dr. Miller
   see real clients immediately.
2. **Phase 1 — enable online payments** once WiPay is resolved + tested and the currency
   mismatch is fixed.
3. **Phase 2 — open to the public** (self-registration) + onboard more doctors + complete
   Google OAuth verification.

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
| Legal pages review | ➡️ Decision | Privacy / Terms / HIPAA / Disclaimer are built — have a professional review them for accuracy, especially for a **mental-health** service handling sensitive data. |
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
