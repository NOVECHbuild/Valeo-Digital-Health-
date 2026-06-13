# Valeo Experience — Functional & Security Audit

Code-level audit of all routes, links/buttons, and data-protection posture.
Severity: **⛔ P0 (fix before real client data)** · **🔴 P1 (high)** · **🟡 P2 (medium)** · **✅ OK**

---

## Part 1 — Functional (links / buttons / routing)

Cross-checked every internal link & `router.push` target against the real route list.

### Fixed in this pass ✅
| Was | Problem | Fix |
|-----|---------|-----|
| Onboarding consent → `/privacy` | Route doesn't exist (it's `/legal/privacy`) → 404 | Pointed to `/legal/privacy` |
| Payment **success** → `/client/dashboard` | No such route (it's `/client`) → 404 | Pointed to `/client` |
| Payment **failed** → `/client/dashboard` | No such route → 404 | Pointed to `/client` |
| Admin Users → "Manual Payment" → `/admin/payments/manual` | Route doesn't exist → 404 | Pointed to `/admin/financials` (where manual payments live) |

### Otherwise healthy ✅
- All sidebar nav (admin/doctor/client), dashboard quick-actions, legal-page links, auth links, onboarding/payment redirects resolve to real routes.
- No remaining `href="#"` dead links; footer social links are real URLs.
- Active-state + page titles fixed earlier across all three consoles.

### Minor 🟡
- `/api/admin/reset-password` generates a reset link but **doesn't email it** (returns it instead). Functional gap *and* a security issue — see P0 below.

---

## Part 2 — Security

### ⛔ P0 — Unauthenticated privileged API routes (CRITICAL)
Only **2 of 17** API routes verify the caller. These privileged routes accept
**anonymous POSTs from anyone on the internet**:

| Route | Risk |
|-------|------|
| `/api/set-role` | **Privilege escalation** — anyone can set any uid's role to `admin`. |
| `/api/admin/create-user` | Anyone can create accounts (any role). |
| `/api/admin/create-doctor` | Anyone can mint a doctor account. |
| `/api/admin/reset-password` | **Account takeover** — request a reset link for *any* email; the link is returned in the response. |

**Impact:** an attacker could make themselves an admin and read all client clinical data.
**This must be fixed before storing real client data.**
**Fix:** verify a Firebase ID token on each route and require `role == 'admin'` (a shared
`requireAdmin(req)` helper); the admin UI passes the caller's ID token. ~Half a day.

### 🔴 P1 — Client PII enumerable
`users` Firestore rule allows `list` for **any signed-in user**, so a logged-in *client*
can query the whole `users` collection and read every other client's name, email, and phone.
Only doctors/admins actually need this (verified: no client page lists users after the
multi-doctor refactor).
**Fix:** change `users` rule `allow list: if isAuth()` → `if isDoctorOrAdmin()`. Safe, ~1 line.

### 🔴 P1 — Other unauthenticated API routes
`/api/email/appointment`, `/api/email/assessment`, `/api/ai/session-summary`,
`/api/meet/create`, `/api/calendar/freebusy`, `/api/payments/initiate` accept anonymous
POSTs. Risks: email spam to clients/doctor, Gemini-quota/cost abuse, calendar-event
creation, busy-time leakage, spurious payment records.
**Fix:** verify the caller's ID token + an ownership/role check (e.g., the caller is a
participant on the appointment). Do after P0.

### 🟡 P2 — Lower-risk items
- **OAuth refresh tokens** stored unencrypted in `googleTokens` (server-only rule mitigates; encryption-at-rest is a hardening).
- **Email templates** inject user-supplied names/titles into HTML strings without escaping → low HTML/email-injection risk. Escape interpolated values.
- **No rate limiting** on public API routes (brute-force / abuse). Consider Vercel/edge rate limits.
- **WiPay callbacks** should validate the MD5 signature before trusting them (frozen — verify when WiPay reopens).
- **Storage**: `resources/` is publicly readable (fine for general worksheets; do **not** put PHI there).

### ✅ Passing
- **No hardcoded secrets** — all keys are env vars.
- **Firestore default-deny** + role/ownership scoping on the sensitive collections (notes, appointments, messages, payments, intakes, assessments) is solid.
- **Conversation messages** scoped to participants; **googleTokens** locked to server-only.
- HTTPS enforced (Vercel); Firebase Auth; password reset flow exists.

---

## Recommended fix order
1. **P0** — authenticate the 4 privileged admin routes (blocks launch with real data).
2. **P1** — tighten `users` list to doctor/admin (closes client PII enumeration).
3. **P1** — authenticate the remaining API routes (email/ai/meet/calendar/payments).
4. **P2** — token encryption, template escaping, rate limiting, WiPay signature, as hardening.

> Note: the Resend API key shared in chat during setup should be **rotated** in Resend.
