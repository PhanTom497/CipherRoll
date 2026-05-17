# CipherRoll Deployment Guide

This guide explains how to deploy the current CipherRoll stack after Wave 4 and how it differs from your earlier Wave 3 submission.

Wave 3 was mostly a frontend deployment problem. The current project is not. CipherRoll now has:

- a Next.js frontend in `web/`
- shared runtime and query code in `packages/cipherroll-sdk/`
- a separate long-running backend in `backend/`

Because of that, **Vercel is still the right place for the frontend, but it is no longer the whole deployment**.

---

## 1. What changed since Wave 3

During Wave 3, you could think about CipherRoll mainly as:

- deployed contracts
- a frontend that talked to those contracts

In the current project, the frontend still talks to contracts for wallet-driven actions, but it also expects a backend for:

- indexed organization and payroll views
- reporting summaries
- export packaging
- notifications
- backend health and status
- support-oriented query endpoints

That means the current deployment model is:

1. deploy the frontend to Vercel
2. deploy the backend to a separate Node host
3. connect the frontend to that backend with `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL`

Do not try to host the current backend on Vercel serverless functions. The backend uses:

- a long-running Node HTTP server
- repeated background sync with `setInterval(...)`
- a SQLite file that should persist across restarts

That is not a good match for Vercel’s serverless model.

---

## 2. Recommended deployment architecture

Use this layout:

1. Smart contracts on Arbitrum Sepolia
2. Frontend on Vercel from `web/`
3. Backend on Railway, Render, Fly.io, or a VPS
4. Persistent disk or volume for the backend SQLite file

Good backend hosting choices for the current code:

- Railway
- Render
- Fly.io
- a VPS with PM2 or systemd

If you want the simplest hosted path, Railway or Render is the easiest starting point.

---

## 3. Deployment checklist before touching Vercel

Make sure you already have:

- `CipherRollPayroll` contract address
- `CipherRollAuditorDisclosure` contract address
- direct settlement adapter address
- wrapper settlement adapter address
- an Arbitrum Sepolia RPC URL
- a backend hosting target
- a backend admin token

Run these checks locally first:

```bash
npm install
npm run build:sdk
npm run build:backend
npm --prefix web run build
```

If these builds fail locally, fix that first. Vercel will not magically fix missing local build issues.

---

## 3B. Exact values from this repo

These are the real non-secret deployment values currently present in the local project files.

### Shared public runtime values

Use these exact values in both your frontend deployment and backend deployment:

```bash
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
NEXT_PUBLIC_DEFAULT_ORG_ID=cipherroll-default-org
ARBITRUM_SEPOLIA_RPC_URL=https://arbitrum-sepolia-rpc.publicnode.com
```

Source files:

- [/.env](/home/baba/fhenix/CipherRoll/.env)
- [web/.env.local](/home/baba/fhenix/CipherRoll/web/.env.local)

### Secret values that exist locally but should not be committed into docs

These values exist locally, but you should copy them from your local env files into the deployment dashboards instead of committing them into the repo:

