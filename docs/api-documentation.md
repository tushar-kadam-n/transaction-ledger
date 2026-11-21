# API Documentation

**Project:** Transaction Ledger  
**Version:** 1.0  
**Status:** API inventory pending repository verification

## 1. Purpose

This document is the maintained reference for the FastAPI backend. The route inventory and schemas must be extracted from the current backend source and OpenAPI specification before endpoint details are published.

## 2. Base URLs

| Environment | Base URL |
|---|---|
| Production backend | `https://transaction-ledger-api-pnjv.onrender.com` |
| Local development | Pending repository verification |
| CI | Test application/client configuration |

The production frontend uses `/api` as its API path and Vercel proxies requests to the backend.

## 3. API conventions

The backend exposes REST APIs using FastAPI.

The following must be recorded per endpoint:
- HTTP method and path
- Purpose and authentication requirement
- Path, query and body parameters
- Request schema and example
- Success response schema and example
- Error responses and status codes
- Validation rules
- Side effects and database behavior

Exact conventions for error response envelopes, pagination, date/time serialization and API versioning: **Pending repository verification**.

## 4. Known endpoint areas

The application includes API functionality for:
- Authentication: registration, email verification, login, refresh, logout and password recovery
- Accounts: account creation and account retrieval/management
- Transactions: credit/debit creation and transaction retrieval
- Transaction history: account-filtered and all-account history
- Health: service health check

Do not treat this list as a complete route inventory.

## 5. Known endpoint references

| Method | Path | Purpose | Verification |
|---|---|---|---|
| GET | `/health` | Backend health check | Known production endpoint |
| GET | `/api/accounts/{account_id}/balance` | Retrieve account balance | Previously implemented; confirm current router prefix |
| POST | `/api/accounts/{account_id}/transactions` | Create a credit/debit transaction | Previously implemented; confirm current router prefix |

The account and transaction paths above are historical implementation references. Confirm the exact mounted paths in the current FastAPI application before relying on them.

## 6. Authentication

Authentication includes registration, email verification, login, token refresh, logout and password recovery.

The following details must be populated from source code:
- Token type and signing algorithm
- Access and refresh token lifetimes
- Cookie versus authorization-header behavior
- Refresh-token rotation and revocation behavior
- Protected route dependencies
- Password hashing and password policy

Never include real tokens, credentials or secrets in examples.

## 7. Error handling

Document actual status codes and response bodies from route handlers, validation handlers and tests. Do not infer a standard error format without checking implementation.

## 8. Source of truth and update procedure

FastAPI route declarations, Pydantic schemas, dependencies and automated API tests are authoritative. When an endpoint changes:
1. Update this reference.
2. Include request and response examples.
3. Document validation and error cases.
4. Link the related test module where useful.
5. Ensure examples contain no production personal data or secrets.

## 9. Pending work

- Export or inspect the current OpenAPI schema.
- Inventory every mounted route and HTTP method.
- Document request/response schemas and authentication requirements.
- Add representative success and error examples.
- Verify endpoint paths against the deployed API.
