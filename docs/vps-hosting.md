# VPS Hosting + Cron (Easy Steps)

This project runs as a normal Next.js Node app on Linux VPS.

## 1) Prepare server

Install:

- Node.js 20+
- npm
- curl
- PM2 (recommended): `npm i -g pm2`

Clone and enter project:

```bash
git clone <YOUR_REPO_URL> operation-automation
cd operation-automation
npm ci
```

## 2) Set environment

Create/edit `.env` in project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/operation-automation-2
CURRENCYAPI_KEY=YOUR_CURRENCYAPI_KEY
CRON_SECRET=YOUR_LONG_RANDOM_SECRET
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

Keep the same `CRON_SECRET` for manual curl and cron schedule.

If you have a public domain, set:

```env
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
```

## 3) Build + run app

```bash
npm run build
pm2 start npm --name operation-automation -- run start
pm2 save
pm2 startup
```

Confirm app is up:

```bash
pm2 status
curl -I http://127.0.0.1:3000
```

## 4) Test cron endpoint once

```bash
curl -fsS -X POST "http://127.0.0.1:3000/api/cron/currency-fx?force=1" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected: JSON with `ok: true`.  
If you get `Invalid authentication credentials`, your `CURRENCYAPI_KEY` is invalid and must be replaced.
If you use a domain, replace `http://127.0.0.1:3000` with `https://YOUR_DOMAIN`.

## 5) Schedule daily at 6:00 AM IST

Open crontab:

```bash
crontab -e
```

Add one of these:

### Option A (if your cron supports `CRON_TZ`)

```cron
CRON_TZ=Asia/Kolkata
0 6 * * * /usr/bin/curl -fsS -X POST "http://127.0.0.1:3000/api/cron/currency-fx" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/operation-fx-cron.log 2>&1
```

### Option B (UTC server)

6:00 AM IST = 00:30 UTC

```cron
30 0 * * * /usr/bin/curl -fsS -X POST "http://127.0.0.1:3000/api/cron/currency-fx" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/operation-fx-cron.log 2>&1
```

If you use a public domain, replace `http://127.0.0.1:3000` with `https://YOUR_DOMAIN`.

Check installed jobs:

```bash
crontab -l
```

## 6) Daily checks

- App health: `pm2 status`
- Cron log: `tail -n 50 /var/log/operation-fx-cron.log`
- Manual retry: run the curl from Step 4

## Notes

- Endpoint supports `Authorization: Bearer <CRON_SECRET>`, `x-cron-secret`, or `?secret=`. Use Bearer header.
- FX route is designed to make at most one external CurrencyAPI request per IST day (unless `?force=1`).
- Keep `public/uploads/` on persistent storage and back it up.
