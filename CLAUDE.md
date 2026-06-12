# Valeo Digital Health — CLAUDE.md

## Project Identity
- **Platform:** Valeo Experience — Caribbean mental health SaaS
- **Client:** Dr. Jozelle Miller (health psychologist)
- **Live domain:** https://www.valeoexperience.com
- **GitHub:** github.com/ebund3m/Valeo-Digital-Health- (main branch)
- **Vercel project:** valeo-digital-health
- **Local path:** C:\Users\eben_\Projects\valeo-digital-health
- **Admin account:** Eben (ebund3m) — ewilkins25@gmail.com

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database / Auth:** Firebase — Firestore + Firebase Admin SDK
- **Deployment:** Vercel
- **Payments:** WiPay (Caribbean gateway, Barbados merchant account — bb.wipayfinancial.com)
- **Video:** Google Meet API (via Google Calendar API + OAuth2)
- **Calendar:** Google Calendar free/busy for booking availability (`/api/calendar/*`)
- **AI:** Gemini (Google Generative AI) — session summaries, SOAP notes
- **Email:** Resend (transactional, via REST — no SDK). Domain `valeoexperience.com` verified.
- **Styling:** Tailwind CSS + inline styles (DM Sans / DM Serif Display fonts)
- **Language:** TypeScript

---

## Architecture — Three-Role System
| Role | Path | Description |
|------|------|-------------|
| Client | `/client/*` | Patient-facing dashboard |
| Doctor | `/doctor/*` | Dr. Miller's clinical dashboard |
| Admin | `/admin/*` | Platform management (Eben) |

Route protection is handled via `src/middleware.ts` with Firebase Auth custom claims.

---

