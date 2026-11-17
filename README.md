# MiniBank Digital Banking Portal

A responsive retail-banking web app: Naira (₦) and USD accounts, instant P2P transfers, airtime/data/electricity/cable payments, and a searchable, filterable transaction ledger with real-time updates.

**Stack:** React 19 · Vite · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS, Realtime) · Render / Vercel

> Demo environment. No real money moves; bill payments are simulated.
> Demo login: `demo@minibank.app` / `MiniBank#2026` (or click **Explore with demo account**).
> Send to Tunde's Naira account `3064276632` to see a transfer land.

## Features
- **Auth:** email/password sign-in, sign-up (auto-provisions a ₦ savings + $ domiciliary account with demo funds), password reset.
- **Account summary cards:** live balances, 30-day in/out, copy account number, hide-balances toggle.
- **Quick transfer modal:** name enquiry on the 10-digit account number, quick amounts, confirm step, receipt with reference.
- **Bill payments:** airtime, data (MTN/Airtel/Glo/9mobile), electricity (DisCos), cable TV (DStv/GOtv/…).
- **Transaction ledger:** full-text search, filters for account, direction, category and date, day-grouped mobile view, CSV export.
- **Real-time:** Supabase Realtime pushes balance and transaction changes, so incoming transfers appear instantly.

## Security model
| Concern | How it's handled |
|---|---|
| Secrets in frontend | Only the Supabase URL and **publishable** key are in the browser (both are public by design). No service-role key anywhere. `.env` is git-ignored. |
| Data isolation | **RLS** on `profiles`, `accounts`, `transactions`: users can only `SELECT` their own rows. |
| Balance tampering | Clients have **no** INSERT/UPDATE/DELETE grants on money tables. Balances change only inside `transfer_funds()` / `pay_bill()`. |
| Overdrafts | Checked three ways: (1) the UI blocks amounts above the available balance, (2) the server function locks the row (`FOR UPDATE`) and re-checks, (3) a `CHECK (balance >= 0)` constraint. |
| Race conditions | Both accounts are locked in a consistent order inside one transaction, so there are no double-spends or deadlocks. |
| Passwords | Hashed by Supabase Auth (bcrypt). |

## Project structure
```
minibank-portal/
├── src/
│   ├── components/   # AppShell, BalanceCard, TransferModal, BillPayModal, TransactionTable, Modal
│   ├── context/      # AuthContext, BankingStateContext
│   ├── pages/        # Login, Dashboard, Settings
│   └── lib/          # supabase.js (client), format.js
├── supabase/migrations/  # SQL schema, RLS and functions
├── .env.example      # copy to .env (real .env is git-ignored)
├── vercel.json       # SPA rewrites + security headers
└── package.json
```

## Run locally
```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Deploy (Render)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` sets up a static site (build `npm ci && npm run build`, publish `dist`, SPA rewrite and security headers).
3. When prompted, enter `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then apply.
4. In Supabase go to **Authentication → URL Configuration** and set **Site URL** to the `https://minibank-portal.onrender.com` address Render gives you.

## Deploy (Vercel)
1. Import the GitHub repo in Vercel (framework preset: **Vite**).
2. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy, then in Supabase go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL so confirmation and reset emails link back correctly.
