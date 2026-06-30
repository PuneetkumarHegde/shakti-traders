# Shakti Traders — Purchase & Selling Management System

A complete, self-contained business management web app. No backend, no database
service — all data is stored **in your browser** (localStorage) on the device you use it on,
plus manual JSON backup/restore so you can move data between devices or keep extra copies.

## Login
- Username: `shakti`
- Password: `122333`

## Features
- Dashboard with live stock & financial summary
- Purchase module (TSS/TMS entries, auto-calculated totals & SLNK amount)
- Selling module (auto available/remaining stock tracking)
- Search, date filter, month filter, pagination on both modules
- Reports: Purchase, Selling, Monthly, Single Entry, Complete — export as PDF or Excel
- Backup: data auto-saves on every change to this browser; plus manual
  **Download Backup** (.json) and **Restore Backup** to copy data to/from a file

## How data storage works
All records live in the browser's `localStorage` on whichever device/browser you use.
This means:
- Data persists automatically between visits on the **same browser, same device**.
- Clearing browser data/cache will erase it — use **Backup → Download Backup** regularly.
- To use the app on a second device or browser, download a backup on the first
  and use **Restore Backup** on the second.

## Deploying to Vercel
1. Push this folder to a GitHub repository (or upload directly).
2. Go to vercel.com → New Project → Import the repository.
3. Framework preset: **Other** (static site) — no build command needed.
4. Deploy. Vercel will serve `index.html` and the `css/` and `js/` folders as-is.

Or via CLI from inside this folder:
```
npm i -g vercel
vercel --prod
```

## File structure
```
index.html
css/style.css
js/db.js          – local storage data layer
js/utils.js        – toast/modal/pagination helpers
js/auth.js          – login/session
js/purchase.js     – purchase CRUD + calculations
js/selling.js       – selling CRUD + stock calculations
js/dashboard.js  – summary stats
js/reports.js       – PDF/Excel report generation
js/backup.js        – backup/restore/clear
js/app.js            – navigation
vercel.json
```

## Notes
- Change the login credentials by editing `USERNAME`/`PASSWORD` in `js/auth.js`.
- Since there's no server, this is suitable for a single trusted user/device setup.
  If you later want multi-device sync or multi-user access, that would require
  adding a real backend (e.g. Supabase) — the original spec is JSON-export compatible
  with such a migration if needed later.
