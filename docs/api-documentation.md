# Transaction Ledger API Documentation

**Version:** 1.1
**API Version:** 1.0.0
**Framework:** FastAPI
**Base URL (Production):** `https://transaction-ledger-api-pnjv.onrender.com`
**Local Base URL:** `http://localhost:8000`

---

## 1. Overview

The Transaction Ledger API provides endpoints for user authentication, account management, transaction processing, transaction history, and CSV export.

The API is built using FastAPI and uses PostgreSQL for persistent data storage.

### API Groups

| Group               | Prefix             | Purpose                                                        |
| ------------------- | ------------------ | -------------------------------------------------------------- |
| Authentication      | `/api/auth`        | Registration, email verification, login and session management |
| Accounts            | `/api/accounts`    | Account creation, listing and balance retrieval                |
| Transactions        | `/api/accounts`    | Transaction creation and account-specific history              |
| Transaction History | `/api`             | Consolidated transaction history and CSV export                |
| Health              | `/health`          | Application health                                             |
| Database Health     | `/health/database` | Database connectivity check                                    |

## 2. Authentication

Protected endpoints use Bearer authentication.

Include the access token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### 2.1 Access Tokens

- Access tokens are JWTs signed using HS256.
- The token contains the user's UUID as the subject (`sub`), issued-at (`iat`) and expiration (`exp`) claims.
- Access tokens expire after 15 minutes.
- Protected endpoints validate the token and verify that the associated user exists and has verified their email.

### 2.2 Refresh Sessions

Refresh tokens are issued in an HTTP cookie and stored in the database as SHA-256 hashes.

- Default refresh-token lifetime: 7 days.
- Refresh tokens are rotated when the refresh endpoint is called.
- Previous refresh-token hashes are replaced during rotation.
- Logout revokes the associated refresh session.
- Password reset revokes all active refresh sessions belonging to the user.

### 2.3 CSRF Protection

The refresh and logout endpoints use a double-submit cookie mechanism.

The client must send the CSRF token in the configured request header. By default, the header is:

```http
X-CSRF-Token: <csrf_token>
```

The header value must match the CSRF cookie value.

### 2.4 Cookie Configuration

Cookie settings are configurable through environment variables.

| Variable                         | Default / Behavior                               |
| -------------------------------- | ------------------------------------------------ |
| `REFRESH_COOKIE_NAME`            | `refresh_token`                                  |
| `REFRESH_TOKEN_COOKIE_NAME`      | Fallback refresh-cookie name                     |
| `CSRF_COOKIE_NAME`               | `csrf_token`                                     |
| `CSRF_HEADER_NAME`               | `X-CSRF-Token`                                   |
| `COOKIE_PATH`                    | `/api/auth`                                      |
| `COOKIE_SAMESITE`                | `lax`                                            |
| `COOKIE_DOMAIN`                  | Empty / unset                                    |
| `COOKIE_SECURE`                  | Derived from `APP_ENV` if unset                  |
| `APP_ENV`                        | Defaults to `local`                              |
| `REFRESH_TOKEN_LIFETIME_SECONDS` | Takes precedence when supplied                   |
| `REFRESH_TOKEN_LIFETIME`         | Fallback lifetime in seconds; defaults to 604800 |

`COOKIE_SAMESITE=none` requires secure cookies.

## 3. Authentication Endpoints

All authentication endpoints use the `/api/auth` prefix.

### 3.1 Register

**Endpoint:** `POST /api/auth/register`

