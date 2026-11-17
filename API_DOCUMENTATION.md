# Transaction Ledger API Documentation

## Base URL

`http://127.0.0.1:8000`

Interactive documentation is available at `/docs` when the application is running.

## Authentication: Register

**Endpoint:** `POST /api/auth/register`

Request body:

```json
{
  "email": "person@example.com",
  "password": "at-least-eight-characters",
  "confirm_password": "at-least-eight-characters"
}
```

Email is trimmed and normalized to lowercase. Passwords must be at least eight
characters and the confirmation must match. A successful request creates an
unverified user, stores only an Argon2 password hash and a SHA-256 hash of a
24-hour verification token, then sends a verification link. The raw token is
only included in the email.

The link uses `FRONTEND_URL` as its base, for example
`http://localhost:5173/verify-email?token=...` during local development. Set
`FRONTEND_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` in the environment. Missing
email configuration or delivery failure returns `503` and rolls back the
pending user and token.

Responses: `201 Created` on success, `409 Conflict` for a registered email,
`422 Unprocessable Entity` for invalid input, and `503 Service Unavailable`
when email delivery is unavailable.

## Authentication: Verify email

**Endpoint:** `POST /api/auth/verify-email`

Request body:

```json
{
  "token": "raw-token-from-verification-email"
}
```

A valid, unexpired, unused email-verification token marks the user verified
and is consumed atomically. Invalid, expired, used, or wrong-purpose tokens
return `400 Bad Request`. The token is never returned by the API.

## Authentication: Login

**Endpoint:** `POST /api/auth/login`

Request body:

```json
{
  "email": "person@example.com",
  "password": "your-password"
}
```

Email is trimmed and normalized to lowercase. A verified user's correct
credentials return a signed HS256 JWT access token with a 15-minute lifetime.
The response includes `access_token`, `token_type` (`bearer`), `expires_in`
(seconds), and `expires_at` (UTC ISO 8601). Configure `JWT_SECRET_KEY` with a
private random value of at least 32 characters in the local environment.

Invalid credentials return `401` with a generic message. Correct credentials
for an unverified account return `403`; missing JWT or cookie configuration
returns `503`. Login sets a seven-day HttpOnly refresh cookie and a separate
frontend-readable CSRF cookie. Refresh tokens are never included in JSON.

## Authentication: Refresh

**Endpoint:** `POST /api/auth/refresh`

Send the refresh cookie and include the value of the CSRF cookie in the
configured `CSRF_HEADER_NAME` header (default: `X-CSRF-Token`). A valid request
returns a new 15-minute access token and rotates the refresh token atomically.
The previous refresh token is invalid immediately, so replay or concurrent
reuse of an old token fails. Missing, invalid, expired, revoked, unverified,
or deleted-user sessions return `401`; missing or mismatched CSRF values return
`403`.

## Authentication: Logout

**Endpoint:** `POST /api/auth/logout`

Send the same CSRF header required by refresh. The active refresh session is
revoked and both the refresh and CSRF cookies are cleared. Logout is safe to
repeat and returns success when the refresh cookie is missing or already
invalid; CSRF failures still return `403`.

## Authentication: Forgot password

**Endpoint:** `POST /api/auth/forgot-password`

Request body: `{"email":"person@example.com"}`. Email is trimmed and
lowercased. For every valid address, the API returns the same generic
response. For existing users it emails a single-use reset link; only the
SHA-256 token hash is stored. The token expires after 30 minutes. Delivery
errors do not expose provider details. Configure `FRONTEND_URL`,
`RESEND_API_KEY`, and `EMAIL_FROM` as for verification mail.

## Authentication: Reset password

**Endpoint:** `POST /api/auth/reset-password`

Send `token`, `password`, and `confirm_password`. Passwords must contain at
least eight characters and match. Invalid, expired, or used tokens return a
generic `400`. On success, Argon2 stores the new password, consumes the token,
and revokes all existing refresh sessions transactionally.

## Protected APIs and ownership

Send `Authorization: Bearer <access_token>` on every account and transaction
API request. Missing, invalid, expired, malformed, or unusable-user tokens
return `401`. Account creation assigns ownership server-side. Account listing
and balance access are limited to owned accounts. Transaction creation,
history, search, filtering, pagination, and CSV export are restricted through
account ownership. Another user's account ID returns `404`. Legacy accounts
with null `user_id` remain unchanged and unavailable to authenticated users.

