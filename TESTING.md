# Valeo Digital Health — Deploy & Test Plan

Covers the full batch built this session: P1 fixes, all four P2 features, multi-doctor
(client side), per-doctor pricing, per-doctor Google Calendar, email notifications,
the unread-badge fix, the sidebar fix, security rules, and the NUL-byte build guard.

---

## A. Deploy sequence

1. **Build locally** (this also runs the NUL-byte guard):
   `npm run build`
   - Watch the `[clean-nul]` line. "no NUL corruption found" = good.
   - Build must end with no type errors.
2. **Push to git** → Vercel auto-deploys the code + `vercel.json` (reminder cron).
3. **Deploy Firestore rules** (this batch changed them — added `googleTokens` server-only + `resources`):
   `firebase deploy --only firestore:rules`
   - If it asks about deleting indexes, answer **No**.
4. **Hard-refresh** the live site (Ctrl+Shift+R) to clear cached chunks.

> Env reminders: `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `CRON_SECRET`, and the
> `GOOGLE_*` vars must be set in Vercel. `EMAIL_FROM` should use `@valeoexperience.com`.

---

## B. Smoke test (do first)

- [ ] Log in as **client**, **doctor**, and **admin** — each dashboard loads, no console errors.
- [ ] Admin console not locked out (confirms your `users/{uid}.role == "admin"`).
- [ ] All sidebars show every nav item, no horizontal scrollbar (admin/doctor/client).

## C. Multi-doctor booking + pricing

- [ ] As a **matched** client, open Appointments → Book Session → the flow opens.
- [ ] Booking shows **your assigned doctor's name** (not "Dr. Miller" hardcoded) throughout.
- [ ] Session prices shown match that **doctor's** `sessionPricing` (set in Doctor → Schedule → Pricing).
- [ ] As an **unmatched** client, the "Get matched" notice shows and Book routes to `/onboarding/match`.
- [ ] Complete a paid booking → the WiPay amount equals the doctor's price (not the old $400/$600).
- [ ] Free Consultation (price 0) books directly without payment.
- [ ] The pay page shows the correct amount (not a flat $150).

## C2. Doctor-defined services

- [ ] Doctor → Schedule → **Services** tab shows the 5 seeded services on first open (with any prices you'd set).
- [ ] **Add** a new service (name, duration, price, description) → **Save Availability** → it persists on reload.
- [ ] **Edit** a service's price/duration/name → Save → the change shows in client booking.
- [ ] Toggle a service **inactive** → Save → it disappears from client booking.
- [ ] **Delete** a service → Save → gone from booking.
- [ ] A service priced **0** books free (no payment); a priced one charges that exact amount at WiPay.
- [ ] The Notes editor "Session Type" dropdown lists this doctor's services.
- [ ] A second doctor with a *different* service list shows their own services to their clients (not doctor 1's).

## D. Per-doctor Google Calendar

- [ ] Doctor → Schedule → **📅 Google Cal** → **Connect Google Calendar** → Google consent (use a **test-user** Google account) → returns to a **Connected** state.
- [ ] "Check connection" reports connected with the right account.
- [ ] Put a busy event on that doctor's Google Calendar → as their client, that time slot is greyed in booking.
- [ ] **Disconnect case:** a doctor who hasn't connected still books fine (falls back to platform availability — nothing breaks).
- [ ] **Approve** a pending session → a Google Meet link is created **on that doctor's calendar** and saved to the appointment (client sees "Join Google Meet").

## E. Email notifications (needs Resend live + domain verified)

- [ ] **Book** → client gets "Request received"; the **assigned doctor** gets "New session request" (correct inbox + name).
- [ ] **Approve** → client gets "Session confirmed" (with Meet link), naming the correct doctor.
- [ ] **Cancel** (client) → that appointment's doctor is notified. **Reject** (doctor) → client is notified.
- [ ] **Assign an assessment** → client gets the email, naming the assigning doctor.
- [ ] Check **Resend → Logs** for delivery/errors.
- [ ] Toggle a notification pref off in settings → that email type stops.

## F. Notes ↔ appointments + AI SOAP

- [ ] Doctor → Notes → New Note → "Link to Session" lists the client's appointments; linking auto-fills date/type.
- [ ] Note card shows the "Linked session" chip.
- [ ] On an approved/completed appointment card (Schedule), "Add session note" deep-links to a pre-linked note; flips to "View session note" once saved.
- [ ] "Generate with AI" (paste transcript or upload audio) fills SOAP, suggests tags; risk transcript → Crisis/Concern tags.
- [ ] Plain note create/edit/delete still works.

## G. Resources library

- [ ] Doctor/Admin → Resources → add a Book / Watch / Read item → it appears on the **client** Resources page under the right tab, with a working "Open/Watch/Read" link.
- [ ] Client Resources copy is generalized (no "Dr. Miller").

## H. Announcements, platform settings, unread badges

- [ ] Admin announcement to Clients/Doctors/Everyone shows on the right dashboards; dismiss persists.
- [ ] Admin → Platform Settings save + persist on reload.
- [ ] Send a chat message → the recipient's **unread badge** increments (sidebar + dashboard); opening the chat clears it.

## I. Security rules (Rules Playground)

- [ ] Client reading another client's notes/appointments → **denied**.
- [ ] Client reading a conversation they're not part of → **denied**; a participant → **allowed**.
- [ ] Any client read of `googleTokens` → **denied**.
- [ ] Announcements + resources readable by client and doctor.

---

## Known follow-ups (not in this batch)

- Messages "start a **new** conversation" still picks the first doctor (should use `useAssignedDoctor`) — P3.
- Footer social links still `#`; Google Analytics not integrated.
- Resource **file uploads** (Firebase Storage) — currently link-only.
- Homepage CTAs point at Calendly / beta-gated register — no native path for real prospects yet.
- WiPay end-to-end test — blocked pending WiPay support.
- Google OAuth **verification** before public launch (app is in Testing mode, 100-user cap).
