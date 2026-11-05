# Deploying on Coolify with Railpack (frontend and backend separately)

Three resources in one Coolify project: **MySQL**, **backend** (Express API), **frontend** (Next.js).
Both apps are built from the repo root (npm workspaces + `shared/`), so **Base Directory is `/`** for both. Railpack auto-detects Node; the only difference between the two apps is the build/start command, set with environment variables.

## 1. Database
Project -> **+ New -> Database -> MySQL** (or MariaDB). Start it and copy its **internal** connection URL (`mysql://user:pass@host:3306/db`). Percent-encode special characters in the password.

## 2. Backend
**+ New -> Application -> your Git repo**, then:

| Setting | Value |
|---|---|
| Build strategy | Railpack |
| Site type | Dynamic |
| Install command | leave empty |
| Build command | `npm run db:generate` |
| Start command | `npm run db:deploy && npm run bootstrap:agency && npm run start --workspace backend` |
| Base Directory | `/` |
| Ports Exposes | `4000` |
| Domain | e.g. `https://api.example.com` |
| Health check path | `/api/health` |
| Watch Paths | `backend/**,shared/**,package*.json` |

Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | internal URL from step 1 (also needed at build for Prisma) |
| `FIREBASE_PROJECT_ID` | your Firebase project id |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | base64 of the Admin key (see DEPLOY-RAILWAY.md step 0) |
| `BOOTSTRAP_AGENCY_NAME` / `BOOTSTRAP_AGENCY_EMAIL` | first Agency user |
| `FRONTEND_ORIGIN` | frontend URL, e.g. `https://app.example.com` (no trailing slash) |

Migrations and the Agency bootstrap run on every start (safe to repeat).

## 3. Frontend
**+ New -> Application -> same repo**:

| Setting | Value |
|---|---|
| Build strategy | Railpack |
| Site type | Dynamic |
| Install command | leave empty |
| Build command | `npm run build --workspace frontend` |
| Start command | `npm run start --workspace frontend` |
| Base Directory | `/` |
| Ports Exposes | `3000` |
| Domain | e.g. `https://app.example.com` |
| Watch Paths | `frontend/**,shared/**,package*.json` |

Environment variables:

| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `NEXT_PUBLIC_API_URL` | backend URL, no trailing slash, no `/api` |
| `NEXT_PUBLIC_FIREBASE_*` | the seven values from `frontend/.env.local` |

`NEXT_PUBLIC_*` values are baked in at build time: keep "Build Variable" ticked and **redeploy** after changing any of them.

## 4. Firebase
Authentication -> Settings -> Authorized domains -> add the frontend domain.

## 5. Check
`https://<backend>/api/health` is ok, then sign in on the frontend.

## Notes
- Order: database, backend, frontend, then set `FRONTEND_ORIGIN` on the backend if you didn't know the URL yet.
- Leave `TRUST_PROXY` unset (defaults to 1 behind Coolify's proxy).
- If Railpack picks the wrong Node version, set `RAILPACK_NODE_VERSION=22` (the project needs >= 22.12).
