# MuSo Ops Command Center

Internal ops orchestration for Museum of Solutions (MuSo), Mumbai — one booking record
auto-generates the Daily Memo, Floor Plans, Movement Plans and Department Briefs, with
DB-level clash prevention and full change history.

**Live infrastructure:** Supabase project `muso-ops` (`bxbasutnjncwvevyeipn`, Mumbai / ap-south-1)
is already provisioned with schema, RLS policies and seed data (staff, resources, vendors, and
the 2nd/4th July 2026 reference bookings).

## Repo layout

```
apps/web              Next.js 14 (App Router) web app
packages/db           SQL migrations + seed (already applied to the live project)
packages/logic        Movement-plan generator, clash helpers, time & WhatsApp formatting (+ tests)
packages/ai           Gemini 2.0 Flash wrapper (cache, budget cap, call log) + prompt templates
packages/pdf          React-PDF templates: School FP, Birthday FP, Event FP, Daily Memo, Dept Brief (+ render tests)
reference-files       Original Excel/CSV ground truth — do not deploy
docs/DECISIONS.md     Decision points, schema deviations, field-gap analysis
```

## Run locally

```bash
npm install
cp .env.example apps/web/.env.local   # anon key is already filled in .env.example
npm run dev                            # http://localhost:3000
npm test                               # logic + pdf test suites
```

## Deploy to Vercel (free tier)

1. Import this GitHub repo in Vercel; set **Root Directory = `apps/web`**.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (values in `.env.example`), plus `GEMINI_API_KEY` (free key from
   https://aistudio.google.com/apikey) and `AI_DAILY_BUDGET_CALLS=500`.
3. Deploy. Sign up with your email — then promote yourself to admin once (SQL editor):
   `update staff set role='admin' where email='you@example.com';`
   After that, all role management happens in the app's Staff page.

## Google / Outlook sign-in (optional, buttons already wired)

Supabase Dashboard → Authentication → Providers:
- **Google:** create an OAuth client in Google Cloud Console, paste client ID/secret.
- **Azure (Outlook):** register an app in Microsoft Entra, paste client ID/secret.
Email/password works out of the box with no extra setup. SMS OTP is not free in India, so it is
not enabled (notifications are in-app + PDF + "Copy as WhatsApp message" by design).

## Extending templates without code

Settings → **Custom template fields**: add a field (text / number / time / select / …) scoped to
any booking type. It appears on the booking form and in that type's Floor Plan PDF immediately.

## Roles

`admin` (everything) · `ops_poc`/`sales` (full CRUD) · `floor_lead` (read all, write assigned) ·
`department_head` (sees only their department's asks) · `viewer` (read-only; default on signup).
