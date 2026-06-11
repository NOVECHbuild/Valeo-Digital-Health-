# Valeo Digital Health — Testing Checklist

Covers everything changed in this session: admin nav fix, sidebar layout fix,
AI SOAP notes, announcement banners, platform settings, repaired files, and the
Firestore security rules. Tick each box as you confirm it.

> Redeploy note: the code changes go live when you push to git (Vercel auto-deploys).
> The Firestore rules go live separately via `firebase deploy --only firestore:rules`.
> After deploying, hard-refresh the browser (Ctrl+Shift+R) to clear cached chunks.

---

## 1. Sidebar layout (new fix — all three consoles)

- [ ] **Admin** sidebar shows ALL items: Overview, Users, Assignments, Financials, Analytics, Settings, Announcements.
- [ ] No stray **horizontal scrollbar** inside the admin sidebar.
- [ ] **Doctor** sidebar shows all items (Dashboard → Settings), no horizontal scrollbar.
- [ ] **Client** sidebar shows all items (Dashboard → Settings), no horizontal scrollbar.
- [ ] Shrink the browser window short — the nav scrolls vertically *inside* the sidebar (logo + sign-out stay put).

## 2. Admin console

- [ ] **Sub-route highlight:** open Users → click into a single user (`/admin/users/[uid]`) and the Add Doctor page. "Users" stays highlighted in the sidebar.
- [ ] **Header title** matches the section name on those sub-pages (not "Admin Console").
- [ ] Each top-level nav item highlights correctly when active.
- [ ] **Platform Settings:** change default price, fee %, currency; toggle Maintenance + Beta → Save → success toast.
- [ ] Reload the Settings page → values persist.
- [ ] Open Settings in a second browser/incognito (as admin) → same saved values load.

## 3. Doctor console — AI SOAP notes

- [ ] **New Note → "Generate with AI" → Paste transcript:** paste a few dialogue lines → Generate → SOAP text appends into the note body.
- [ ] Tags get suggested and the title auto-fills if it was blank.
- [ ] **Upload audio tab:** pick a short MP3/M4A → Generate → transcribed + summarized into the note.
- [ ] **Risk handling:** paste a transcript mentioning self-harm → confirm Crisis/Concern tags + a risk line appear.
- [ ] **AI output is editable** before saving, and saving stores it as a normal note.
- [ ] **Regression:** create / edit / delete a note WITHOUT AI — basic flow unchanged.

## 4. Announcements (admin → client/doctor)

- [ ] In Admin → Announcements, create one targeted to **Clients**, one to **Doctors**, one to **Everyone**.
- [ ] **Client dashboard** shows the "Clients" + "Everyone" banners, NOT the "Doctors" one.
- [ ] **Doctor dashboard** shows the "Doctors" + "Everyone" banners, NOT the "Clients" one.
- [ ] Banner styling matches type (info / warning / maintenance).
- [ ] **Dismiss (X):** banner disappears and stays gone after reload (per-browser).

## 5. Repaired files (were NUL-byte corrupted)

- [ ] **Homepage** (`/`) loads fully and looks normal.
- [ ] **Client → Profile** page loads and saves.
- [ ] **Client → Settings** page loads and saves.
- [ ] Legal pages and Login still render.

## 6. Firestore security rules (AFTER `firebase deploy --only firestore:rules`)

- [ ] **Admin not locked out** — you can still load the admin console (confirms your `users/{uid}` doc has `role: "admin"`).
- [ ] **Chat works** — send and receive messages as a doctor AND as a client in a real conversation.
- [ ] **Chat privacy (the fix):** in the Firebase Console → Rules **Playground**, simulate a client reading a `conversations/{id}/messages` doc for a conversation they are NOT part of → should **DENY**. A participant → **ALLOW**.
- [ ] **Announcements** still load for client and doctor (rules unchanged there).
- [ ] **Platform Settings** still save as admin.
- [ ] Client cannot read another client's appointments / notes (notes should be fully blocked for clients).

## 7. Production smoke test (after Vercel deploy)

- [ ] **AI Assist** works on the live site (needs the live `GEMINI_API_KEY`).
- [ ] Announcement banner works end-to-end on the live domain.
- [ ] Quick login as each role (client / doctor / admin) and load each dashboard.

---

### Known follow-ups (not part of this round)

- **Unread-message badges** read a top-level `messages` collection that the chat code doesn't write to — counts stay at 0. Code fix tracked separately.
- WiPay end-to-end test still blocked pending WiPay support.
