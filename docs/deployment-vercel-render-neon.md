# EDOCASTI cloud deployment

## Target topology

- **Vercel:** React/Vite frontend, built from this repository.
- **Render:** Node/Express API, built and run from this repository.
- **Neon:** PostgreSQL database. The Render service is the only application runtime that receives the database connection string.

The Vercel bundle must never receive `DATABASE_URL`, `JWT_SECRET`, or any other server secret.

## Vercel project

1. Import the EDOCASTI GitHub repository into Vercel.
2. Select the reviewed application branch for preview deployments. Do not promote an unverified preview to production.
3. Use the repository's `vercel.json` build settings (Vite, `npm ci`, `npm run build`, output `dist`).
4. Add the environment variable `VITE_API_BASE_URL` with the full Render API base URL, ending in `/api/v1` (for example, `https://YOUR-RENDER-SERVICE.onrender.com/api/v1`).
5. Add the final Vercel production origin to Render's `CORS_ORIGIN` value. Use the exact origin, without a path. Add additional preview origins only when needed.
6. Redeploy the Vercel frontend after changing its environment variables.

## Render service

1. Create a Render Blueprint from this repository and review `render.yaml`.
2. Select an appropriate production instance plan and region for the institution's usage and latency requirements.
3. Set `DATABASE_URL` to the Neon **production** connection string using Render's secret environment-variable UI. Keep the pooled connection URL private.
4. Set `JWT_SECRET` to the currently approved production signing secret. Do not rotate it casually; rotation invalidates existing sessions.
5. Set `CORS_ORIGIN` to the exact Vercel production origin (comma-separated exact origins if more than one is required).
6. Keep `FEE_MANAGEMENT_ENABLED=false` until the corresponding production schema and end-to-end fee/payment checks have been approved.
7. Confirm `/api/health` returns HTTP 200 and inspect Render logs for startup or database errors.

The Blueprint sets `autoDeploy: false` deliberately. Deployments should be promoted only after the release checks below pass.

## Required release gates before production cutover

- Complete the application-wide PostgreSQL schema and repository conversion. The current application still has JSON-backed modules; this infrastructure configuration does not by itself migrate them.
- Migrate records through a user-controlled, local migration process. Do not upload database files or personal/student/payment records to chat or source control.
- Reconcile source and target counts and financial totals, validate relationships, and retain a recoverable backup.
- Run authentication/RBAC, admissions, student, registration, results, fee/payment, document, settings, audit, and academic-progression integration tests against a non-production Neon branch.
- Confirm authoritative result-source freshness and synchronization. Progression/graduation must fail closed if published-result freshness cannot be established.
- Verify Render API health, CORS from the Vercel domain, frontend login, and representative read/write workflows.
- Obtain explicit production cutover approval after reviewing the reconciliation and test report.

## Current limitations

The existing TypeScript application still initializes `server/db.ts` and several core API routes read/write the local JSON store. Some fee-management and academic-progression modules already use Neon, but the whole application has not yet been harmonized. Do not point live traffic at this build as a completed Neon migration.

The Render health endpoint currently reports process health. It is not a complete readiness check for every required database table or business workflow.
