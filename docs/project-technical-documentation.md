# Transaction Ledger — Project Technical Documentation

**Version:** 1.0  
**Baseline date:** 21 November 2026  
**Status:** Active development  
**Repository:** `tushar-kadam-n/transaction-ledger`

## 1. Project Overview

Transaction Ledger is a full-stack web application for managing financial accounts and recording credit and debit transactions.

It supports account-level balance tracking, transaction history, search and filtering, user authentication, and a dashboard for reviewing financial activity.

This document records the verified project baseline as of 21 November 2026. Detailed implementation references are maintained in the API, Database, Testing, and Deployment & DevOps documentation.

## 2. Technology Stack

| Area             | Technology              |
| ---------------- | ----------------------- |
| Frontend         | React, TypeScript, Vite |
| Backend          | Python, FastAPI         |
| Database         | PostgreSQL              |
| ORM              | SQLAlchemy              |
| Migrations       | Alembic                 |
| API style        | REST                    |
| Frontend hosting | Vercel                  |
| Backend hosting  | Render                  |
| Source control   | Git, GitHub             |
| CI/CD            | GitHub Actions          |

Exact dependency versions are maintained in the respective dependency manifests and lockfiles.

## 3. High-Level Architecture

- React frontend hosted on Vercel.
- Frontend API requests use the `/api` path by default.
- Vercel rewrites API requests to the Render-hosted FastAPI backend.
- FastAPI provides authentication, account management, and transaction operations.
- SQLAlchemy handles database access.
- Alembic manages database schema migrations.
- PostgreSQL provides persistent storage.

### Production Endpoints

- Frontend: https://transaction-ledger-dun.vercel.app
- Backend: https://transaction-ledger-api-pnjv.onrender.com
- Backend health: https://transaction-ledger-api-pnjv.onrender.com/health

## 4. Functional Areas

### 4.1 Authentication

Implemented capabilities:

- User registration.
- Email verification.
- Login and logout.
- Access-token authentication.
- Refresh-token rotation.
- Forgot-password and password-reset workflows.

Implementation details:

- Passwords are hashed using Argon2.
- Access tokens use JWT with the HS256 signing algorithm.
- Access-token lifetime is 15 minutes.
- Refresh tokens are stored as hashes in the database.
- Refresh tokens are rotated during refresh operations.
- Refresh and CSRF cookies support the authentication flow.
- Password reset invalidates active refresh sessions.
- Email verification and password-reset tokens are stored as hashes and have expiration times.

### 4.2 Account Management

Implemented capabilities:

- Create financial accounts.
- Retrieve accounts belonging to the authenticated user.
- Retrieve an account's current balance.
- Associate transactions with accounts.

Supported account types:

- Savings
- Current
- Cash
- Digital wallet
- Business

Account creation supports a name, account type, optional email, optional phone number, and optional description. At least one contact field (email or phone) is required.

Account and balance retrieval enforce authenticated user ownership.

Update and delete account operations are not exposed by the inspected account API routes.

### 4.3 Transaction Management

Implemented capabilities:

- Record credit transactions.
- Record debit transactions.
- Associate transactions with an account.
- Track transaction date and creation date.
- Validate transaction amounts and reference IDs.
- Update account balances when transactions succeed.

Business behavior:

- Transaction amounts must be greater than zero.
- Debit transactions are rejected when the available balance is insufficient.
- Reference IDs must be unique within an account.
- The same reference ID may be used on a different account.
- Duplicate submissions return the existing transaction rather than creating another one.
- Account balance updates and transaction insertion are committed together.

The ledger service locks the relevant account row during transaction processing to coordinate concurrent operations on the same account.

### 4.4 Transaction History, Search and Export

Implemented capabilities:

- Retrieve transaction history across the authenticated user's accounts.
- Retrieve history for a selected account.
- Filter by account and transaction type.
- Search transaction descriptions, reference IDs, and account names in the global history endpoint.
- Filter by start and end dates in the global history endpoint.
- Paginate transaction history.
- Export filtered transactions as CSV.

History is ordered newest-first, using transaction creation time and transaction ID as ordering fields.

CSV exports include account name, transaction date and time, type, amount, description, and reference ID.

### 4.5 User Interface

Implemented areas:

- Overview dashboard.
- Account management.
- Transaction entry.
- Transaction history.
- Theme support.
- Responsive layout.

## 5. Data and Business Rules

Key business rules:

1. Transaction amounts must be greater than zero.
2. A debit must not exceed the available account balance.
3. Reference ID uniqueness is scoped to an account.
4. Successful transaction creation and balance updates are committed together.
5. Account and transaction data returned through authenticated account operations are restricted to the current user's ownership.
6. Transaction timestamps must include timezone information and are normalized to UTC.

Database constraints and service-level validations are documented separately in the Database Documentation.

**Important distinction:** Insufficient-balance validation is enforced by the ledger service. The inspected database schema does not contain a separate check constraint preventing a negative account balance.

## 6. Environment Separation

| Environment       | Configuration                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Local development | Local PostgreSQL database named `transaction_ledger`, configured through the local `.env` |
| CI                | Disposable PostgreSQL 16 service used by GitHub Actions                                   |
| Production        | Hosted deployment configuration and production database settings                          |

**Important:** Local development must use the local `transaction_ledger` database. Do not connect local development workflows to or modify the hosted production database.

Never commit `.env` files, passwords, API keys, tokens, connection strings, or other secrets.

## 7. Branching and Pull Requests

- `main` is the production branch.
- Development work is carried out on working and feature branches.
- Changes are proposed to `main` through pull requests.
- A GitHub ruleset protects `main`.
- Required CI checks are `backend` and `frontend`.
- Force pushes and deletion of the protected branch are restricted.
- Required approval count is currently zero.

The CI/CD implementation was developed on `CI/CD_Implementation` and merged into `main`.

## 8. CI/CD Summary

### 8.1 Continuous Integration

The GitHub Actions CI workflow validates backend and frontend changes.

**Backend checks:**

- Python 3.10 setup and dependency installation.
- PostgreSQL 16 test service.
- Alembic migrations.
- Automated tests using `pytest`.

**Frontend checks:**

- Node.js 22 setup.
- `npm ci`.
- `npm run lint`.
- `npm run build`.

### 8.2 Deployment

- Vercel's native Git integration deploys production from `main`.
- Render Auto-Deploy is disabled.
- After successful CI on a push to `main`, the production workflow triggers a Render deployment using the exact upstream commit SHA.
- The workflow also verifies the corresponding Vercel production deployment.

### 8.3 Production Smoke Tests

The Production Smoke Tests workflow verifies:

- Render deployment commit and live state.
- Vercel production deployment commit and ready state.
- Frontend production HTTP response.
- Backend `/health` response.

The workflow uses the GitHub Actions concurrency group `production-deployment` with `cancel-in-progress: false`.

GitHub permits one pending run per concurrency group. A newer pending run can replace an older pending run.

## 9. Current Recorded Status

| Area                           | Recorded status                     |
| ------------------------------ | ----------------------------------- |
| Frontend and backend           | Implemented                         |
| PostgreSQL integration         | Implemented                         |
| Authentication                 | Implemented                         |
| Account workflows              | Implemented                         |
| Credit and debit transactions  | Implemented                         |
| Transaction history and search | Implemented                         |
| CSV export                     | Implemented                         |
| Theme and responsive UI        | Implemented                         |
| CI and branch protection       | Configured                          |
| Vercel and Render deployment   | Configured                          |
| Production smoke tests         | Implemented and reported successful |

Production services were reported healthy after the CI/CD workflow was merged. This is the latest recorded verification, not a live health check performed during this documentation update.

## 10. Future Improvements

The following are potential improvements and are not claimed as implemented:

- Automated rollback and recovery procedures.
- Dedicated staging environment.
- End-to-end browser tests.
- Dependency and security vulnerability scanning.
- Production monitoring and alerting.
- Performance and load testing.
- Backup and restore verification.

## 11. Changelog

| Date             | Version | Change                                                                                                                |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 21 November 2026 | 1.0     | Initial documentation baseline covering the application architecture, implemented features, and CI/CD implementation. |

## 12. Maintenance

Update this document when significant project architecture, features, environment configuration, or operational behavior changes.

Verify technical details against the repository before recording them. Keep detailed endpoint, schema, testing, and deployment information in their respective documents.