Creates an unverified user account and sends an email verification link.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirm_password": "password123"
}
```

**Validation**

- Email must be valid and between 3 and 254 characters.
- Email is trimmed and converted to lowercase.
- Password must contain at least 8 characters.
- Password and confirmation must match.
- Password fields are handled as secret values by Pydantic.

**Responses**

- `201 Created` — Registration successful.
- `409 Conflict` — Email already registered or duplicate registration detected.
- `503 Service Unavailable` — Email delivery or configuration failure.

### 3.2 Verify Email

**Endpoint:** `POST /api/auth/verify-email`

Verifies a user's email using the verification token.

**Request Body**

```json
{
  "token": "<verification_token>"
}
```

**Behavior**

- The token is hashed before lookup.
- The token must be for email verification.
- Used or expired tokens are rejected.
- Successful verification updates the user's verification status and timestamp.

**Responses**

- `200 OK` — Email verified successfully.
- `400 Bad Request` — Invalid, expired or already-used verification token.

### 3.3 Login

**Endpoint:** `POST /api/auth/login`

Authenticates a user and creates an access token and refresh session.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response — `200 OK`**

```json
{
  "access_token": "<access_token>",
  "token_type": "bearer",
  "expires_in": 900,
  "expires_at": "2026-11-21T12:15:00+00:00"
}
```

The response also sets the refresh-token and CSRF cookies.

**Responses**

- `200 OK` — Login successful.
- `401 Unauthorized` — Invalid email or password.
- `403 Forbidden` — Email address has not been verified.
- `503 Service Unavailable` — Authentication configuration or session creation failure.

### 3.4 Refresh Access Token

**Endpoint:** `POST /api/auth/refresh`

Issues a new access token and rotates the refresh token.

**Requirements**

- A valid refresh-token cookie.
- A CSRF cookie.
- A matching CSRF request header.

**Behavior**

- Locks the refresh-session row while processing.
- Rejects missing, revoked or expired sessions.
- Verifies that the associated user exists and is verified.
- Rotates the stored refresh-token hash.
- Updates the session's last-used timestamp.

**Responses**

- `200 OK` — Tokens refreshed successfully.
- `401 Unauthorized` — Missing, invalid, revoked or expired refresh session.
- `403 Forbidden` — CSRF validation failure.
- `503 Service Unavailable` — Authentication configuration failure.

The response also updates the authentication cookies.

### 3.5 Logout

**Endpoint:** `POST /api/auth/logout`

Revokes the current refresh session and clears authentication cookies.

**Requirements**

- CSRF cookie and matching CSRF request header.

**Success Response — `200 OK`**

```json
{
  "message": "Logged out successfully."
}
```

Logout does not require an access JWT. If a refresh session is present and has not already been revoked, it is marked as revoked.

### 3.6 Forgot Password

**Endpoint:** `POST /api/auth/forgot-password`

Initiates the password-reset process.

**Request Body**

```json
{
  "email": "user@example.com"
}
```

**Behavior**

- Email is normalized to lowercase.
- Existing unused password-reset tokens are invalidated.
- A new reset token is generated and stored as a hash.
- The token expires after 30 minutes.
- A reset email is sent when the account exists.
- The response does not disclose whether the supplied email is registered.

**Success Response**

The endpoint returns the same safe response whether or not the email exists.

### 3.7 Reset Password

**Endpoint:** `POST /api/auth/reset-password`

Resets the user's password using a valid password-reset token.

**Request Body**

```json
{
  "token": "<password_reset_token>",
  "password": "newpassword123",
  "confirm_password": "newpassword123"
}
```

**Validation**

- Password must contain at least 8 characters.
- Password and confirmation must match.
- Reset token must be valid, unused and unexpired.

**Behavior**

- Updates the password hash.
- Marks the reset token as used.
- Revokes all active refresh sessions for the user.

**Responses**

- `200 OK` — Password reset successful.
- `400 Bad Request` — Invalid, expired or already-used token.
- `503 Service Unavailable` — Internal password-reset failure.

## 4. Account Endpoints

All account endpoints require authentication and operate only on accounts owned by the authenticated user.

### 4.1 Create Account

**Endpoint:** `POST /api/accounts`

**Request Body**

```json
{
  "name": "Savings Account",
  "account_type": "savings",
  "email": "contact@example.com",
  "phone": null,
  "description": "Personal savings account"
}
```

**Supported Account Types**

- `savings`
- `current`
- `cash`
- `digital_wallet`
- `business`

**Validation**

| Field          | Rules                                                |
| -------------- | ---------------------------------------------------- |
| `name`         | Required, 1–150 characters                           |
| `account_type` | Required, one of the supported account types         |
| `email`        | Optional, maximum 254 characters, valid email format |
| `phone`        | Optional, maximum 32 characters, valid phone format  |
| `description`  | Optional, maximum 2,000 characters                   |

At least one of `email` or `phone` must be provided.

Unknown request fields are rejected. Text fields are trimmed.

**Success Response — `201 Created`**

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "name": "Savings Account",
  "account_type": "savings",
  "email": "contact@example.com",
  "phone": null,
  "description": "Personal savings account",
  "balance": "0.00",
  "created_at": "2026-11-21T10:00:00+00:00"
}
```

