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

## Slice 3 — Teacher onboarding & profile management  — ✅ **complete**

**Goal:** public application → moderator approval → published profile the teacher can manage.

- **Onboarding & approval API:** `POST /api/teacher-applications/` (public submit; phone normalized
  with market dial code; blocks a duplicate open application). Moderator (`IsStaff`) queue: list
  (`?status=`), detail, `…/approve/`, `…/reject/`. **Approve** creates the teacher `User` (role
  TEACHER, verified, random **temporary password** WhatsApp'd via `ACCOUNT_MESSAGE_SENDER`,
  `must_change_password=True`) + a **draft** `TeacherProfile`, links `created_profile`. Credential
  handoff: teacher signs in with the temp password, then `POST /api/auth/password/change/` clears
  `must_change_password` (surfaced on the user payload).
- **Teacher self-serve API** (`/api/teacher/`, `IsTeacher`, own record only): `GET/PATCH profile/`
  (name/gender/languages/bios/intro-video/free-lessons), `POST profile/publish|unpublish/`
  (publish validates ≥1 subject + a bio → 400 `profile_incomplete` with `missing[]`),
  `lesson-categories/` (market-scoped picker), `subjects/` (+`<id>/` delete), `availability/`
  (+`<id>/`), `prices/` (custom-price **requests** — `is_approved=False`, moderator approval is
  Slice 5). Subject prices resolve override→default.
- **Web (admin):** approvals queue at `/admin/applications` (status filter, table, drawer,
  approve/reject with notes), linked from the dashboard.
- **Web (teacher):** profile editor at `/teacher/profile` — profile form + YouTube intro-video
  preview, subjects add/remove, weekly availability, custom-price requests, and a publish/unpublish
  toggle surfacing what's missing. Linked from the teacher portal. AR+EN, RTL.
- **Done:** application approved end-to-end and the new teacher logs in and edits + publishes their
  profile (✅ live-verified). 19 Slice-3 tests (38 total); `check`, migrations, `npm run build` green.
  *(Intro video is a plain YouTube embed for now; Vidstack player is a later polish.)*

## Slice 4 — Availability & booking lifecycle  — ✅ **complete**

**Goal:** request → confirm → complete, with wallet reserve/settle.

- **Wallet (done):** `apps/payments/services.py` — `reserve/refund/capture/credit` over the
  append-only `LedgerEntry`; `available_minor` is the spendable balance and `balance_after_minor`
  is authoritative. `GET /api/wallet/` (student balance + recent ledger).
- **Booking API (done):** `GET /api/bookings/slots/?teacher=` (concrete slots generated from
  recurring `AvailabilityRule` in the market TZ, past/overlap excluded); `POST /api/bookings/`
  (validates market/teaches/availability/overlap, resolves override→default price, **reserves
  wallet**); teacher `confirm/` (+meeting provider/link) & `decline/` (refund); student `complete/`
  (**capture** + credit teacher lesson); `cancel/` (24h cutoff: free refund early, forfeit/capture
  late; teacher-cancel always refunds); `dispute/` → moderator `resolve/` (complete=capture /
  cancel=refund); teacher `no-show/`. `Booking.TRANSITIONS` enforced via `can_transition`. Trials
  (free-lesson offer) book at price 0 with no reserve, once per teacher. Policy values are settings
  (`BOOKING_CANCEL_CUTOFF_HOURS=24`, `BOOKING_AUTOCOMPLETE_HOURS=24`).
- **Auto-complete job (done):** `manage.py autocomplete_bookings` (service `autocomplete_due`)
  settles CONFIRMED lessons `BOOKING_AUTOCOMPLETE_HOURS` after they end — run via cron in prod.
- **Web (teacher, done):** `/teacher/lessons` — Requests / Upcoming / Past tabs; confirm (meeting
  provider + link modal), decline, cancel, no-show, join link.
- **Web (admin, done):** `/admin/bookings` — status filter, table, detail drawer, dispute
  resolution (complete = capture / refund). Both linked from their dashboards. AR+EN, RTL.
- **Done:** full lesson lifecycle runs, wallet moves reserved→captured on completion, teacher wage
  credited. *(✅ live-verified end-to-end + role-scoped lists; 16 booking tests, 54 total; student
  booking UI is mobile/Track C; teacher payout crediting is Slice 7.)*

## Slice 5 — Manual payments & wallet  ⭐ (flagged priority)  — ✅ **complete**

**Goal:** the manual top-up/receipt → verify → ledger flow, plus packages.

- **Top-up + verification (done):** `GET /api/payment-accounts/` (student's market); `POST
  /api/receipts/` (student, multipart: amount/method/reference/image, `purpose=TOPUP`); `GET
  /api/receipts/` (student sees own, `IsStaff` sees the queue, `?status=`); `…/approve/` →
  `credit()` wallet (ledger `TOPUP`) + reviewed_by; `…/reject/` with reason. Wallet balance/ledger
  at `GET /api/wallet/`. Decision: **package credits = wallet money** (one currency).
- **Web (admin, done):** the flagged **receipt-verification queue** at `/admin/receipts` —
  status filter, **side-by-side receipt image**, one-click approve (credits wallet) / reject with
  reason. Linked from the dashboard. AR+EN, RTL.
- **Student side:** API-only for now (top-up UI is mobile/Track C).
- **Pay-per-booking + packages (done):** `POST /api/receipts/` accepts `purpose=BOOKING` (optional
  booking link) — credits the wallet on approve like a top-up. `GET /api/packages/` (market-scoped);
  `POST /api/packages/<id>/purchase/` (multipart) creates a `PackagePurchase` + its PACKAGE receipt;
  approving that receipt **grants wallet money** (ledger `PACKAGE_GRANT`) and marks the purchase
  `GRANTED`; reject marks it `REJECTED`. `GET /api/package-purchases/`. The pass-1 verification queue
  handles all three purposes unchanged. *(Packages grant at face value; discount structure is a §16
  open item.)*
- **Done:** a student receipt can be verified and correctly credits the append-only ledger; all
  three funding flows (top-up, per-booking, package) work. *(✅ live-verified: top-up `TOPUP` +100,
  package purchase → `PACKAGE_GRANT` +300, purchase GRANTED. 12 payment tests, 66 total.)*

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
