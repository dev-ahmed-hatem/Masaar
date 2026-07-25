# Masaar — Engineering Roadmap

> The **product** is specified in [`PROJECT_SPEC.md`](./PROJECT_SPEC.md). This document is the
> **build plan**: the order we implement in and what "done" means for each step. Scaffold
> (monorepo, models, migrations, admin, web shell) is complete — see [`README.md`](./README.md).

## How we build

- **Vertical slices, not horizontal layers.** Each slice goes model → API → admin/web so the app
  is demoable at every step. We do *not* build "all endpoints" then "all UI".
- **API-first.** Every student/teacher/admin capability is a documented DRF endpoint (OpenAPI at
  `/api/schema/swagger-ui/`) before any UI consumes it.
- **Surfaces:** the **student** experience is the Flutter app (Track C, deferred) — until then
  student endpoints are exercised via API/tests/admin. The **teacher portal** and **admin
  dashboard** (web) get UIs as we go.

### Definition of Done (every slice)
- [ ] Endpoints documented in OpenAPI, role-scoped permissions enforced.
- [ ] Happy path + key error cases covered by pytest.
- [ ] Admin surfaces the data where a moderator needs it.
- [ ] AR + EN strings for any new web UI; RTL checked.
- [ ] `manage.py check`, migrations, `npm run build` all green.

### Conventions to lock in Slice 1 (then reused everywhere)
- Standard API error shape + DRF exception handler.
- Pagination + filtering defaults (page size, `django-filter`).
- Per-role permission classes (`IsStudent`, `IsTeacher`, `IsModerator`, `IsSuperAdmin`).
- Web: authed `apiFetch` with token storage/refresh; route guards per role.

---

## Slice 1 — Auth & identity  ⭐ (foundational)  — ✅ **complete**

**Goal:** phone + password auth with WhatsApp-OTP phone verification, JWT sessions, role-aware access.

> **Built as password-based, not passwordless.** Public signup creates a STUDENT with a password and
> issues a phone-verification OTP; login is phone + password (SimpleJWT). OTP is used for *verifying*
> the phone and for password reset — not as the primary login. Staff (moderator/superadmin) use the
> same phone + password flow (resolves the §16 open item). This supersedes the earlier
> passwordless "OTP request → JWT, create user on first login" sketch.

- **API** (under `/api/auth/`): `signup/` (create STUDENT + issue VERIFY OTP), `otp/verify/`
  (verify → issue JWT, flip `is_verified`), `otp/resend/`, `login/` (phone+password, blocks
  unverified), `token/refresh/`, `password/reset/` + `password/reset/confirm/`, `me/`. OTP codes
  hashed with TTL / resend-cooldown / attempt-lockout; delivery behind an `OTPSender` interface with
  a **console/mock sender** for dev (real WhatsApp Business API in Track D). Standard error envelope,
  scoped throttles, and per-role permission classes (`IsStudent/IsTeacher/IsModerator/IsSuperAdmin`)
  are in place — the conventions locked here.
- **Web:** phone+password sign-in/up, OTP verify, forgot/reset-password (antd forms); token storage +
  silent refresh; role-based redirect (teacher → `/teacher`, moderator/superadmin → `/admin`);
  client-side **route guards** on `/teacher` and `/admin`; role-gated header nav; logout.
- **Done:** a new phone signs up, verifies, and receives working JWTs; protected endpoints reject
  anonymous (covered by tests); roles route correctly and role-scoped routes are guarded in web.
  `manage.py check`, migrations, pytest (9 tests), and `npm run build` all green.

## Slice 2 — Catalog & teacher discovery  — ✅ **complete**

**Goal:** browse/search published teachers within a market.

- **API:** `/api/catalog/` read endpoints (`verticals/`, `grade-levels/?vertical=`, `subjects/`);
  `GET /api/teachers/` market-scoped, with filters (subject, grade, vertical, gender, language,
  min-rating, price range, weekday availability), ordering (rating / price / lessons) and
  pagination; `GET /api/teachers/<id>/` detail (bio, per-subject resolved prices, availability,
  reviews summary + recent reviews). Effective price resolves **approved override → category
  default** via a correlated subquery, so list filter/sort/pagination stay correct.
- **Conventions locked here** (deferred from Slice 1): `django-filter` as the default filter
  backend + `StandardPagination` (page/page_size, PAGE_SIZE=20).
- **Web (admin):** staff-guarded **Teacher browser** at `/admin/teachers` — market/subject/gender/
  rating/sort filters, paginated table, detail drawer (offerings + prices, availability, reviews).
  Linked from the admin dashboard. AR+EN, RTL.