- `GOOGLE_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `DEPLOYER_PRIVATE_KEY`

Use the existing local values from:

- [/.env](/home/baba/fhenix/CipherRoll/.env)
- [web/.env.local](/home/baba/fhenix/CipherRoll/web/.env.local)

Do not commit those secret values into GitHub.

---

## 3A. Direct answers to the common deployment questions

### Do you need Supabase or another external database?

No, not for the current CipherRoll codebase.

Right now the backend uses SQLite, so the minimum working deployment is:

- Vercel for the frontend
- one separate Node backend host
- one persistent disk or volume for the backend database file

Supabase is optional, not required.

You would only need something like Supabase, Neon, RDS, or another managed database if you decide to replace SQLite later for stronger production persistence and scaling.

### Do you only need to deploy frontend and backend and connect them?

Yes, plus one more thing:

- the frontend
- the backend
- the environment variables
- persistent backend storage

So the practical answer is:

1. deploy frontend
2. deploy backend
3. connect frontend to backend with `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL`
4. make sure both sides use the same contract addresses and chain values
5. give the backend persistent storage

### Will CipherBot work for public users on Vercel with your Gemini key?

Yes, if you configure it correctly.

The public CipherBot widget in the frontend calls:

- `web/app/api/chat/route.ts`

That route runs on your Vercel deployment and uses:

- `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`

This means:

- end users do **not** need their own Gemini key
- your Gemini key stays server-side on Vercel
- any visitor using your deployed frontend can ask CipherBot questions

What you must do:

1. add `GOOGLE_API_KEY` in Vercel
2. optionally add `GOOGLE_GEMINI_MODEL=gemini-2.5-flash`
3. redeploy the frontend

Important reality:

- public users will share your Gemini quota and billing
- if your quota is exhausted, CipherBot falls back to local retrieval answers
- if you expect heavy public traffic later, add rate limiting and monitor spend

### Do you also need `GOOGLE_API_KEY` on the backend?

Not for the public frontend widget.

The backend has its own optional `/api/cipherbot/query` route, and that backend route can also use Gemini if you add `GOOGLE_API_KEY` there too.

But the current widget shown to frontend users uses the Vercel `/api/chat` route, so the frontend deployment is the important place for Gemini if your goal is public website chat.

---

## 4. The exact change in your mental model

If you remember your Wave 3 setup, the big change is this:

- before: frontend deploy only
- now: frontend deploy plus backend deploy

So from this point forward, think about CipherRoll as two deployable services:

1. `web`
2. `backend`

The shared SDK in `packages/cipherroll-sdk` is not deployed by itself, but both services depend on it during build.

---

## 5. Step by step: update your Vercel project

This is the part you asked for most directly.

### Step 1: Keep Vercel for the frontend only

Your existing Vercel project should continue to deploy only the Next.js app.

Do not point Vercel at the backend.

### Step 2: Connect the same GitHub repo

If your Phase 3 Vercel project already points to the CipherRoll GitHub repository, you can keep using that project.

You do not need a separate frontend repo.

### Step 3: Set Root Directory to `web`

In Vercel project settings:

- open `Settings`
- open `General`
- set `Root Directory` to `web`

Why this matters:

- the Next.js app lives in `web/`
- Vercel should build that app, not the whole monorepo as if the root were a Next.js project

### Step 4: Set Node.js version

Use Node `18.18+` or `20.x`.

This repo now declares:

- `engines.node >=18.18.0`

If your Vercel project has an older Node version pinned, update it.

### Step 5: Set the Install Command

In Vercel project settings, set:

```bash
cd .. && npm install && cd web && npm install
```

Why:

- the frontend has its own dependencies in `web/package.json`
- the shared SDK build needs root dependencies from `package.json`

### Step 6: Set the Build Command

In Vercel, set:

```bash
npm run build
```

Why this now works:

- `web/package.json` has a `prebuild` step
- that `prebuild` runs `cd .. && npm run build:sdk`
- then the normal Next.js build runs

So the web deployment now builds the shared SDK first.

### Step 7: Keep the Output Directory empty

Do not manually set an output directory for this Vercel project.

It is a normal Next.js deployment.

### Step 8: Confirm Production Branch

Make sure your Vercel production branch is the branch you actually push for deployment, usually:

- `main`

If your old Wave 3 project used another branch, update this now so GitHub pushes trigger the deployment you expect.

### Step 9: Add frontend environment variables

In Vercel `Settings -> Environment Variables`, add:

```bash
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=https://your-backend.example.com
NEXT_PUBLIC_DEFAULT_ORG_ID=cipherroll-default-org
```

Optional:

```bash
GOOGLE_API_KEY=<copy the existing local secret from web/.env.local>
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
```

Notes:

- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL` must point to the public backend URL, not localhost
- if you add `GOOGLE_API_KEY` on Vercel, public users of the deployed frontend can use Gemini-backed CipherBot
- if you do not add `GOOGLE_API_KEY`, CipherBot now falls back to local retrieval mode instead of hard failing
- if Vercel asks which environments to apply these to, choose `Production`, and also `Preview` if you want branch deploys to behave the same way

### Step 9A: Exactly where to put the Vercel values

In the Vercel dashboard:

1. open your CipherRoll project
2. click `Settings`
3. click `Environment Variables`
4. click `Add New`
5. paste one key and one value at a time
6. select `Production`
7. optionally also select `Preview`
8. save
9. redeploy

You can also bulk-add them, but one-by-one is safer the first time.

### Step 10: Save settings and trigger a redeploy

Once the Vercel settings above are saved:

1. push your branch to GitHub
2. let Vercel redeploy
3. inspect the build logs

If Vercel still fails to pick up the project, the most common causes are:

- Root Directory is wrong
- Install Command only installs `web/` dependencies and skips root dependencies
- frontend env vars are missing
- backend URL still points to localhost

---

## 6. Step by step: deploy the backend separately

The backend is its own deployment.

### Step 1: Choose a backend host

Pick one of:

- Railway
- Render
- Fly.io
- VPS

### Step 2: Deploy from the repo root

The backend service should use the repository root, not the `web/` subdirectory.

### Step 3: Set the backend build command

Use:

```bash
npm install && npm run build:backend
```

### Step 4: Set the backend start command

Use:

```bash
npm run start:backend
```

### Step 5: Add backend environment variables

Required:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://arbitrum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
CIPHERROLL_BACKEND_ADMIN_TOKEN=<create a new secret token for production>
```

Recommended:

```bash
CIPHERROLL_INDEXER_POLL_INTERVAL_MS=30000
CIPHERROLL_INDEXER_CHUNK_SIZE=50000
```

Recommended when using hosted persistent storage:

```bash
CIPHERROLL_BACKEND_DB_PATH=/data/cipherroll-index.sqlite
```

Usually optional on managed platforms:

```bash
CIPHERROLL_BACKEND_HOST=0.0.0.0
```

Why usually optional:

- the backend now supports `PORT`
- it defaults to `0.0.0.0`
- many hosts inject `PORT` automatically

Optional for a faster first sync:

```bash
CIPHERROLL_INDEXER_START_BLOCK=265000000
```

Optional for hosted CipherBot AI mode:

```bash
GOOGLE_API_KEY=...
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
```

This backend Gemini configuration is optional for the current public frontend widget.

It only matters if you also want the backend-owned CipherBot endpoint to produce Gemini-backed answers.

### Step 5A: Exactly where to put backend values on Render

If you use Render:

1. create a new `Web Service`
2. set the repo to this CipherRoll repo
3. keep the `Root Directory` as the repo root
4. set the build command to:

```bash
npm install && npm run build:backend
```

5. set the start command to:

```bash
npm run start:backend
```

6. open the created service
7. click `Environment` in the left sidebar
8. click `Add Environment Variable`
9. add the backend variables listed above
10. save and deploy

Render supports adding env vars in bulk from a `.env` file as well, but do not upload a file that contains secrets you do not want reused across environments.

### Step 6: Attach persistent storage

This matters a lot.

The backend stores indexed state in SQLite. If your host wipes the filesystem on restart, the backend will rebuild from chain state repeatedly.

Use a persistent volume or mounted disk and point:

```bash
CIPHERROLL_BACKEND_DB_PATH=/data/cipherroll-index.sqlite
```

### Step 6A: Exactly where persistent storage is configured on Render

The disk mount path is **not** put into GitHub and it is not inferred automatically by the app host. You configure it in the backend service settings.

If you use Render:

1. open your backend `Web Service`
2. go to the service settings where you attach storage
3. add a `Persistent Disk`
4. set the disk `Mount Path` to:

```bash
/data
```

5. after that, go back to the same backend service `Environment` page
6. add this environment variable:

```bash
CIPHERROLL_BACKEND_DB_PATH=/data/cipherroll-index.sqlite
```

That means:

- `/data` is the disk mount path you choose in Render
- `CIPHERROLL_BACKEND_DB_PATH` is the env var you set on that same backend service
- together they make the SQLite file live on persistent storage

If you choose a different mount path in Render, then `CIPHERROLL_BACKEND_DB_PATH` must match it.

Example:

- Render disk mount path: `/var/cipherroll`
- matching env var: `CIPHERROLL_BACKEND_DB_PATH=/var/cipherroll/cipherroll-index.sqlite`

### Step 7: Confirm backend health before touching Vercel again

After backend deployment succeeds, check:

```bash
curl https://your-backend.example.com/api/health
curl https://your-backend.example.com/api/status
```

Do this before expecting admin or auditor flows to behave normally in the deployed frontend.

---

## 7. The env split you now need to understand

This is the simplest way to think about the environment variables.

### Frontend-only values in Vercel

- `NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN`
- `NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS`
- `NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER`
- `NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER`
- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL`
- `NEXT_PUBLIC_DEFAULT_ORG_ID`

