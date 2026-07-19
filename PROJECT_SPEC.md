# Masaar — Tutoring Reservation Marketplace · Product Spec (v1)

**Date:** 2026-07-20
**Status:** Agreed via stakeholder interview. This document supersedes `feasibility-study-questionnaire.md`, which described a different product (course-subscription LMS) and is **no longer in scope**.
**Model in one line:** A Preply/Modarby-style marketplace where students book individual **live lesson slots** with vetted individual teachers; lessons are delivered on 3rd-party video tools; payments are **manual** (bank transfer + receipt) at launch.

---

## 1. Vision & scope

- Students browse approved teachers, **request** a lesson slot, the teacher **confirms**, and the live lesson happens on an external tool (Zoom / Google Meet / Teams / custom link).
- Teachers are **individual profiles** (no academies/multi-tenant). They **apply publicly**, and **moderators review/interview/approve** them.
- **No recorded course library, no LMS, no content DRM** at launch. The only teacher media is a short **intro video** hosted on YouTube and played via **Vidstack** in the teacher web/profile.
- Two launch markets — **Egypt** and **Saudi Arabia** — run as **parallel, mostly-siloed markets** on one platform (separate teacher pools, currencies, price sheets, and payment accounts).

### Non-goals at launch
- Payment gateways (manual only for the first ~2 months).
- Recorded courses / quizzes / assignments / gradebook.
- Academies / co-teachers / teaching assistants.
- VAT / formal tax e-invoicing.
- In-platform video calling (we integrate links only).

---

## 2. Markets & localization

- **Markets:** Egypt (EGP) and Saudi Arabia (SAR). `Market` is a **first-class entity**; teachers, students, prices, payment accounts, and payouts are all scoped to a market.
- **Per-market teachers & currency:** Egyptian teachers serve Egyptian students, paid in EGP; Saudi teachers serve Saudi students, paid in SAR. No cross-market booking at launch.
- **Locales:** Arabic (RTL) + English (LTR) — **full RTL layout**, not just translated strings, across mobile app, teacher portal, and admin.
- **Time zones:** store all timestamps in UTC; display in the user's local zone. Egypt = UTC+2 (observes DST → UTC+3 in summer); Saudi = UTC+3 (no DST). Slot/availability logic must be timezone-correct.
- **Money:** store as integer minor units + ISO currency code. Never mix currencies in one ledger.

---

## 3. Roles & accounts

