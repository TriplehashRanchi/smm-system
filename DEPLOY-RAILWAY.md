# Deploying on Railway

Three services in one Railway project, all built from the same GitHub repository:

| Service | What it is | Public? |
|---|---|---|
| **MySQL** | The database (Railway plugin) | No. Only the backend talks to it, over Railway's private network |
| **backend** | The Express API (`backend/`) | Yes. The website calls it from the browser |
| **frontend** | The Next.js website (`frontend/`) | Yes |

Leave the **Root Directory empty** (the repository root) for both app services. The project uses npm workspaces and the frontend imports the `shared/` folder, so both need the whole repository.

## 0. Before you start
1. **Put the code on GitHub** (this folder is not a git repository yet):
   ```
   git init
   git add .
   git commit -m "first commit"
   ```
   Create an empty repository on GitHub, then `git remote add origin <url>` and `git push -u origin main`.
   `.gitignore` already keeps out `.env` files, the Firebase key and `.local/`. Run `git status` first and make sure none of them is listed.
2. **Firebase Admin key as text.** A host has no place for a key file, so convert it to base64 (PowerShell, copies it to the clipboard):
   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("backend\firebase-admin.json")) | Set-Clipboard
   ```
3. Have your Firebase web settings ready (`frontend/.env.local`): the seven `NEXT_PUBLIC_FIREBASE_*` values.

## 1. Create the project and the database
1. Railway: **New Project → Deploy from GitHub repo** and pick the repository. This creates the first service. Rename it **backend**.
2. In the same project: **+ New → Database → Add MySQL**.

## 2. Configure the backend service
**Settings**

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run db:generate` |
| Pre-deploy command | `npm run db:deploy && npm run bootstrap:agency` |
| Start command | `npm run start --workspace backend` |
| Healthcheck path | `/api/health` |
| Networking | **Generate Domain** (copy the address, you need it in step 3) |
| Watch paths (optional) | `/backend/**`, `/shared/**`, `/package.json`, `/package-lock.json` |

The pre-deploy command creates or updates the database tables and makes sure your first Agency user exists. It is safe to run on every deploy.

**Variables**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (a reference to the database service; type it exactly) |
| `FIREBASE_PROJECT_ID` | your Firebase project id |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | the base64 text from step 0 |
| `BOOTSTRAP_AGENCY_NAME` | your name |
| `BOOTSTRAP_AGENCY_EMAIL` | the email you sign in with as the agency |
| `FRONTEND_ORIGIN` | set after step 3, for example `https://your-frontend.up.railway.app` |

`PORT` is provided by Railway. Do not set it.

## 3. Create the frontend service
1. **+ New → GitHub Repo** (the same repository). Name it **frontend**.
2. **Settings**

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build --workspace frontend` |
| Start command | `npm run start --workspace frontend` |
| Networking | **Generate Domain** |

3. **Variables.** Set them **before** the first build, because `NEXT_PUBLIC_*` values are baked in at build time:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | the backend's address, `https://...up.railway.app`, with **no** trailing slash and **no** `/api` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` and the six other `NEXT_PUBLIC_FIREBASE_*` | from `frontend/.env.local` |

4. Deploy. Copy the frontend's address.
5. Go back to the **backend** and set `FRONTEND_ORIGIN` to that address. It restarts by itself.

## 4. Allow your domain in Firebase
Firebase Console → **Authentication → Settings → Authorized domains → Add domain**: the frontend address without `https://`.

## 5. Check it works
1. `https://<backend>/api/health` shows an "ok" answer.
2. Open the frontend and sign in as the agency.
3. Add a client, a social account and a post.

## Custom domain (optional)
Add it under the service's **Networking → Custom Domain** and create the DNS record Railway shows.
- Allow both addresses in the backend: `FRONTEND_ORIGIN=https://app.example.com,https://your-frontend.up.railway.app`
- Add the domain to Firebase's authorized domains.
- If the API gets its own domain, change `NEXT_PUBLIC_API_URL` and **redeploy the frontend** (it is built in).

## Moving your existing data (optional)
A fresh database starts empty, which is right for a new launch. To bring your current data from Hostinger, dump it with `mysqldump` and load it into Railway's database through its public connection details. Ask for help before you try this on real client data.

## If something goes wrong
| Symptom | Likely cause |
|---|---|
| "The workspace could not be reached" in the browser | `FRONTEND_ORIGIN` does not match the address in the browser, or `NEXT_PUBLIC_API_URL` is wrong. After changing `NEXT_PUBLIC_API_URL`, redeploy the frontend |
| Backend deploy fails at pre-deploy | Read the log. Usually `DATABASE_URL` is not the reference, or the Firebase key variable is missing or damaged |
| Sign-in popup is blocked or refused | The frontend address is not in Firebase's authorized domains |
| "Firebase project does not match" in the backend log | `FIREBASE_PROJECT_ID` differs from the project in the key |
| Everyone gets "Too many requests" | `TRUST_PROXY` has been set to 0. Leave it unset in production |

## Variables reference (backend)
`NODE_ENV`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_BASE64` (or `FIREBASE_SERVICE_ACCOUNT_JSON`), `FRONTEND_ORIGIN` (one or more addresses, comma separated), `BOOTSTRAP_AGENCY_NAME`, `BOOTSTRAP_AGENCY_EMAIL`. Optional: `HOST` (default `0.0.0.0` in production), `TRUST_PROXY` (default `1` in production).