### Backend-only values on the backend host

- `ARBITRUM_SEPOLIA_RPC_URL`
- `CIPHERROLL_BACKEND_ADMIN_TOKEN`
- `CIPHERROLL_BACKEND_DB_PATH`
- `CIPHERROLL_INDEXER_POLL_INTERVAL_MS`
- `CIPHERROLL_INDEXER_CHUNK_SIZE`
- `CIPHERROLL_INDEXER_START_BLOCK`
- `PORT` if your platform uses it

### Shared values used by both

- target chain
- contract addresses
- settlement adapter addresses

If the frontend and backend disagree about contract addresses, the deployment is broken even if both services are technically online.

### Recommended first production values

If you want the simplest first deployment, use exactly these values:

Frontend on Vercel:

```bash
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
NEXT_PUBLIC_DEFAULT_ORG_ID=cipherroll-default-org
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=https://your-render-backend.onrender.com
GOOGLE_API_KEY=<copy from your local web/.env.local>
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
```

Backend on Render:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://arbitrum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_CIPHERROLL_TARGET_CHAIN=arb-sepolia
NEXT_PUBLIC_CIPHERROLL_CONTRACT_ADDRESS=0xAeCaDDa189f35EfB69C2dCc37688030A9Af58DC3
NEXT_PUBLIC_CIPHERROLL_AUDITOR_DISCLOSURE_ADDRESS=0x328Fe7B46ddf38888978C3f6CDC49233810ccE49
NEXT_PUBLIC_CIPHERROLL_DIRECT_SETTLEMENT_ADAPTER=0x4d0EbdE132402145D464089Fd7bE7362dec6f428
NEXT_PUBLIC_CIPHERROLL_WRAPPER_SETTLEMENT_ADAPTER=0x892DEaAaf13fb4a5a57288bB6089565c3cdB95e0
CIPHERROLL_BACKEND_ADMIN_TOKEN=<create a new production-only secret>
CIPHERROLL_BACKEND_DB_PATH=/data/cipherroll-index.sqlite
CIPHERROLL_INDEXER_POLL_INTERVAL_MS=30000
CIPHERROLL_INDEXER_CHUNK_SIZE=50000
```

---

## 8. What I changed in the repo to make deployment easier

These changes are already reflected in the current codebase:

- the frontend now runs `build:sdk` automatically before its own build
- the backend can bind to platform `PORT`
- the backend defaults to `0.0.0.0` instead of only `127.0.0.1`
- the SDK no longer defaults to localhost backend URLs in production mode
- CipherBot no longer hard fails when `GOOGLE_API_KEY` is missing
- `.env.example` now separates local and hosted examples more clearly
- the repo now declares `node >=18.18.0`

These changes reduce the gap between local development and hosted deployment.

---

## 8A. What “same as localhost” really means

You said you want the deployed product to behave the same as localhost. That is achievable for the current stack, with a few honest caveats.

### What can match localhost closely

- frontend routes
- wallet-based flows
- admin, employee, and auditor UI behavior
- backend-powered reports and exports
- public Gemini-backed CipherBot on the deployed frontend

### What must be configured correctly for that to happen

- correct contract addresses
- correct backend URL in Vercel
- working Arbitrum Sepolia RPC on the backend
- persistent backend storage
- Gemini API key in Vercel
- same chain and env values across frontend and backend

### What is not “automatic” in production

- backend persistence
- Gemini quota and rate-limit handling
- public traffic control

So the honest answer is:

- yes, production can behave very close to localhost
- no, it is not just “push to GitHub and everything is identical” unless the backend, storage, and envs are configured properly

### The one feature-parity warning you should know now

If you deploy the backend without persistent storage, some backend-driven features may still work, but the indexer state can rebuild after restart and the experience will not feel as stable as localhost.

The solution is simple:

- use a persistent disk or volume
- point `CIPHERROLL_BACKEND_DB_PATH` at that mounted path

---

## 9. What will work on Vercel immediately, and what depends on the backend

### Frontend can still render without the backend

Pages like:

- `/docs`
- general static UI shells

can load without a working backend.

### Some real product features now depend on the backend

Operational surfaces like:

- admin reporting
- exports
- auditor packages
- notifications
- backend health/status flows

need the backend to be deployed and reachable.

So if your frontend deploys successfully but some product features fail, that does not necessarily mean the Vercel deploy is wrong. It often means the backend is missing or misconfigured.

---

## 10. Recommended deployment order

Use this order every time:

1. confirm contract addresses
2. deploy backend
3. verify backend `/api/health`
4. add backend URL to Vercel
5. deploy frontend
6. test admin, employee, auditor, and docs flows

This order avoids deploying a frontend that points at a backend that does not exist yet.

---

## 11. Post-deploy verification checklist

After deployment, verify all of the following:

- Vercel build succeeds
- backend build succeeds
- frontend home and `/docs` load
- `/admin` can connect wallet and read workspace state
- `/employee` can initialize privacy mode and refresh allocations
- `/auditor` can initialize and load aggregate review data
- `https://your-backend.example.com/api/health` returns success
- `https://your-backend.example.com/api/status` returns indexer data
- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL` points to the public backend domain
- contract addresses match the deployed contracts
- the target chain is still `arb-sepolia`

---

## 12. Common deployment mistakes

### Mistake 1: Trying to deploy the backend on Vercel

Do not do this with the current backend.

### Mistake 2: Forgetting the shared SDK build

If the frontend build does not run the SDK build first, the deploy can fail or drift from local behavior.

### Mistake 3: Leaving backend URL on localhost

This is one of the most common Wave 3 to Wave 4 migration mistakes.

Bad:

```bash
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=http://127.0.0.1:4000
```

Good:

```bash
NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL=https://your-backend.example.com
```

### Mistake 4: Using ephemeral backend storage

If the SQLite file disappears on restart, the backend indexer has to rescan.

### Mistake 5: Forgetting to redeploy Vercel after backend URL changes

When you change frontend env vars in Vercel, redeploy the frontend.

---

## 13. Troubleshooting

### Vercel build fails with shared package errors

Check:

- Root Directory is `web`
- Install Command installs both root and `web/` dependencies
- Build Command is `npm run build`

### Frontend deploys but admin or auditor data is empty

Check:

- backend is deployed
- `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL` is correct
- backend `ARBITRUM_SEPOLIA_RPC_URL` is valid
- backend indexer has had time to sync

### Backend starts locally but not on the host

Check:

- platform `PORT` handling
- persistent storage path permissions
- contract addresses
- Arbitrum Sepolia RPC connectivity

### CipherBot returns fallback answers

That is expected if:

- `GOOGLE_API_KEY` is not configured

The app will still work, but answers come from local retrieval instead of hosted Gemini output.

---

## 14. Future improvements that would make deployment even smoother

These are good next steps, but not blockers for deployment today:

1. Add a backend Dockerfile
2. Move backend persistence from SQLite to a managed database
3. Add a deployment validation script for required env vars
4. Add a dedicated `.env.production.example`
5. Add frontend health panels for backend sync status and lag

---

## 15. Short version

If you want the shortest possible answer:

1. keep Vercel for `web/`
2. set Vercel Root Directory to `web`
3. install both root and `web` dependencies in Vercel
4. deploy the backend separately on Railway or Render
5. set `NEXT_PUBLIC_CIPHERROLL_BACKEND_BASE_URL` in Vercel to the backend public URL
6. attach persistent storage to the backend
7. redeploy frontend after backend is live

That is the core deployment change from Wave 3 to the current CipherRoll architecture.