## Environment Variables
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
WIPAY_ACCOUNT_NUMBER
WIPAY_API_KEY
WIPAY_ENVIRONMENT          # 'sandbox' | 'live'
WIPAY_GATEWAY_URL          # defaults to https://bb.wipayfinancial.com/plugins/payments/request
NEXT_PUBLIC_APP_URL        # https://www.valeoexperience.com
NEXT_PUBLIC_BASE_URL       # https://www.valeoexperience.com
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
GOOGLE_REDIRECT_URI        # defaults to live-domain /api/auth/callback/google
DOCTOR_EMAIL               # Dr. Miller's Google account for calendar events
GEMINI_API_KEY
RESEND_API_KEY            # Resend transactional email
EMAIL_FROM                # e.g. "Valeo Experience <noreply@valeoexperience.com>"
CRON_SECRET               # authorises the Vercel Cron reminder job
```

Sandbox-to-live WiPay switch: change `WIPAY_ENVIRONMENT`, `WIPAY_ACCOUNT_NUMBER`, `WIPAY_API_KEY` only. No code changes needed.

All third-party integrations are **fail-safe**: if `RESEND_API_KEY` or the Google Calendar credentials are missing, those features no-op silently and the app runs normally.

---

## Current Build Status (June 2026)

### ✅ Complete
- Homepage (`/`) — hero, services, about, how-it-works, testimonials, contact
- Auth pages — login, register (beta-gated), forgot-password
- Client console — dashboard, appointments, messages, payments, profile, settings, pay flow
- Doctor console — dashboard, clients, messages, notes, schedule, settings, analytics, assessments
- Admin console — dashboard, users, analytics, announcements, assignments, financials, settings
- Onboarding flow — `/onboarding`, `/onboarding/intake`, `/onboarding/match`
- Google Meet API route — `/api/meet/create` (generates Meet link, saves to appointment doc)
- AI session summary route — `/api/ai/session-summary` (Gemini, outputs SOAP notes as JSON)
- WiPay routes — `/api/wipay/create-payment`, `/api/wipay/verify-callback`
- Payment result pages — `/payment/callback`, `/payment/success`, `/payment/failed`
- Firebase Admin dual import — `firebaseAdmin.ts` + `firebase-admin.ts` alias
- Legal pages — `/legal/privacy`, `/legal/terms`, `/legal/hipaa`, `/legal/disclaimer` (all built, footer wired)
- OG meta tags — full OpenGraph + Twitter Card metadata in `layout.tsx`
- OG image — `public/images/og-image.png` (1200×630, brand palette)
- Google Meet OAuth redirect URI — updated to live domain via env var
- Full brand rebrand — 44 files aligned to Valeo logo palette (forest green / lime / orange)

### ✅ Shipped this session (June 2026)
**P1 fixes**
- Admin nav active-state fix (`isActive` startsWith, all three console layouts)
- Sidebar flex-scroll fix — `min-h-0 overflow-x-hidden` on nav (admin/doctor/client)
- AI SOAP notes wired into Doctor Notes — "Generate with AI" (paste transcript or upload audio) → `/api/ai/session-summary` **preview mode** (returns SOAP without saving); appends to the note, suggests tags
- Announcement banner surfaced on client + doctor dashboards (`src/components/AnnouncementBanner.tsx`, dismissal in localStorage)
- Admin Platform Settings (`src/components/PlatformSettings.tsx` → `settings/platform`: default price, fee %, currency, maintenance + beta toggles)

**P2 features**
- Notes ↔ appointments — optional `appointmentId` on notes, "Link to Session" selector + linked chip; schedule cards have "Add / View session note" deep-linking to `/doctor/notes?appointmentId=…`
- Resources library — client page `/client/resources`, manager in doctor + admin consoles (`src/components/ResourcesManager.tsx`), `resources` Firestore collection, `src/lib/resources.ts`
- Google Calendar real availability — booking slots generated from the doctor's saved schedule (`src/lib/availability.ts`); `/api/calendar/freebusy` greys Google-busy slots (**fails safe** → falls back to platform availability); `/api/calendar/test` powers the connect button
- Email notifications (Resend) — `src/lib/email.ts`, routes `/api/email/appointment`, `/api/email/assessment`, `/api/cron/reminders` (Vercel Cron in `vercel.json`, daily 13:00 UTC). Triggers: booking, approve, cancel/reject, assessment-assign. Respects `users.notifPrefs`. Message emails deferred.

**Security / infra**
- `firestore.rules` + `firebase.json` + `.firebaserc` now in repo (was console-only). Deploy with `firebase deploy --only firestore:rules`.
- Hardened the conversation `messages` subcollection rule (participants-only, was any signed-in user)
- Added `resources` collection rule (read = signed-in, write = doctor/admin)
- Multi-doctor (client side): `useAssignedDoctor` hook; booking books with the client's **assigned** doctor (not the first found); appointments store `doctorName`; all client-facing "Dr. Miller" copy is dynamic/generalized. Unmatched clients are gated to `/onboarding/match`. Emails resolve the doctor from `appt.doctorId`.
- Per-doctor **pricing**: booking shows + WiPay charges each doctor's own `schedules/{doctorId}.sessionPricing` (server-authoritative in `/api/payments/initiate`; fallback to static map). Amount stored on the appointment. (Only the amount *source* changed in the frozen WiPay route.)
- Per-doctor **Google Calendar**: `src/lib/googleAuth.ts` `getDoctorAuth(doctorId)` uses each doctor's own refresh token (`googleTokens/{doctorId}`, server-only rule) with env fallback. OAuth flow: `/api/auth/google/start` + `/api/auth/callback/google`. `meet/create`, `calendar/freebusy`, `calendar/test` are all per-doctor. Doctor schedule "Connect Google Calendar" runs the real OAuth. Approving a session now calls `/api/meet/create` → Meet link on the doctor's own calendar. OAuth app is in **Testing** mode (see Outstanding: verify before go-live).
- Fixed unread-message badges — now read `conversations.unreadClient/unreadDoctor` via `useUnreadCount` (was querying a non-existent top-level `messages` collection)
- **NUL-byte build guard**: `scripts/clean-nul.js` runs as `prebuild` (and `npm run clean:nul`). Strips trailing NUL padding that the local machine keeps appending on save; refuses to touch files with mid-content NULs. Root cause is local (OneDrive/AV) — recurs each session until the folder is moved out of sync / excluded from AV.

### 🔴 Blocked / Outstanding
| Item | Notes |
|------|-------|
| WiPay end-to-end test | Blocked — awaiting resolution with WiPay support. Do not touch WiPay code until resolved. |
| Messages: new-conversation doctor | `client/messages` "start a new conversation" still picks the first doctor (`snap.docs[0]`) instead of the client's assigned doctor. Existing conversations are correctly keyed; only affects brand-new chats. Point it at `useAssignedDoctor`. (P3) |
| Real photos (Dr. Miller) | Hero, about, service tab images still placeholders |
| Social links in footer | Facebook, Instagram, YouTube still `#` |
| Homepage CTAs | All route to beta-gated `/register` — no path for real prospects. Awaiting Calendly URL. |
| Google Analytics | Not integrated |
| Resource file uploads | Resources are link-only (Layer 1). Firebase Storage uploads for downloadable worksheets = future. |
| Google OAuth verification (go-live) | OAuth app is in **Testing** mode (100-user cap, test users only). Before public launch: complete the Google Cloud audience + app/branding settings and submit for verification (Calendar is a sensitive scope). |
| Duration-aware slot blocking | Booking slot grid uses the doctor's single `slotDuration`; per-service durations drive the calendar event + busy check but not slot spacing. A 90-min session doesn't yet block the following slot. Future enhancement. |

