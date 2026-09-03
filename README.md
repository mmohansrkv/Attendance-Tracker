# Mobius365 Productivity Tracker

A Node.js/Express app with a PostgreSQL database, built to be deployed on Render.com so your data
persists properly (unlike the single-file version, which only worked inside Claude.ai).

## What's included
- `server.js` — Express server with login sessions, records, users, and master-list APIs
- `db.js` — PostgreSQL connection + table creation + default data seeding
- `public/` — the frontend (HTML/CSS/JS) served by Express
- `render.yaml` — a Render "blueprint" that creates both the web service and the free database automatically

## Default login
- Username: `Mobius365`
- Password: `Mobius@123`
- Change this password (or add other admins) once you're live, via the Users tab — anyone with this
  password has full access.

## Option A — One-click deploy with the blueprint (recommended)
1. Push this folder to a new GitHub repository.
2. In the Render dashboard, click **New > Blueprint**, and point it at your repository.
3. Render reads `render.yaml` and creates:
   - A free PostgreSQL database (`mobius365-tracker-db`)
   - A free web service (`mobius365-tracker`) wired to that database automatically
4. Click **Apply**. Wait for the build to finish, then open the service URL.
5. Log in with the default admin account above.

## Option B — Manual setup
1. **Create the database**: Render dashboard → **New > PostgreSQL** → free plan → create.
   Copy the "Internal Database URL" once it's ready.
2. **Create the web service**: Render dashboard → **New > Web Service** → connect your repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Under the web service's **Environment** tab, add:
   - `DATABASE_URL` = the internal database URL from step 1
   - `SESSION_SECRET` = any long random string
   - `NODE_ENV` = `production`
4. Deploy. Open the service URL and log in.

## Notes on the free tier
- Render's free PostgreSQL databases expire after 30–90 days unless upgraded — check your dashboard
  for the current policy and upgrade before then if you want to keep this data long-term.
  Free web services also "spin down" after inactivity and take ~30–60 seconds to wake back up on
  the next visit; that's normal and doesn't affect your saved data.
- Passwords are stored in plain text in the database to keep this simple, matching how the original
  request was scoped. If this tracker will hold anything sensitive, ask me to add password hashing
  (bcrypt) — it's a small change.
- Sessions are stored in the same Postgres database (via `connect-pg-simple`), so logins survive
  server restarts.

## Running locally (optional, to test before deploying)
```bash
npm install
export DATABASE_URL="postgres://user:pass@localhost:5432/mobius_tracker"
export SESSION_SECRET="dev-secret"
npm start
```
Then open http://localhost:3000
