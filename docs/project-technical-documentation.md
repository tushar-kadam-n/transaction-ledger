# Transaction Ledger — Project Technical Documentation

**Version:** 1.0  
**Baseline date:** 21 November 2026  
**Status:** Active development  
**Repository:** `tushar-kadam-n/transaction-ledger`

## 1. Project overview

Transaction Ledger is a full-stack web application for managing financial accounts and recording credit and debit transactions. It supports account-level balance tracking, transaction history, authentication and a dashboard for reviewing financial activity.

This document records the known project baseline. Details that have not been checked against the current repository are explicitly marked as pending verification.

## 2. Technology stack

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| API style | REST |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Source control | Git, GitHub |
| CI/CD | GitHub Actions |

Exact dependency versions must be taken from the current dependency manifests and lockfiles.

## 3. High-level architecture

- React frontend hosted on Vercel.
- Frontend API requests use the `/api` path.
- Vercel proxies API requests to the Render-hosted FastAPI backend.
- Backend implements authentication and ledger business operations.
- SQLAlchemy provides database access.
- Alembic manages database schema migrations.
- PostgreSQL provides persistent storage.

### Production endpoints

- Frontend: https://transaction-ledger-dun.vercel.app
- Backend: https://transaction-ledger-api-pnjv.onrender.com
- Health endpoint: https://transaction-ledger-api-pnjv.onrender.com/health

## 4. Functional areas

### 4.1 Authentication

Known implemented capabilities:
- User registration and email verification
- Login and logout
- Access-token refresh
- Forgot-password flow

Token lifetimes, signing algorithm, authorization dependencies, password policy and email-provider configuration: **Pending repository verification**.

### 4.2 Account management

Known implemented capabilities:
- Create and manage accounts
- Optional contact information
- View account balances
- Associate transactions with accounts

Exact fields, validation rules and update/delete behavior: **Pending repository verification**.

### 4.3 Transaction management

Known implemented capabilities:
- Credit and debit transactions
- Amount, description and reference ID
- Positive-amount validation
- Debit balance validation
- Duplicate reference ID validation scoped to an account

A reference ID may be reused on a different account. Exact transaction atomicity, concurrency controls and database constraints: **Pending repository verification**.

### 4.4 Transaction history and search

Known implemented capabilities:
- View transactions across accounts or for a selected account
- Newest-first ordering
- Transaction search

Exact search fields, matching behavior, pagination defaults and filtering semantics: **Pending repository verification**.

### 4.5 User interface

Known implemented areas:
- Overview
- Accounts
- Transactions
- History
- Theme support
- Responsive layout

## 5. Data and business rules

Known business rules:
1. Transaction amounts must be greater than zero.
2. A debit must not exceed the available account balance.
3. Reference ID duplication is restricted within an account, not globally across all accounts.
4. Account balances must remain consistent with successful transaction operations.

The authoritative schema, numeric precision, indexes, foreign keys, check constraints and transaction isolation behavior must be documented after inspecting current models and migrations.

## 6. Environment separation

| Environment | Known configuration |
|---|---|
| Local development | Local PostgreSQL database named `transaction_ledger`, configured through the local `.env` |
| CI | Disposable PostgreSQL 16 service used by GitHub Actions |
| Production | Hosted deployment configuration and production database settings |

**Important:** Local development must use the local `transaction_ledger` database. Do not connect local development workflows to or modify the hosted production database. Never commit `.env` files or secrets.

## 7. Branching and pull requests

- `main` is the production branch.
- Development work is carried on working/feature branches.
- Changes are proposed to `main` through pull requests.
- A GitHub ruleset protects `main`.
- Required CI checks are `backend` and `frontend`.
- Force pushes and deletion of the protected branch are restricted.

The CI/CD implementation was developed on `CI/CD_Implementation` and merged into `main`.

## 8. CI/CD summary

The CI workflow validates backend and frontend changes.

Backend checks:
- Python 3.10 setup and dependency installation
- PostgreSQL 16 test service
- Alembic migrations
- Automated tests using `pytest`

Frontend checks:
- Node.js 22 setup
- `npm ci`
- `npm run lint`
- `npm run build`

Vercel's native Git integration deploys production from `main`. Render Auto-Deploy is disabled; the production workflow triggers Render after successful CI for the exact upstream commit SHA.

The Production Smoke Tests workflow verifies the Render deployment commit and live state, Vercel production deployment commit and ready state, frontend HTTP response, and backend `/health` response.

The workflow uses the GitHub Actions concurrency group `production-deployment` with `cancel-in-progress: false`. GitHub permits one pending run per concurrency group, so a newer pending run can replace an older pending run.

## 9. Current recorded status

| Area | Recorded status |
|---|---|
| Frontend and backend | Implemented |
| PostgreSQL integration | Implemented |
| Authentication | Implemented |
| Account and transaction workflows | Implemented |
| Transaction history and search | Implemented |
| Theme and responsive UI | Implemented |
| CI and branch protection | Configured |
| Vercel and Render deployment | Configured |
| Production smoke tests | Implemented and reported successful |

The user confirmed production services were healthy after the CI/CD workflow was merged. This is the latest reported verification, not a live check performed during this documentation update.

## 10. Future improvements

Potential work, not claimed as implemented:
- Automated rollback or recovery procedure
- Staging environment
- End-to-end browser tests
- Dependency and security vulnerability scanning
- Production monitoring and alerting
- Performance and load testing

## 11. Changelog

| Date | Version | Change |
|---|---|---|
| 21 November 2026 | 1.0 | Initial documentation baseline covering the known application and CI/CD implementation. |

## 12. Maintenance

Update this document when significant project architecture, features, environment configuration or operational behavior changes. Verify technical details against the repository before recording them.
