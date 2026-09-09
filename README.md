# GOLDITY Global — Integrated Cloudflare Worker

This package combines the GOLDITY website, API routes, market engine, authentication/referral backend, and D1 migration into one Cloudflare Worker with Static Assets.

## Architecture
- `worker.js` — API + backend
- `assets/` — public website files
- `migrations/0000_initial.sql` — D1 schema
- `wrangler.toml` — Worker + Static Assets + D1 configuration

## Before production deploy
1. Create the D1 database named `goldity-users`.
2. Put the returned database UUID into `wrangler.toml` under `database_id`.
3. Apply the migration: `npx wrangler d1 migrations apply goldity-users --remote`.
4. Set encrypted secrets:
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
5. Deploy with Wrangler: `npx wrangler deploy`.
6. Attach `goldityglobal.com` to the Worker after verifying the deployment.

The website calls `/api/*` on the same origin; no placeholder Worker URL remains in the frontend.
