# Transaction Ledger – Deployment & DevOps Documentation

**Version:** 1.0  
**Project:** Transaction Ledger

## 1. Overview

The Transaction Ledger application uses a separate frontend and backend deployment architecture.

| Component      | Platform       | Technology                          |
| -------------- | -------------- | ----------------------------------- |
| Frontend       | Vercel         | React, TypeScript, Vite             |
| Backend        | Render         | FastAPI, Python                     |
| Database       | PostgreSQL     | PostgreSQL                          |
| Source Control | GitHub         | Git                                 |
| CI/CD          | GitHub Actions | Automated validation and deployment |

### Production URLs

- **Frontend:** https://transaction-ledger-dun.vercel.app
- **Backend:** https://transaction-ledger-api-pnjv.onrender.com

## 2. Deployment Architecture

The frontend and backend are deployed independently.

- The React frontend is hosted on Vercel.
- The FastAPI backend is hosted on Render.
- PostgreSQL provides persistent application data storage.
- GitHub Actions validates code changes and coordinates production deployment.

### API Request Routing

The frontend uses `/api` as its default API base URL.

The Vercel configuration in `frontend/vercel.json` contains two rewrite rules:

1. Requests matching `/api/:path*` are forwarded to the Render backend.
2. Other application paths are rewritten to `/index.html` to support frontend-side routing.

This allows the frontend to communicate with the backend through relative API paths without requiring the Render URL in individual frontend requests.

## 3. Source Control and Branching

GitHub is used for source control and collaboration.

The CI workflow runs on:

- Pushes to `main`.
- Pushes to `CI/CD_Implementation`.
- Pull requests targeting `main`.

The `main` branch is protected through a GitHub ruleset.

### Main Branch Protection

The `main-protection` ruleset enforces:

- Pull requests before merging.
- Required backend CI checks.
- Required frontend CI checks.
- Restrictions on branch deletion.
- Restrictions on force pushes.

The project currently requires zero approving reviews, allowing the solo developer to merge after the required checks pass.

## 4. Continuous Integration

The CI workflow is defined in:

`.github/workflows/ci.yml`

It contains two independent jobs.

### 4.1 Backend CI

Environment:

- Ubuntu latest runner.
- Python 3.10.
- PostgreSQL 16 service.

Execution steps:

1. Check out the repository.
2. Set up Python.
3. Install dependencies from `requirements.txt`.
4. Run Alembic database migrations.
5. Execute backend tests using Pytest.

The CI pipeline uses a separate PostgreSQL database:

`transaction_ledger_test`

This database is disposable and isolated from local development and production databases.

### 4.2 Frontend CI

Environment:

- Ubuntu latest runner.
- Node.js 22.

Execution steps:

1. Check out the repository.
2. Set up Node.js.
3. Install dependencies using `npm ci`.
4. Run frontend lint checks using `npm run lint`.
5. Generate the production build using `npm run build`.

### 4.3 CI Success Criteria

Both backend and frontend jobs must complete successfully.

The required CI checks are enforced by the `main` branch protection ruleset before merging.

## 5. Continuous Deployment

Production deployment is coordinated through GitHub Actions.

The deployment workflow is defined in:

`.github/workflows/smoke-test.yml`

It listens for completion of the `CI` workflow on `main`.

Deployment proceeds only when:

- The upstream workflow was triggered by a push.
- The upstream CI workflow completed successfully.

### 5.1 Backend Deployment – Render

Render automatic deployment is disabled.

After successful CI:

1. GitHub Actions retrieves the exact commit SHA from the completed CI workflow.
2. The Render deployment API is called using that commit SHA.
3. The deployment response is checked to confirm the expected commit.
4. GitHub Actions polls the deployment status.
5. Deployment succeeds only when Render reports the status as `live`.

Failed deployment states and deployment timeouts cause the workflow to fail.

### 5.2 Frontend Deployment – Vercel

Vercel uses its native Git integration.

- Production deployments are created from `main`.
- Preview deployments are generated for feature branches and pull requests.

After the backend deployment is live, GitHub Actions checks for the Vercel production deployment associated with the same commit SHA.

The workflow waits until that deployment reaches the `READY` state.

Failed or blocked deployments and timeouts cause the workflow to fail.

### 5.3 Deployment Serialization

The production deployment workflow uses the concurrency group:

`production-deployment`

Concurrent production deployments are not allowed to cancel an already-running deployment.

This prevents overlapping production deployment workflows.

