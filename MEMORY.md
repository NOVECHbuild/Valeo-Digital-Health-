# Valeo — session memory

_Update this when Benny shares a new fact, decision, blocker, or “do not change” item._

## Current goal
- **Stripe parked** until website/product feels complete (Benny 2026-08-07).
- Build sequence: **1 recurring** → **2 portal polish** → **3 stale-data** (done). Soft-launch ops next when ready.
- Meet/Calendar working. Stay invite-only + Calendly homepage until public launch.
- **Clinical file (Phase 1 shipped):** Doctor Clients → Clinical file tab; manual Meet audio/transcript upload → AI SOAP → `sessionReports` + linked `notes`. Doctor-owned forever (not client-visible; not transferred on reassignment). In-app Meet/Workspace guide. Auto-Meet transcription deferred until revenue. Consent v`2026-08-08` includes recording/AI ack.
- **PWA Phase 1 shipped:** Installable PWA + mobile consoles + FCM web push + deploy version guard. VAPID key set (Benny).
- **Versioning (hardened):** poll `/api/version` every 30s when visible; auto-reload on new deploy; do not precache `version.json` (that was blocking updates).
- **Deploy blocker (fixed 2026-08-08):** Vercel Hobby allows cron **once/day only**. A `*/15` expire-holds cron silently failed every deploy after pay-in-full; unpaid holds still expire via freebusy/initiate + daily cron.
- **Confirmed working:** Messages, Google Calendar/Meet. Soft-launch ops still open (cron/backups/invites).
- **Watch:** Doctor Resend emails — code now resolves Auth email + logs; confirm in Resend Logs after next booking.
- **Next for Benny:** Stripe E2E (Phase D) + finish portal smoke + confirm doctor emails arrive.
- **Pay model (locked 2026-08-08):** Client self-book: no same-day; doctor has **12h** to approve → client pays within **24h** (capped before session start) → Confirmed/Paid + Meet. **Doctor can Book for client** (any time incl. same-day) to bypass those barriers; client still must pay before Join. Free sessions confirm on doctor approve / doctor-book.

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
- **Ownership:** Valeo Experience (brand, practice, clients) = Dr. Miller / **Valeo Experience Ltd.** (St. Vincent and the Grenadines). NOVECH = builder + payment facilitator.
- **Contracting entity (NOVECH side):** **NOVECH LLC (Barbados)** — not Wyoming — for the Valeo deal.
- Heads of terms (discussion draft, Word): `E:\NOVECH Projects\NOVECH Business Development\01_Company_Foundations\contracts\NOVECH_Valeo_Experience_Heads_of_Terms.docx` (HTML twin also available)
- Letterhead (Word): `E:\NOVECH Projects\NOVECH Business Development\01_Company_Foundations\letterhead\NOVECH_LLC_Barbados_Letterhead.docx`

## Commercial terms (locked with Benny 2026-08-07 — for contract; not yet in product payouts)
- Model **A:** % of paid session gross (not flat SaaS).
- **NOVECH fee: 10%** of paid session amount.
- **Stripe processing fees:** borne by Valeo Experience Ltd.
- **Settlement:** monthly from NOVECH Mercury → Valeo bank.
- **Minimum transfer balance: $100 USD** — if owed balance is under $100, roll to next month.
- Admin settlement UI shipped: Platform Settings (`platformFeePercent` default 10, `minPayoutUsd` 100, `payoutReceiptEmail`) + Financials settlement panel + `payouts` collection + receipt email `/api/email/payout-receipt`. Still **manual** Mercury transfer (no Stripe Connect auto-split).
