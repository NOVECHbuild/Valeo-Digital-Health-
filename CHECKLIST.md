# Valeo — Master Action Plan & Checklist

_Living checklist. Mark `[x]` when done. Owner: **You** (Benny) · **Me** (Cursor) · **Both**._

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Best order (work top → bottom)

| # | Phase | What | Status |
|---|--------|------|--------|
| **1** | **A** | Commit + deploy QA + legal batch → smoke | `[x]` sidebar fixed (`b94a5d8e`); finish A.13–A.14 if not done |
| **2** | **C** | Portal smoke (invite → match → message → assessment) | `[ ]` after deploy |
| **3** | **D** | Stripe test card + webhook + Resend Logs | `[ ]` |
| **4** | **E** | Google Calendar connect → Meet on approve | `[ ]` |
| **5** | **F** | Soft-launch ops (cron, backups, real invites) | `[ ]` |
| **6** | **G** | Product upgrades (pick later) | `[ ]` |
| **7** | **H** | Public self-register + off Calendly | `[ ]` later |

**You are here:** Step **1** — say **commit** (and push) so Vercel builds. Vercel Cursor plugin is on for this project.

---

## Decisions locked

- Payments → **Stripe → Mercury** (WiPay routes kept, unused)
- Stay **invite-only** until Stripe E2E works
- Homepage public CTAs stay on **Calendly** until Phase H
- No fake clinical/compliance claims
- Ask before new paid vendors

---

## Phase A — QA + legal ship

| # | Owner | Item | Status |
|---|--------|------|--------|
| A.1 | Me | Sidebar `h-dvh` (client / doctor / admin) | `[x]` |
| A.2 | Me | Homepage mobile nav | `[x]` |
| A.3 | Me | OG → `og-image.png` | `[x]` |
| A.4 | Me | Admin Add Doctor + Stripe labels | `[x]` |
| A.5 | Me | Login invite copy + `replace` | `[x]` |
| A.6 | Me | Doctor notes `getDoc` + Session Notes card | `[x]` |
| A.7 | Me | Email APIs HTTP 500 | `[x]` |
| A.8 | Me | `error.tsx` + `not-found.tsx` | `[x]` |
| A.9 | Me | **Legal:** Privacy / Terms / HIPAA WiPay → Stripe; dates Aug 2026 | `[x]` |
| A.10 | Me | Disclaimer Last Updated bump | `[x]` |
| A.11 | You | Commit + push QA + legal | `[x]` `d671f0ad` → main |
| A.12 | You | Smoke: sidebar after login (no refresh) | `[x]` Benny confirmed |
| A.13 | You | Smoke: phone hamburger menu | `[ ]` |
| A.14 | You | Smoke: `/legal/*` say Stripe, not WiPay | `[ ]` |
| A.15 | You | Optional: OG / social debugger refresh | `[ ]` |

---

## Phase B — Legal (merged into A.9–A.10)

_Mechanical Stripe swap done. Optional lawyer review stays in Phase H._

| # | Owner | Item | Status |
|---|--------|------|--------|
| B.1 | You | Spot-check four legal pages after deploy | `[ ]` = A.14 |
| B.2 | You | Optional lawyer review before public launch | `[ ]` Phase H |

---

## Phase C — Portal smoke

| # | Owner | Item | Status |
|---|--------|------|--------|
| C.1 | You | Confirm admin role for `ewilkins25@gmail.com` | `[ ]` |
| C.2 | You | Admin create/invite test client | `[ ]` |
| C.3 | You | Assignments → match ↔ Dr. Miller | `[ ]` |
| C.4 | You | Client: login → appointments loads | `[ ]` |
| C.5 | You | Doctor: schedule + Services/prices set | `[ ]` |
| C.6 | You | Message both ways | `[ ]` |
| C.7 | You | Assessment assign → submit → review | `[ ]` |
| C.8 | You | Resource upload → client sees it | `[ ]` |
| C.9 | You | Announcement → client/doctor banner | `[ ]` |
| C.10 | You | Hit a bad URL → branded 404 | `[ ]` |

---

## Phase D — Payments + email E2E

