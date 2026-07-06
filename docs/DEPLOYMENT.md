# Running & Deploying MuSo Ops Command Center

The code lives on GitHub; the running website lives on **Vercel** (free tier).
GitHub Pages cannot host this app — it only serves static files, and this system
needs a live server for login sessions, database access, the clash APIs and PDF
generation. Vercel auto-deploys every push to `main`, so GitHub stays the single
source of truth and publishing is automatic.

The database (Supabase project `muso-ops`, Mumbai) is already provisioned,
migrated and seeded — nothing to set up there.

---

## A. Run locally (5 minutes)

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/glowstonesq1/MuSo_Operations.git
cd MuSo_Operations
npm install

# create apps/web/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=https://bxbasutnjncwvevyeipn.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from .env.example>
#   GEMINI_API_KEY=<optional, from https://aistudio.google.com/apikey>
#   AI_DAILY_BUDGET_CALLS=500
cp .env.example apps/web/.env.local   # then edit

npm run dev        # -> http://localhost:3000
npm test           # 19 tests (logic + PDF rendering)
npm run build      # production build check
```

First run: click "Create an account" on the login page, sign up with your email,
then promote yourself to admin once (Supabase Dashboard -> SQL Editor):

```sql
update staff set role = 'admin' where email = 'your-email@example.com';
```

After that, all role management happens inside the app (Staff page).

## B. Deploy to production (Vercel, ~5 minutes, free)

1. Go to https://vercel.com -> **Sign up with GitHub** (use the glowstonesq1 account).
2. **Add New… -> Project** -> Import `glowstonesq1/MuSo_Operations`.
3. In the import screen:
   - **Root Directory**: click Edit -> select `apps/web`  ← the one setting people miss
   - Framework preset: Next.js (auto-detected)
4. **Environment Variables** — add these four:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://bxbasutnjncwvevyeipn.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (in `.env.example`) |
   | `GEMINI_API_KEY` | free key from https://aistudio.google.com/apikey |
   | `AI_DAILY_BUDGET_CALLS` | `500` |

   Do **not** add the service_role key anywhere — the app doesn't use it.
5. Click **Deploy**. You get a URL like `https://muso-operations.vercel.app`.
6. Tell Supabase about the URL so login redirects work:
   Supabase Dashboard -> Authentication -> URL Configuration ->
   **Site URL** = your Vercel URL, and add it to **Redirect URLs**.
7. Sign up in the deployed app, run the admin-promotion SQL above once, done.

From then on, **every push to `main` redeploys automatically** — that's the
improvement loop for phase one: change code -> push -> CI runs tests -> Vercel
ships it. Each teammate signs up (up to 20 users is far inside every free tier)
and an admin assigns their role on the Staff page.

## C. Optional extras

- **Google / Outlook sign-in** — buttons already exist. Enable in Supabase
  Dashboard -> Authentication -> Providers:
  - Google: OAuth client from Google Cloud Console (Web application; authorised
    redirect URI is shown by Supabase on that screen).
  - Azure (Outlook/Microsoft): app registration in Microsoft Entra ID.
- **Custom domain** (e.g. ops.muso.org.in): Vercel -> Project -> Settings ->
  Domains; then update the Supabase Site URL to match.
- **SMS**: intentionally not enabled — there is no free SMS API in India.
  In-app + PDF + "Copy as WhatsApp message" replaces it in v0.

## D. Free-tier limits (all comfortable at MuSo volume)

- **Supabase free**: 500 MB database, 50k monthly active users, project pauses
  after 7 days with zero traffic (first visit wakes it; daily ops use keeps it warm).
- **Vercel free (Hobby)**: 100 GB bandwidth/month, serverless functions included —
  PDF generation runs well inside limits at 20-30 bookings/month.
- **Gemini free tier**: ~1,500 requests/day; the app additionally caches responses
  and hard-caps at `AI_DAILY_BUDGET_CALLS` (500) with rule-based fallback.