| Role | Surface | Notes |
|---|---|---|
| **Student** | Mobile app (iOS+Android) | Primary user. Has a **parent-monitor** capability (a guardian can observe the student's activity/bookings). Minors keep their own account. |
| **Teacher** | Web portal | Applies publicly; approved by moderators. Manages profile, intro video, availability, prices (within rules), lessons, earnings. |
| **Moderator** | Admin web | Scoped permissions: teacher approvals, receipt/payment verification, disputes, support. |
| **Super-admin** | Admin web | Full access: pricing, payout runs, role management, config. |

- **RBAC** with role-based scoping + **audit log** on all moderator/admin actions.
- **Parent-monitor:** the student account can be linked to a guardian who receives visibility (view bookings/progress/notifications). Not a separate paying login at launch.

---

## 4. Auth

- **Phone number + OTP**, delivered via **WhatsApp only** (no SMS at launch).
- Applies to students primarily; teacher/moderator web login also phone+WhatsApp OTP. *(Open item: confirm whether internal staff prefer an email+password fallback for the admin panel — see §16.)*
- Session/device management; rate-limit OTP requests.

---

## 5. Catalog / taxonomy

Three **verticals**, each with its own level taxonomy:
- **Primary** — KG → Grade 12 (grade level required).
- **University** — year/level + major/faculty.
- **Higher Education** — BSc / Master / PhD / etc.

Dimensions used for both **teacher profiles** and **search filters**: `market → vertical → grade/level → subject → language of instruction → teacher gender`.

---

## 6. Teacher onboarding

1. **Public application** form (bio, subjects/verticals/grades, qualifications, documents, requested wage/price, intro video URL).
2. **Moderator review** (+ optional interview) → approve / reject / request changes.
3. On approval, teacher profile is **published** and the teacher can set:
   - Availability calendar (slots).
   - **Intro video** (YouTube URL → rendered via **Vidstack**).
   - **Free-lesson allowance** (number of free trial lessons they offer).
   - **Custom price** per lesson category (subject to platform pricing rules — see §9).

---

## 7. Discovery & search (student app)

- Browse/search teachers **within the student's market**.
- Filters: **subject + grade/level**, **price**, **rating**, **availability/time**, **teacher gender**, **language of instruction**.
- Teacher profile shows: bio, intro video, subjects/levels, rating & reviews, price, free-lesson offer, availability.

---

## 8. Booking & lesson lifecycle

1. **Request → confirm:** student picks a slot and requests; **teacher must confirm** (or decline). In-app **chat unlocks after the booking exists** (to coordinate + share the meeting link).
2. **Delivery:** lesson happens on an external tool — **Zoom / Google Meet / Microsoft Teams / custom meeting link**. The chosen tool + link is attached to the booking.
3. **Money reservation:** on confirmation, the lesson price is **reserved** from the student's wallet (must have sufficient available balance to book).
4. **Completion:** **student confirms** the lesson happened; if they don't act within a configurable window, it **auto-completes**. Either party can **dispute → moderator** resolves.
5. **Settlement:** on completion, the reserved amount is **captured**; the **teacher's wage is credited** to their earnings; platform keeps the commission.
6. **Cancellation / no-show:** **flexible early, strict late** — free cancel/reschedule up to a configurable cutoff (e.g. 12–24h before); after the cutoff, student cancel/no-show forfeits (charged), teacher no-show refunds the student and may incur a penalty. Trial (free) lessons follow the same scheduling rules with zero charge.

---

## 9. Pricing & commission

- Platform defines a **price per lesson category** keyed by `market + vertical + grade + subject` (e.g. *EG · Primary · Grade 4 · Math = 60 EGP*), each with an associated **fixed teacher wage** (e.g. 35 EGP → platform margin 25 EGP).
- Teachers may have a **per-teacher price override** (higher price justified by rating/reviews/volume), configured/approved through admin rules.
- **Commission** = student price − teacher wage. Revenue also flows through **packages/credits** and **wallet** balances.
- **Trial lessons:** each teacher configures a number of **free lessons**; these cost the student 0 and pay the teacher 0 (policy-configurable).

---

## 10. Payments — manual (launch model)

No gateways at launch. Students pay by **bank/wallet transfer to platform accounts** and **submit a receipt**; moderators verify.

**Three funding flows (all supported):**
1. **Wallet top-up** — student transfers any amount → uploads receipt → moderator verifies → **wallet credited**. Bookings draw from wallet. *(Fewest verifications; recommended default UX.)*
2. **Pay-per-booking** — student transfers the exact lesson/package cost at booking → uploads receipt → moderator verifies → booking confirmed.
3. **Packages / credits** — student buys a predefined bundle → transfers full amount → uploads receipt → moderator verifies → credits granted.

**Receipt UX (must be well-designed — key flagged requirement):**
- Show the correct **platform payment accounts for the student's market** (bank + wallet options, copy-to-clipboard, amount, reference).
- Upload receipt image/PDF; attach amount + method + reference.
- Clear **status tracking**: `pending → approved / rejected (with reason)`, with notifications at each step.
- Moderator **verification queue** in admin with side-by-side receipt view and one-click approve/reject.

**Wallet ledger:** track **available** vs **reserved** balance; ledger entries for top-up, reservation, capture (settlement), refund, package grant, adjustment. Design as append-only/double-entry-style for auditability.

---

## 11. Payouts (teachers)

- **Scheduled batch** (e.g. monthly). Platform accrues each teacher's earned wage from settled lessons.
- Admin runs a **payout cycle**: computes amounts per teacher, transfers **manually** in local currency, and **marks lessons/period as paid**.
- Teacher sees an **earnings dashboard** + payout statements (settled, pending, paid).

---

## 12. Reviews & ratings

- After a **completed** lesson, students leave a **public** rating (1–5) + text review on the teacher.
- Aggregate rating shown on profile and usable in search sort/filter and pricing-override justification.

---

## 13. Messaging

- In-app **chat unlocks after a booking** exists between that student and teacher (coordination + meeting link).
- No pre-booking chat at launch. *(Consider light content filtering later to reduce off-platform leakage.)*

---

## 14. Notifications

Channels at launch: **Push** (FCM/APNs via Flutter), **WhatsApp** (Business API), **Email**. (No SMS.)

Key events: OTP; booking requested / confirmed / declined; lesson reminders; completion prompt; dispute updates; **receipt approved/rejected**; wallet credited; package granted; payout completed; review request.

---

## 15. Tech stack & architecture

- **Mobile (student):** **Flutter** (iOS + Android), full RTL/i18n.
- **Backend/API:** **Django + Django REST Framework** (modular monolith).
- **Teacher portal + Moderator/admin dashboard:** **Next.js (React)**, RTL-aware.
- **Database:** **PostgreSQL** (production), **SQLite** (local dev).
- **Media:** teacher intro video = YouTube + **Vidstack** player (web).
- **Integrations:** WhatsApp Business API (OTP + notifications), FCM/APNs (push), email provider.
- **Auth:** phone + WhatsApp OTP (JWT/session).
- Recommended supporting pieces (to confirm): Redis (cache + background jobs/queues), object storage for receipt uploads.

---

## 16. Open items / assumptions to confirm

1. **Admin login method** — is phone+WhatsApp OTP acceptable for internal staff, or add email+password for the admin panel?
2. **Payment accounts** — how many bank/wallet accounts per market to display, and their details.
3. **Cancellation cutoff & completion-window** exact hours (defaults proposed: 24h cutoff, 24h auto-complete).
4. **Free-trial abuse controls** — cap free lessons per student across teachers? per teacher?
5. **Package definitions** — who defines packages (platform vs per-teacher) and discount structure.
6. **Teacher price-override rules** — thresholds/approval flow for a teacher raising price above the category default.
7. **Legal/entity & data residency** for Egypt + Saudi (not a build blocker for MVP but a launch gate) — confirmed out of scope for now?
8. **Guardian/parent-monitor** — exact visibility scope and how the link is established.

---

## 17. Timeline note (aggressive ~2–3 months)

The agreed MVP spans a Flutter app **+** a Next.js teacher portal **+** a Next.js admin dashboard **+** a Django API, with wallet/ledger, manual-payment verification, bilingual RTL, two markets, and three notification channels. That is a **large MVP for 2–3 months**. Two viable paths:
- **Path A (recommended):** phase the surfaces — ship **student app + admin (with manual payments, booking, wallet)** first; teacher portal can start minimal (availability + confirm + earnings) and expand as a fast-follow.
- **Path B:** trim scope within each surface (e.g. wallet-only funding at first; add pay-per-booking/packages next) to hit the date.

*A concrete phased backlog and architecture/data-model doc are the recommended next deliverables.*