### Doctor-defined services (shipped)
Each doctor manages their own services in **Schedule → Services** (`schedules/{doctorId}.services: Service[]` = `{id,name,duration,price,description?,active}`). `src/lib/availability.ts` has `Service`, `DEFAULT_SERVICES`, `bookableServices()` (active only, legacy fallback seeded from `sessionPricing`), `servicesForEditing()`. Booking renders the doctor's active services; `/api/payments/initiate` charges by service name; the Notes session-type dropdown lists the doctor's services. Legacy `sessionPricing` retained for back-compat; a doctor's list is auto-seeded on first load.

> Note: the Google Meet "localhost redirect" item is **resolved** — `/api/meet/create` reads `GOOGLE_REDIRECT_URI` from env with a live-domain default.

---

## Key Technical Rules

### Firebase
- User lookups: always `getDoc(doc(db, "users", uid))` — never `where("uid","==",uid)`
- List queries: `allow list: if isAuth()` for client-side snapshot listeners
- Live data: prefer `onSnapshot` over `getDocs` for any list needing real-time updates
- Timestamps: use the unified `toDate()` helper for all Firestore timestamps (handles both Firestore Timestamp objects and ISO strings)
- Scoped saves: save only the relevant section's fields — never overwrite the whole document

### Firebase Admin SDK
- Maintain both `src/lib/firebaseAdmin.ts` AND `src/lib/firebase-admin.ts` (re-export alias)
- Both import styles are used across API routes — do not remove either file

### Next.js 14 App Router
- `useSearchParams()` must be wrapped in `<Suspense>` boundaries
- Use `<Link>` (Next.js) not raw `<a href>` for internal navigation
- All async Firestore operations need `try/catch/finally` with visible error states

### WiPay Integration
- WiPay is a **form POST gateway**, not a REST API
- Flow: server prepares parameters → server POSTs to WiPay → WiPay returns a `url` → client redirects to that URL
- Gateway URL: `https://bb.wipayfinancial.com/plugins/payments/request` (Barbados)
- MD5 hash formula: `MD5(account_number + api_key + total + order_id + "success")`
- Fee structure: `merchant_absorb`
- Currency: `USD`, Country code: `BB`
- **Do not change WiPay code while support ticket is open**

### Email (Resend)
- Sent via `src/lib/email.ts` using the Resend REST API (no SDK dependency). `sendEmail()` no-ops if `RESEND_API_KEY` is unset.
- Use `renderEmail()` for the branded template; check `prefAllows(notifPrefs, key)` before sending.
- Client-side triggers are **fire-and-forget** (`fetch(...).catch(()=>{})`) — never block a user action on email.
- Email routes load data with the Admin SDK (bypass Firestore rules).

### Calendar / Availability
- `src/lib/availability.ts` generates booking slots from `schedules/{doctorId}`. Booking falls back to the legacy fixed list if no schedule is set.
- `/api/calendar/freebusy` **fails safe**: any error returns no conflicts so booking still works on platform availability.
- Reuse the Meet route's OAuth2 pattern for any new Google Calendar call.

### CSS / Styling
- Use `rgba()` for transparent colors — never hex-alpha string concatenation (`${accent}40` or `accent + "12"` are invalid)
- Design tokens: `--forest: #2A4A1A`, `--forest-mid: #3D6B24`, `--green: #8DC63F`, `--orange: #F7941D`, `--orange-dark: #C4700A`, `--leaf: #F2F8EA`, `--gray: #58595B`
- Brand colors match the Valeo logo: lime green (#8DC63F) = leaves, orange (#F7941D) = teardrop, gray (#58595B) = wordmark

### General Patterns
- Timer cleanup: `setTimeout` calls must use `useRef` with unmount cleanup
- Audit-then-rewrite: read full file → audit → rewrite complete file with all fixes applied
- Fix comprehensively per file — no partial patches that leave the file in a mixed state
- Environment-based config for all credentials — no hardcoded values in production paths

---

## Working Style (Benny's preferences)
- Always outline the plan and wait for approval before doing any work
- Provide full files — no partial snippets
- Flag any change that could affect other parts of the build
- Never remove or break existing features
- Present options with a clear recommendation when multiple valid approaches exist
- Budget-conscious solutions preferred
- Benny is the PM and sole decision-maker — he is not a developer