### Authentication environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `REFRESH_COOKIE_NAME` | `refresh_token` | HttpOnly refresh-cookie name |
| `CSRF_COOKIE_NAME` | `csrf_token` | Frontend-readable CSRF-cookie name |
| `CSRF_HEADER_NAME` | `X-CSRF-Token` | Required CSRF request-header name |
| `COOKIE_SECURE` | `false` locally | Set `true` for HTTPS production |
| `COOKIE_SAMESITE` | `lax` | `strict`, `lax`, or `none` |
| `COOKIE_PATH` | `/api/auth` | Path shared by auth cookies |
| `COOKIE_DOMAIN` | unset | Optional cookie domain |
| `REFRESH_TOKEN_LIFETIME_SECONDS` | `604800` | Seven-day refresh lifetime |

`REFRESH_TOKEN_COOKIE_NAME` and `REFRESH_TOKEN_LIFETIME` are accepted aliases
for compatibility. Never put a secret or raw token in source code or logs.

## 1. Create Account

**Endpoint:** `POST /api/accounts`

Creates an account with an initial balance of zero.

Request body:

```json
{
  "name": "Test Account",
  "account_type": "savings",
  "email": "test@example.com",
  "phone": null,
  "description": null
}
```

`account_type` must be one of `savings`, `current`, `cash`, `digital_wallet`, or `business`. Provide at least one of `email` or `phone`; both and `description` are optional. Account names and text fields are trimmed, and the initial balance is always zero.

The response contains account details, balance, and creation timestamp.

Validation errors return `422 Unprocessable Entity`.

## 2. Get Account Balance

**Endpoint:** `GET /api/accounts/{account_id}/balance`

Returns the current balance for the specified account.

Successful response:

```json
{
  "account_id": "ACCOUNT_UUID",
  "balance": "100.00"
}
```

If the account does not exist, the API returns `404 Not Found`.

## 3. Create a Transaction

**Endpoint:** `POST /api/accounts/{account_id}/transactions`

Creates a credit or debit transaction for an existing account.

Credit request example:

```json
{
  "type": "credit",
  "amount": "100.00",
  "description": "Initial deposit",
  "reference_id": "REF-001",
  "transaction_date": "2026-05-14T09:30:00+00:00"
}
```

Debit request example:

```json
{
  "type": "debit",
  "amount": "25.00",
  "description": "Payment",
  "reference_id": "REF-002",
  "transaction_date": "2026-05-14T09:30:00+00:00"
}
```

Expected behavior:

- Amounts must be greater than zero.
- A debit exceeding the available balance is rejected.
- A repeated reference ID for the same account does not create another transaction or change the balance.
- The same reference ID can be used by a different account.
- Successful new transactions return `201 Created`.
- Invalid input returns `422 Unprocessable Entity`.
- A missing account returns `404 Not Found`.
- `transaction_date` must include a timezone offset; the API normalizes it to UTC.

The transaction response includes transaction details, the resulting balance, and a duplicate indicator.

## Timestamp format

All API timestamps are returned as ISO 8601 values in UTC with an explicit
`+00:00` offset, for example `2026-05-14T09:30:00+00:00`. Timestamp inputs
must include an offset. Date filters use UTC calendar dates. CSV transaction
timestamps use `YYYY-MM-DD HH:MM:SS+00:00`.

## 4. Get Transaction History

**Endpoint:** `GET /api/transactions`

Returns all transactions in newest-first order. Use the optional `account_id` query parameter to filter to one account. The legacy endpoint `GET /api/accounts/{account_id}/transactions` remains available and retains its account-scoped response.

Query parameters:

| Parameter | Required | Default   | Description                     |
| --------- | -------- | --------- | ------------------------------- |
| `account_id` | No    | All accounts | Filter by account UUID          |
| `type`    | No       | All types | Filter by `credit` or `debit`   |
| `page`    | No       | `1`       | Page number, minimum `1`        |
| `limit`   | No       | `10`      | Records per page, range `1–100` |

Example:

```http
GET /api/transactions?account_id=ACCOUNT_UUID&type=debit&page=1&limit=10
```

The response includes:

- `account_id`
- `page`
- `limit`
- `total_records`
- `total_pages`
- `transactions`, including `account_id`, `account_name`, type, amount, description, reference ID, and timestamp

An invalid filter or pagination value returns `422 Unprocessable Entity`. A missing account returns `404 Not Found`.

## Error Handling

| Status | Meaning                                        |
| ------ | ---------------------------------------------- |
| `404`  | Account not found                              |
| `422`  | Invalid request or insufficient balance        |
| `409`  | Conflict that cannot be handled as a duplicate |
| `500`  | Unexpected server error                        |

Exact status codes and response bodies depend on the application's implemented exception handlers.

## Data Integrity

- Accounts begin with a zero balance.
- Transaction amounts must be positive.
- Transaction reference IDs are unique per account.
- Account balance changes and transaction creation are handled together.
- Database constraints enforce valid transaction types and positive amounts.
- The API does not provide transaction update or deletion endpoints.