| # | Owner | Item | Status |
|---|--------|------|--------|
| D.1 | You | Stripe keys + webhook secret on Vercel | `[x]` |
| D.2 | You | Resend API key on Vercel | `[x]` |
| D.3 | You | `CRON_SECRET` on Vercel | `[ ]` |
| D.4 | You | Book paid session → Stripe → `4242…` | `[ ]` |
| D.5 | You | Webhook succeeded in Stripe Dashboard | `[ ]` |
| D.6 | You | Appointment paid/approved as designed | `[ ]` |
| D.7 | You | Resend Logs show emails | `[ ]` |
| D.8 | You | Mercury = Stripe payout bank | `[ ]` |
| D.9 | You | Stripe KYC complete | `[ ]` |
| D.10 | You | Live $1 charge + refund (after D.4–D.9) | `[ ]` |

---

## Phase E — Google Calendar + Meet

| # | Owner | Item | Status |
|---|--------|------|--------|
| E.1 | You | OAuth env on Vercel (business GCP) | `[ ]` |
| E.2 | You | `GOOGLE_REDIRECT_URI` matches Console | `[ ]` |
| E.3 | You | `TOKEN_ENCRYPTION_KEY` set | `[ ]` |
| E.4 | You | Doctor → Connect Google Calendar | `[ ]` |
| E.5 | You | Approve session → Meet link | `[ ]` |
| E.6 | You | Busy slots grey out (or fail-safe) | `[ ]` |

---

## Phase F — Soft-launch ops

| # | Owner | Item | Status |
|---|--------|------|--------|
| F.1 | You | Cron reminders OK | `[ ]` |
| F.2 | You | Firestore backups on | `[ ]` |
| F.3 | You | Optional GA | `[ ]` |
| F.4 | You | Invite real clients (Calendly still public) | `[ ]` |

---

## Phase G — Product upgrades (later)

| # | Item | Priority | Status |
|---|------|----------|--------|
| G.1 | PHQ-9 / GAD-7 scored trends | High | `[ ]` |
| G.2 | E-sign consent PDF | High | `[ ]` |
| G.3 | Mark complete → Add note prompt | Med | `[ ]` |
| G.4 | Recurring appointments | Med | `[ ]` |
| G.5 | SMS (Twilio) — ask first | Later | `[ ]` |
| G.6 | Wire/hide platform toggles | Low | `[ ]` |
| G.7 | Role middleware harden | Low | `[ ]` |
| G.8 | Session cookie refresh | Low | `[ ]` |

---

## Phase H — Public launch (later)

| # | Owner | Item | Status |
|---|--------|------|--------|
| H.1 | You | Stripe live + Mercury OK | `[ ]` |
| H.2 | You | Lawyer review (optional but wise) | `[ ]` |
| H.3 | You | Google OAuth verification | `[ ]` |
| H.4 | Me | Public self-registration | `[ ]` |
| H.5 | Me | Homepage off Calendly → in-app book | `[ ]` |

---

## Tooling (this machine)

| # | Owner | Item | Status |
|---|--------|------|--------|
| T.1 | You | Stripe Cursor plugin | `[x]` |
| T.2 | You | Resend Cursor plugin | `[x]` |
| T.3 | You | **Vercel Cursor plugin** for this project | `[x]` 2026-08-07 |
| T.4 | Me | Use Vercel plugin for deploy status / logs when helpful | `[x]` ready |

---

## Account map (no secrets)

| Service | Notes |
|---------|--------|
| Vercel | `info@novech.io` / NOVECHbuild · plugin enabled |
| GitHub | NOVECHbuild/Valeo-Digital-Health- |
| Firebase | `valeo-digital-health` |
| GCP | `valeo-digital-health-504817` |
| Resend | thevaleoexperience · domain verified |
| Stripe | NOVECH LLC · test mode |
| Mercury | Link as payout |
| Admin | `ewilkins25@gmail.com` |

---

## Do-not-break

| # | Item | Status |
|---|------|--------|
| Z.1 | Dual firebaseAdmin files | `[x]` |
| Z.2 | Do not weaken auth helpers | `[x]` |
| Z.3 | Never commit secrets | `[x]` |
| Z.4 | Invite-only + Calendly until H | `[x]` |

---

## Reference canvases

| Canvas | Contents |
|--------|----------|
| `portal-audit` | Pages + perf + bugs + tackle order (updated) |
| `action-plan` | Phase overview |
| `feature-roadmap` | Feature wiring + peer ideas |
| **This file** | Checkboxes to tick |

---

## Session log

| Date | What |
|------|------|
| 2026-08-07 | Stripe 3B; Resend; full audit; QA batch coded |
| 2026-08-07 | Legal WiPay→Stripe; checklist + portal-audit refreshed; Vercel plugin noted |