## 6. Production Smoke Tests

After deployment, the workflow performs basic production availability checks.

### Frontend Check

The workflow sends an HTTP request to:

`https://transaction-ledger-dun.vercel.app`

The request follows redirects and fails if the response is unsuccessful.

### Backend Health Check

The workflow requests:

`https://transaction-ledger-api-pnjv.onrender.com/health`

The expected response is:

```json
{
  "status": "ok"
}
```

The workflow validates the returned JSON status.

The deployment workflow succeeds only after the required deployment and smoke-test steps complete successfully.

## 7. Environment Configuration

Configuration values are supplied through environment variables rather than hardcoded application settings.

### 7.1 Backend Environment Variables

| Variable           | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `DATABASE_URL`     | PostgreSQL database connection string                   |
| `JWT_SECRET_KEY`   | JWT signing secret                                      |
| `RESEND_API_KEY`   | Email delivery service API key                          |
| `EMAIL_FROM`       | Sender email address                                    |
| `FRONTEND_URL`     | Frontend URL used for application links                 |
| `FRONTEND_ORIGINS` | Allowed frontend origins for CORS                       |
| `COOKIE_SECURE`    | Controls the Secure attribute of authentication cookies |
| `CSRF_HEADER_NAME` | Configures the CSRF request header                      |

Additional authentication cookie and refresh-token settings are configurable:

| Variable                         | Default / Purpose                                |
| -------------------------------- | ------------------------------------------------ |
| `REFRESH_COOKIE_NAME`            | Refresh cookie name; defaults to `refresh_token` |
| `REFRESH_TOKEN_COOKIE_NAME`      | Fallback refresh cookie name                     |
| `CSRF_COOKIE_NAME`               | CSRF cookie name; defaults to `csrf_token`       |
| `COOKIE_PATH`                    | Cookie path; defaults to `/api/auth`             |
| `COOKIE_SAMESITE`                | SameSite policy; defaults to `lax`               |
| `COOKIE_DOMAIN`                  | Optional cookie domain                           |
| `APP_ENV`                        | Environment identifier; defaults to `local`      |
| `REFRESH_TOKEN_LIFETIME_SECONDS` | Refresh-token lifetime in seconds                |
| `REFRESH_TOKEN_LIFETIME`         | Fallback refresh-token lifetime in seconds       |

The refresh-token lifetime defaults to seven days.

### 7.2 Frontend Environment Variables

| Variable            | Purpose               | Default |
| ------------------- | --------------------- | ------- |
| `VITE_API_BASE_URL` | Frontend API base URL | `/api`  |

### 7.3 Configuration Management

Environment variables must be configured in the relevant deployment platform or local environment.

- Local development uses the local `.env` configuration.
- Production backend settings are managed through Render.
- Frontend deployment settings are managed through Vercel.
- CI/CD credentials are stored as GitHub Actions secrets.

Actual secret values must never be committed to the repository.

## 8. GitHub Actions Secrets

The production deployment workflow requires the following GitHub repository secrets:

| Secret           | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `RENDER_API_KEY` | Authenticates requests to the Render deployment API |
| `VERCEL_TOKEN`   | Authenticates requests to the Vercel deployment API |

Secrets must be configured through GitHub repository settings.

They must not be printed in workflow logs, committed to source control, or included in documentation.

## 9. Deployment Workflow Summary

The production deployment process follows this sequence:

1. Developer pushes changes to a branch or opens a pull request.
2. GitHub Actions executes backend and frontend CI checks.
3. Required checks must pass before changes can be merged into `main`.
4. Changes are merged into `main`.
5. The CI workflow validates the main-branch push.
6. After successful CI, the production deployment workflow starts.
7. Render deploys the exact commit SHA.
8. GitHub Actions verifies that Render is live.
9. GitHub Actions verifies that the matching Vercel production deployment is ready.
10. Frontend and backend health checks are executed.

## 10. Operational Guidelines

- Do not use production databases for local development or routine automated testing.
- Keep local, CI and production database configurations separate.
- Validate database migrations through CI before production deployment.
- Keep API keys, JWT secrets and database credentials outside source control.
- Review CI failures before merging changes.
- Verify production smoke-test results after deployment.
- Avoid manual production deployments that bypass the established CI/CD process.
- Keep deployment configuration synchronized with the actual application architecture.

## 11. Document Maintenance

This document should be updated when deployment platforms, environment variables, GitHub Actions workflows, branch protection rules, infrastructure or deployment procedures change.
