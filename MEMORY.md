# Valeo — session memory

_Update this when Benny shares a new fact, decision, blocker, or “do not change” item._

## Current goal
- **Stripe parked** until website/product feels complete (Benny 2026-08-07).
- Build sequence: **1 recurring** (done) → **2 portal polish** (done) → **3 stale-data pass** next.
- Meet/Calendar working. Stay invite-only + Calendly homepage until public launch.

## Later (noted, not now)
- Client/Firestore dashboards feel stale: first paint shows old data, then catches up; live updates feel slow. Likely cache + snapshot timing — tackle in a dedicated pass.

## Account map (business — confirmed 2026-08-07)

| Service | Account | Notes |
|---------|---------|--------|
| Vercel | `info@novech.io` / team **NOVECHbuild** / project `valeo-digital-health` | Domains Valid; production `www.valeoexperience.com` |
| GitHub | org **NOVECHbuild** | https://github.com/NOVECHbuild/Valeo-Digital-Health- (local origin switched) |
| Firebase | `info@novech.io` / project `valeo-digital-health` | Business |
| Google Cloud (OAuth/Calendar) | `info@novech.io` / **`valeo-digital-health-504817`** | Setup complete |
| Resend | Team **thevaleoexperience** | Domain verified; new API key on Vercel; waiting on deploy then E2E email test |
| Stripe | **NOVECH LLC** | Plugin installed; Test mode; keys + Mercury next |
| Mercury | **NOVECH** | Not linked to Stripe yet |
| GoDaddy | `jozellemiller@gmail.com` | Client-owned domain `valeoexperience.com` |
| Valeo admin (app) | `ewilkins25@gmail.com` | Firestore role must be `admin` |
| Google Analytics | — | Not set up |

## Shipped (high level)
- See `CLAUDE.md`. Domain now on business Vercel (Valid Configuration).

## Blocked / watch
- Google Cloud OAuth, Resend, Stripe still need business setup.
- Local folder git “dubious ownership” (different Windows user SID) — may need `safe.directory` before git works on this PC.
- Public self-registration deferred until Stripe works.
- Google OAuth verification (Phase 5) after Cloud project exists.

## Do not change
- Invite-only + Calendly homepage CTAs until self-serve opens.
- Dual Firebase Admin files. Do not delete WiPay until Stripe cutover confirmed.

## Client notes
- Client: Dr. Jozelle Miller. Domain registrar login is hers (GoDaddy).
- Brand: forest / lime / orange. Admin: Eben (`ewilkins25@gmail.com`).
