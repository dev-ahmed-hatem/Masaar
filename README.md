# Masaar

A Preply/Modarby-style **lesson-reservation marketplace** for Egypt & Saudi Arabia.
Students book individual live lesson slots with vetted teachers; lessons are delivered on
third-party video tools (Zoom / Meet / Teams / custom link). Payments are **manual** at launch
(bank transfer + receipt → moderator verification).

The full product specification is in **[`PROJECT_SPEC.md`](./PROJECT_SPEC.md)** (also published as
`index.html`).

## Repository layout

```
masaar/
  index.html            # Public spec site (served by Vercel from the repo root)
  PROJECT_SPEC.md        # Authoritative product spec
  api/                   # Backend — Django + Django REST Framework
  web/                   # Teacher portal + Moderator/Admin dashboard — Next.js
  # mobile/  -> Flutter student app (deferred to a later pass)
```

> The repo root is intentionally framework-less so the existing Vercel "Other" deployment keeps
> serving `index.html`. `web/` has its own `package.json` and is not built by the root project.

## Backend — `api/` (Django + DRF)

Python 3.10+. Uses SQLite by default in dev; PostgreSQL via `DATABASE_URL` in production.

```bash
cd api
python -m venv .venv
# Windows:  .venv\Scripts\activate      |  macOS/Linux:  source .venv/bin/activate
.venv/Scripts/python -m pip install -r requirements-dev.txt

cp .env.example .env                     # optional in dev (sane defaults exist)
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed      # markets, verticals, grades, subjects, sample prices
.venv/Scripts/python manage.py createsuperuser --phone +2010...   # prompts for password
.venv/Scripts/python manage.py runserver
```

- Health: `GET /api/health/`
- Admin: `/admin/`
- API docs (Swagger): `/api/schema/swagger-ui/`
- JWT auth: `POST /api/auth/token/` and `/api/auth/token/refresh/`

Settings are split under `config/settings/` (`base`, `dev`, `prod`). `manage.py` defaults to
`config.settings.dev`; `wsgi`/`asgi` default to `config.settings.prod`.

Domain apps live under `api/apps/`: `accounts` (phone-based custom user + roles + parent-monitor +
OTP scaffold), `markets`, `catalog` (verticals/grades/subjects + the `LessonCategory` pricing key),
`teachers`, `bookings`, `payments` (wallet ledger, receipts, packages), `payouts`, `reviews`,
`notifications`.

## Web — `web/` (Next.js 16)

Node 20+. App Router, TypeScript, Tailwind v4. Bilingual **Arabic (RTL) + English (LTR)** via a
dependency-free `[locale]` dictionary setup (`src/i18n/`).

```bash
cd web
npm install
cp .env.local.example .env.local         # NEXT_PUBLIC_API_URL -> the Django API
npm run dev                               # http://localhost:3000  (redirects to /en)
```

Routes: `/[locale]` (landing), `/[locale]/teacher`, `/[locale]/admin` — e.g. `/ar/teacher`.

## Deferred this pass

Mobile (Flutter) student app; real OTP/WhatsApp/push/email delivery; business-logic API endpoints
and booking state-machine enforcement; payment/receipt workflows; tests beyond smoke checks.
