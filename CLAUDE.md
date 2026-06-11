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
- **AI:** Gemini (Google Generative AI) — session summaries, SOAP notes
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
DOCTOR_EMAIL               # Dr. Miller's Google account for calendar events
GEMINI_API_KEY
```

Sandbox-to-live WiPay switch: change `WIPAY_ENVIRONMENT`, `WIPAY_ACCOUNT_NUMBER`, `WIPAY_API_KEY` only. No code changes needed.

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

### 🔴 Blocked / Outstanding
| Item | Notes |
|------|-------|
| WiPay end-to-end test | Blocked — awaiting resolution with WiPay support. Do not touch WiPay code until resolved. |
| Google Meet OAuth redirect URI | Hardcoded to `localhost:3000` in `/api/meet/create/route.ts` — must be updated to live domain before production testing |
| Real photos (Dr. Miller) | Hero, about, service tab images still placeholders |
| Social links in footer | Facebook, Instagram, YouTube still `#` |
| Homepage CTAs | All route to beta-gated `/register` — no path for real prospects. Awaiting Calendly URL. |
| OG meta tags | Missing — social sharing shows blank preview |
| Google Analytics | Not integrated |

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