- **Seed:** two published EG teachers (one with an approved price override) so the browser demos.
- **Done:** filtered search returns correct results scoped to market; detail resolves per-teacher
  price (override → default). 10 discovery tests; `check`, migrations, pytest (19), `npm run build` green.

## Slice 3 — Teacher onboarding & profile management

**Goal:** public application → moderator approval → published profile the teacher can manage.

- **API:** submit `TeacherApplication`; moderator list/review/approve/reject (creates the teacher
  `User` + `TeacherProfile` on approve); teacher self-serve profile, subjects, intro video,
  free-lesson count, custom price requests.
- **Web (admin):** teacher-approvals queue (review, approve/reject with notes).
- **Web (teacher):** profile editor, subjects, availability rules, intro-video URL (Vidstack preview).
- **Done when:** an application can be approved end-to-end and the new teacher logs in and edits
  their published profile.

## Slice 4 — Availability & booking lifecycle

**Goal:** request → confirm → complete, with wallet reserve/settle.

- **API:** teacher availability CRUD; slot listing; `POST /api/bookings` (request, validates
  balance, sets meeting provider/link, reserves wallet); teacher confirm/decline; student confirm
  completion + auto-complete job; cancellation (flexible-early/strict-late) + dispute → moderator.
  Enforce the `Booking.TRANSITIONS` state machine.
- **Web (teacher):** incoming requests, confirm/decline, attach meeting link, upcoming/past lessons.
- **Web (admin):** bookings view, dispute handling.
- **Done when:** a full lesson lifecycle runs, wallet moves reserved→captured on completion, and
  teacher wage is credited.

## Slice 5 — Manual payments & wallet  ⭐ (flagged priority)

**Goal:** the manual top-up/receipt → verify → ledger flow, plus packages.

- **API:** show per-market payment accounts; `POST /api/receipts` (upload image, amount, method,
  purpose); wallet balance + ledger; package catalog + purchase; moderator verify (approve →
  credit wallet / grant credits / confirm booking; reject with reason).
- **Web (admin):** **receipt-verification queue** (side-by-side receipt view, one-click
  approve/reject, reason) — the flagged UX.
- **Web (teacher):** earnings/wallet read views as relevant.
- **Done when:** a student receipt can be verified and correctly credits an append-only ledger;
  all three funding flows (top-up, per-booking, package) work.

## Slice 6 — Reviews
Post-completion student→teacher rating; recompute `rating_avg`/`rating_count`; surface on profile
and in discovery sort. Admin moderation/unpublish.

## Slice 7 — Payouts
Monthly `PayoutCycle` generation from settled lessons; per-teacher `PayoutItem` computation; admin
mark-paid with reference; teacher payout statements.

## Slice 8 — Notifications
Wire the `Notification` model to real channels (Track D): WhatsApp Business API, FCM/APNs push,
email — for OTP, booking status, receipt approved/rejected, reminders, payout done.

## Slice 9 — Mobile app (Track C, Flutter)
Kick off once auth + discovery + booking + payments APIs are stable: install Flutter SDK, scaffold
the student app (RTL/i18n), then build student flows against the existing API.

## Hardening & launch prep
i18n content pass, RTL QA, `/security-review`, seed/fixtures for staging, Postgres + deployment
config, legal/entity + payment-account data (open items in `PROJECT_SPEC.md` §16).

---

## Cross-cutting tracks
- **Track A — API** (Slices 1–8) · **Track B — Web** (teacher + admin) · **Track C — Mobile**
  (Flutter, later) · **Track D — Integrations** (WhatsApp/push/email, pulled in per slice).

## Indicative sequencing (aggressive ~2–3 months)
1. **Weeks 1–2:** Slice 1 (auth) + conventions. 2. **Weeks 3–4:** Slices 2–3 (discovery,
onboarding). 3. **Weeks 5–7:** Slices 4–5 (booking, payments — the core loop). 4. **Weeks 8–9:**
Slices 6–7 (reviews, payouts) + Slice 8 (notifications) in parallel. 5. **Weeks 8–12:** Track C
(mobile) once core APIs settle. 6. **Ongoing:** hardening.

> Sequencing is indicative; auth (1) and the booking+payments core (4–5) are the critical path and
> should not be parallelized away.

## Open items blocking specific slices (from `PROJECT_SPEC.md` §16)
- ~~Slice 1: admin login method (OTP vs email+password for staff).~~ **Resolved:** staff use the
  same phone + password flow as everyone else.
- Slice 4: cancellation cutoff + auto-complete window values.
- Slice 5: real payment-account details per market; package definitions; price-override approval rules.
