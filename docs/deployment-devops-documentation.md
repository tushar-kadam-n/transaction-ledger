# Deployment and DevOps Documentation

**Project:** Transaction Ledger  
**Version:** 1.0  
**Status:** Current CI/CD baseline

## 1. Hosting and production services

| Component | Platform | Production branch |
|---|---|---|
| Source repository | GitHub | `main` |
| Frontend | Vercel | `main` |
| Backend | Render | `main` |

Production URLs:
- Frontend: https://transaction-ledger-dun.vercel.app
- Backend: https://transaction-ledger-api-pnjv.onrender.com
- Backend health: https://transaction-ledger-api-pnjv.onrender.com/health

## 2. Branch and pull request workflow

- `main` is the production branch.
- Work is developed on feature/working branches.
- Pull requests target `main`.
- GitHub ruleset protects `main`.
- Required checks are `backend` and `frontend`.
- Force pushes and branch deletion are restricted.
- Required approval count is zero for the current solo-maintained workflow.

Review the active GitHub ruleset if these settings change.

## 3. Continuous Integration

The GitHub Actions workflow named `CI` runs for configured branch pushes and pull requests targeting `main`.

### Backend job
- Python 3.10
- PostgreSQL 16 service
- Install `requirements.txt`
- Run `alembic upgrade head`
- Run `pytest`

### Frontend job
- Node.js 22
- `npm ci`
- `npm run lint`
- `npm run build`

Both `backend` and `frontend` checks are required for merging into `main`.

## 4. Continuous deployment

### Frontend — Vercel

Vercel's native Git integration deploys production when changes reach `main`. Feature branches and pull requests can receive preview deployments. The frontend uses `/api` and Vercel proxy/rewrite configuration to reach the backend.

### Backend — Render

Render Auto-Deploy is disabled. GitHub Actions initiates the backend deployment after CI succeeds on a push to `main`. The workflow requests deployment for the exact commit SHA from the completed CI run.

## 5. Production Smoke Tests workflow

The workflow file is `.github/workflows/smoke-test.yml`.

Trigger:
- `workflow_run` after the workflow named `CI` completes on `main`.
- It proceeds only for a successful CI run caused by a push.

Sequence:
1. Trigger Render deployment for the upstream commit SHA.
2. Verify the deployment ID and commit SHA.
3. Poll Render until the deployment is live, or fail on terminal error/timeout.
4. Poll Vercel production deployments for the matching project and commit SHA until ready, or fail on error/timeout.
5. Request the production frontend.
6. Request backend `/health` and validate the JSON status is `ok`.

Concurrency:
- Group: `production-deployment`
- `cancel-in-progress: false`
- This avoids cancelling an active deployment run. GitHub concurrency allows one pending run per group, so a newer pending run may replace an older pending run.

## 6. GitHub secrets and credentials

The workflow uses repository secrets:
- `RENDER_API_KEY`
- `VERCEL_TOKEN`

The Render API key was configured with read access to services and permission to run deployments. The Vercel token is used to query deployment status.

Never store secret values in this document, workflow logs, commits or screenshots. Rotate credentials if exposure is suspected.

## 7. Environment separation and safety

- Local development uses local PostgreSQL database `transaction_ledger` through the verified local `.env`.
- CI uses a disposable PostgreSQL service.
- Production uses hosted configuration.
- Do not point local development or destructive test commands at production.
- Keep environment files and secrets out of Git.

Exact environment variable names (other than the GitHub secret names listed above), Vercel rewrite configuration and Render build/start commands should be verified from current deployment settings and repository files before being added.

## 8. Operational checks and recovery

Current automated checks confirm deployment state and basic HTTP health. A documented rollback procedure, staging environment, backup schedule, restore drill, monitoring and alerting are **not yet established in this baseline**.

Before production incidents, inspect provider deployment history and logs. Do not perform a rollback or database restore without assessing schema compatibility and data-loss implications.

## 9. Future DevOps improvements

- Staging environment and promotion workflow
- Automated rollback/recovery process
- End-to-end tests
- Dependency/security scanning
- Monitoring and alerting
- Database backup and restore drills
- Deployment notifications and release summaries