The UUID and timestamp above are illustrative.

### 4.2 List Accounts

**Endpoint:** `GET /api/accounts`

Returns accounts belonging to the authenticated user.

**Success Response — `200 OK`**

Returns an array of account objects using the `AccountResponse` schema.

Accounts are ordered by creation time, newest first.

### 4.3 Get Account Balance

**Endpoint:** `GET /api/accounts/{account_id}/balance`

Returns the balance of a specific account owned by the authenticated user.

**Success Response — `200 OK`**

```json
{
  "account_id": "00000000-0000-0000-0000-000000000001",
  "balance": "1250.00"
}
```

**Responses**

- `200 OK` — Balance retrieved successfully.
- `404 Not Found` — Account does not exist or does not belong to the authenticated user.

## 5. Transaction Endpoints

### 5.1 Create Transaction

**Endpoint:** `POST /api/accounts/{account_id}/transactions`

Creates a credit or debit transaction for an account owned by the authenticated user.

**Request Body**

```json
{
  "type": "credit",
  "amount": "500.00",
  "description": "Monthly deposit",
  "reference_id": "REF-001",
  "transaction_date": "2026-11-21T10:30:00+05:30"
}
```

**Validation**

| Field              | Rules                                                               |
| ------------------ | ------------------------------------------------------------------- |
| `type`             | Required: `credit` or `debit`                                       |
| `amount`           | Required, greater than zero, maximum 18 digits and 2 decimal places |
| `description`      | Required, 1–2,000 characters                                        |
| `reference_id`     | Required, 1–255 characters                                          |
| `transaction_date` | Required, timezone-aware datetime                                   |

Unknown request fields are rejected.

Transaction timestamps are normalized to UTC. A timestamp without a timezone is rejected.

**Successful Creation — `201 Created`**

```json
{
  "message": "Transaction created successfully",
  "duplicate": false,
  "transaction": {
    "id": "00000000-0000-0000-0000-000000000002",
    "account_id": "00000000-0000-0000-0000-000000000001",
    "type": "credit",
    "amount": "500.00",
    "description": "Monthly deposit",
    "reference_id": "REF-001",
    "transaction_date": "2026-11-21T05:00:00+00:00",
    "created_at": "2026-11-21T05:00:01+00:00"
  },
  "balance": "1750.00"
}
```

**Duplicate Transaction — `200 OK`**

```json
{
  "message": "Transaction already exists",
  "duplicate": true,
  "transaction": {
    "id": "00000000-0000-0000-0000-000000000002",
    "account_id": "00000000-0000-0000-0000-000000000001",
    "type": "credit",
    "amount": "500.00",
    "description": "Monthly deposit",
    "reference_id": "REF-001",
    "transaction_date": "2026-11-21T05:00:00+00:00",
    "created_at": "2026-11-21T05:00:01+00:00"
  },
  "balance": "1750.00"
}
```

**Transaction Processing Behavior**

