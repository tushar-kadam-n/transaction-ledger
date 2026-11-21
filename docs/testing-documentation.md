# Testing Documentation

**Project:** Transaction Ledger  
**Version:** 1.0  
**Status:** Initial test strategy baseline

## 1. Purpose

This document describes the testing approach and the automated checks used to protect application behavior.

## 2. Testing layers

| Layer | Purpose | Current evidence/status |
|---|---|---|
| Backend automated tests | Validate API behavior and business rules | `pytest` runs in CI; 57 tests were reported passing at the baseline |
| Database migration validation | Ensure migrations apply to a clean PostgreSQL database | `alembic upgrade head` runs in CI |
| Frontend lint | Detect code-quality and lint issues | `npm run lint` runs in CI |
| Frontend build | Verify production compilation | `npm run build` runs in CI |
| Production smoke tests | Verify deployed frontend/backend availability | Implemented in GitHub Actions |
| End-to-end browser tests | Verify complete user journeys | Future improvement; not recorded as implemented |

## 3. Continuous Integration test environment

The CI workflow:
- Uses Python 3.10 for the backend job.
- Starts a PostgreSQL 16 service for backend validation.
- Installs backend dependencies from `requirements.txt`.
- Applies Alembic migrations.
- Executes `pytest`.
- Uses Node.js 22 for frontend validation.
- Runs `npm ci`, `npm run lint` and `npm run build`.

The CI database is disposable and separate from the local and production databases.

## 4. Important business-rule test areas

Ensure tests cover, where applicable:
- Valid credit transaction
- Valid debit transaction
- Amount equal to zero or below zero
- Debit exceeding available balance
- Debit equal to available balance
- Duplicate reference ID on the same account
- Reuse of reference ID on a different account
- Unknown account
- Account balance after successful and rejected transactions
- Account-specific transaction history
- All-account history when no account filter is selected
- Newest-first ordering
- Search behavior and boundary cases
- Authentication success, failure, refresh and logout
- Authorization and cross-user data isolation

This is a recommended coverage checklist, not a claim that every scenario currently has a test.

## 5. Test case template

| ID | Feature | Preconditions | Steps/input | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| TC-XXX | To be filled | To be filled | To be filled | To be filled | To be filled | Not run |

## 6. Production smoke tests

After successful CI on a push to `main`, the Production Smoke Tests workflow:
1. Triggers Render deployment for the CI commit SHA.
2. Confirms the deployment belongs to the expected SHA.
3. Waits for Render to reach `live`.
4. Waits for the matching Vercel production deployment to reach `READY`.
5. Requests the frontend production URL.
6. Requests backend `/health` and verifies `status: ok`.

These checks verify deployment readiness and basic availability; they do not replace functional end-to-end tests.

## 7. Running tests locally

Use the repository's current documented setup and local `.env`. Before running database tests, verify that the test configuration targets a safe local/test database. Never run test setup or destructive test commands against production.

Exact local commands and test markers should be confirmed from the current project configuration before adding them here.

## 8. Reporting and maintenance

When a test is added or changed:
- Update the relevant test module.
- Update this document if the test strategy or coverage materially changes.
- Record CI evidence in the pull request or CI run.
- Distinguish automated tests from manual checks.
- Do not claim coverage percentages unless generated from a current coverage report.
