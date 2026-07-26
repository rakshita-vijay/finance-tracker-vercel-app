# Finance Tracker (Next.js + Supabase)

Same app, same features, rebuilt for Vercel:

- **Auth:** Supabase Auth, email + password. No more plaintext `user_credentials.txt`.
- **Persistence:** Postgres tables (`transactions`, `budgets`, `reports`) instead of
  per-user CSV/TXT/PDF files and Git pushes. Nothing disappears on refresh or redeploy.
- **Report history:** every AI report you generate is saved to the `reports` table and
  listed on the Reports page - this is the "history" that used to vanish.
- **Features kept 1:1:** add transactions, view spending, budgets, AI report generation
  (now a single Gemini call instead of the CrewAI multi-agent pipeline, same prompt/sections),
  CSV/TXT/PDF/MD/ZIP downloads, wipe transactions (password-gated), delete account
  (password-gated), demo-account protection.
- **Dropped:** the `pages/p7_Cleanup.py` pycache/temp-file cleanup and the GitHub
  auto-push (`utils/git_utils.py`) - both were artifacts of the old local-filesystem
  storage model and have no equivalent in a stateless serverless deployment; Supabase
  now does that job.

## 1. Create the Supabase project

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` from this repo.
3. In **Authentication -> Providers -> Email**, keep "Confirm email" on or off as you prefer
   (if on, new users must click the confirmation link before their first login).
4. Copy **Project URL** and **anon public key** from Settings -> API.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...          # from Google AI Studio, same key the old app used
DEMO_EMAIL=demo@example.com # optional, only if you want a read-only demo account

# Optional: add more free-tier Gemini keys to rotate across when one hits its
# daily/per-minute quota (429). Either add GEMINI_API_KEY_2/_3/_4, or set
# GEMINI_API_KEYS to a single comma-separated list - both are supported.
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...
```

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same environment variables in Project Settings -> Environment Variables.
4. Deploy.

## Notes

- Row Level Security is enabled on every table, so one user can never read or write
  another user's rows - this replaces the old "private folder per username" model.
- Deleting an account calls a `delete_own_account()` Postgres function (see schema.sql)
  so the client never needs a service-role key; deleting the `auth.users` row cascades
  to transactions/budgets/reports automatically.