- The account row is locked during transaction processing.
- Duplicate references are checked within the account.
- A duplicate request returns the existing transaction instead of creating another one.
- Debits are rejected when the account has insufficient balance.
- The account balance update and transaction insertion are committed together.
- Database integrity errors are handled with a duplicate-reference recheck.

**Responses**

- `201 Created` — Transaction created.
- `200 OK` — Duplicate transaction detected.
- `404 Not Found` — Account does not exist or is not owned by the user.
- `422 Unprocessable Entity` — Invalid request or insufficient balance.
- `409 Conflict` — Other transaction integrity conflict.

### 5.2 Get Account Transaction History

**Endpoint:** `GET /api/accounts/{account_id}/transactions`

Returns transaction history for a specific account.

**Query Parameters**

| Parameter | Type                | Default | Description                              |
| --------- | ------------------- | ------- | ---------------------------------------- |
| `type`    | `credit` or `debit` | None    | Filter by transaction type               |
| `page`    | Integer             | `1`     | Page number, minimum 1                   |
| `limit`   | Integer             | `10`    | Records per page, minimum 1, maximum 100 |

**Example**

```http
GET /api/accounts/{account_id}/transactions?type=credit&page=1&limit=10
```

**Success Response — `200 OK`**

```json
{
  "account_id": "00000000-0000-0000-0000-000000000001",
  "page": 1,
  "limit": 10,
  "total_records": 25,
  "total_pages": 3,
  "transactions": []
}
```

The `transactions` array contains `TransactionResponse` objects.

Transactions are returned newest first.

### 5.3 Get Consolidated Transaction History

**Endpoint:** `GET /api/transactions`

Returns transaction history across all accounts owned by the authenticated user, or for a selected account.

**Query Parameters**

| Parameter    | Type                | Default | Description                                       |
| ------------ | ------------------- | ------- | ------------------------------------------------- |
| `account_id` | UUID                | None    | Filter by account                                 |
| `type`       | `credit` or `debit` | None    | Filter by transaction type                        |
| `search`     | String              | None    | Search description, reference ID and account name |
| `start_date` | Date                | None    | Inclusive start date                              |
| `end_date`   | Date                | None    | Inclusive end date                                |
| `page`       | Integer             | `1`     | Page number, minimum 1                            |
| `limit`      | Integer             | `10`    | Records per page, minimum 1, maximum 100          |

**Examples**

All accounts:

```http
GET /api/transactions
```

Specific account:

```http
GET /api/transactions?account_id=<account_uuid>
```

Search and filter:

```http
GET /api/transactions?type=debit&search=rent&page=1&limit=10
```

Date range:

```http
GET /api/transactions?start_date=2026-11-01&end_date=2026-11-21
```

**Success Response — `200 OK`**

```json
{
  "page": 1,
  "limit": 10,
  "total_records": 25,
  "total_pages": 3,
  "transactions": [
    {
      "id": "00000000-0000-0000-0000-000000000002",
      "account_id": "00000000-0000-0000-0000-000000000001",
      "type": "credit",
      "amount": "500.00",
      "description": "Monthly deposit",
      "reference_id": "REF-001",
      "transaction_date": "2026-11-21T05:00:00+00:00",
      "created_at": "2026-11-21T05:00:01+00:00",
      "account_name": "Savings Account"
    }
  ]
}
```

**Behavior**

- Without `account_id`, returns matching transactions across all accounts owned by the user.
- With `account_id`, returns matching transactions for that account only.
- Search checks transaction description, reference ID and account name.
- Date filters use UTC calendar-day boundaries.
- Results are ordered by `created_at` descending, with transaction ID descending as a tie-breaker.
- Pagination metadata is included in the response.

## 6. Transaction CSV Export

### 6.1 Export Transactions

**Endpoint:** `GET /api/transactions/export`

Exports matching transaction history as a CSV file.

**Authentication:** Required.

**Supported Query Parameters**

| Parameter    | Type                | Description                                       |
| ------------ | ------------------- | ------------------------------------------------- |
| `account_id` | UUID                | Filter by account                                 |
| `type`       | `credit` or `debit` | Filter by transaction type                        |
| `search`     | String              | Search description, reference ID and account name |
| `start_date` | Date                | Inclusive start date                              |
| `end_date`   | Date                | Inclusive end date                                |

The filters follow the same behavior as consolidated transaction history.

**Example**

```http
GET /api/transactions/export?type=credit&start_date=2026-11-01&end_date=2026-11-21
```

**Response**

- Returns a CSV file.
- Content type: `text/csv`.
- Filename: `transactions.csv`.
- UTF-8 BOM is included for spreadsheet compatibility.
- Exports all matching records without pagination.

**CSV Columns**

1. Sr No
2. Account Name
3. Transaction Date & Time
4. Type
5. Amount
6. Description
7. Reference ID

Amounts are formatted with the ₹ symbol and two decimal places.

Spreadsheet formula injection protection is applied to account names, descriptions and reference IDs by prefixing potentially dangerous values with an apostrophe.

## 7. Health Endpoints

### 7.1 Application Health

**Endpoint:** `GET /health`

Checks whether the application is responding.

**Success Response — `200 OK`**

```json
{
  "status": "ok"
}
```

### 7.2 Database Health

**Endpoint:** `GET /health/database`

Checks database connectivity by executing a simple SQL query.

**Success Response — `200 OK`**

```json
{
  "status": "ok",
  "database": "connected"
}
```

## 8. Common HTTP Status Codes

| Status                     | Meaning                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `200 OK`                   | Request completed successfully                               |
| `201 Created`              | Resource successfully created                                |
| `400 Bad Request`          | Invalid or unusable token                                    |
| `401 Unauthorized`         | Missing or invalid authentication                            |
| `403 Forbidden`            | Email verification or CSRF requirement not satisfied         |
| `404 Not Found`            | Requested resource not found or not accessible               |
| `409 Conflict`             | Duplicate resource or integrity conflict                     |
| `422 Unprocessable Entity` | Request validation failed or transaction cannot be processed |
| `503 Service Unavailable`  | Required service or configuration unavailable                |

### Validation Error Format

Authentication endpoints under `/api/auth/` use a custom validation handler that returns sanitized validation details:

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "email"],
      "msg": "Enter a valid email address."
    }
  ]
}
```

Other endpoints use FastAPI's default request-validation error handling.

## 9. Data Formats and Conventions

### Identifiers

- Resource identifiers use UUIDs.
- Account and transaction IDs are returned in API responses.

### Monetary Values

- Monetary values use decimal precision.
- Transaction amounts support up to two decimal places.
- API examples represent monetary values as decimal strings.

### Timestamps

- Timestamps use ISO 8601 format.
- Transaction input timestamps must include a timezone.
- Input timestamps are converted to UTC.
- Account and transaction response timestamps are serialized in UTC.

### Date Filters

- `start_date` is inclusive.
- `end_date` includes the entire requested calendar day.
- Date filtering is evaluated using UTC day boundaries.

## 10. CORS Configuration

CORS is configured through `FRONTEND_ORIGINS`.

- Multiple origins can be supplied as comma-separated values.
- Blank entries and wildcard-containing origins are excluded.
- If no allowed origins remain, the application falls back to `http://localhost:5173`.
- Allowed methods: `GET`, `POST`.
- Allowed headers: `Content-Type`, `Authorization`, and the configured CSRF header.

## 11. API Documentation Interface

FastAPI provides an interactive API documentation interface.

When the application is running locally:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI schema: `http://localhost:8000/openapi.json`

These interfaces expose the generated API schema and can be used to inspect and test endpoints.

## 12. Current API Scope

The inspected account and transaction routers expose create, read, history and export operations.

No account or transaction update or deletion endpoints were present in the inspected route implementations.

This document describes the API behavior verified from the supplied application routes, schemas and authentication service. It should be updated when endpoint contracts or implementation behavior change.
