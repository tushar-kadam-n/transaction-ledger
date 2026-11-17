# Transaction Ledger API

A RESTful API built with FastAPI, SQLAlchemy, and PostgreSQL to manage accounts and financial transactions. The API supports account creation, credit and debit transactions, balance retrieval, duplicate transaction prevention, and paginated transaction history.

## Features

- Create accounts with a zero initial balance.
- Credit and debit account balances.
- Reject debits when the account has insufficient funds.
- Prevent duplicate transactions using account-specific reference IDs.
- Retrieve account balances.
- Retrieve transaction history with type filtering and pagination.
- Maintain transaction records without API endpoints for editing or deleting them.
- Protect concurrent balance updates using database transactions and row locking.

## Tech Stack

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Pytest

## Prerequisites

- Python 3.10 or a compatible version for the syntax used in the project.
- PostgreSQL
- pip

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/tushar-kadam-n/transaction-ledger.git
cd transaction-ledger
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

**macOS/Linux**

```bash
source .venv/bin/activate
```

**Windows**

```bash
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Configure PostgreSQL

Create a PostgreSQL database for the application.

Create a `.env` file in the project root and configure your database connection:

```env
DATABASE_URL=postgresql+psycopg://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/transaction_ledger
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=your-verified-sender@example.com
JWT_SECRET_KEY=generate-a-local-random-secret-of-at-least-32-characters
# Optional cookie/CSRF settings; these defaults are suitable for localhost.
REFRESH_COOKIE_NAME=refresh_token
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=X-CSRF-Token
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
COOKIE_PATH=/api/auth
REFRESH_TOKEN_LIFETIME_SECONDS=604800
```

Replace the placeholders with your local PostgreSQL credentials. Do not commit your `.env` file or real credentials to GitHub.
For local email verification links, set `FRONTEND_URL` to your frontend origin
(`http://localhost:5173` for the Vite dev server). Configure `RESEND_API_KEY`
and `EMAIL_FROM` with values from your Resend account; production deployments
must set their own frontend origin and sender configuration.
Generate a local JWT signing secret with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
Keep it private and configure it separately in each environment.

Authentication cookie settings are optional in local development. The refresh
cookie is HttpOnly and the CSRF cookie is readable by the frontend. In a
production HTTPS deployment set `COOKIE_SECURE=true`; `COOKIE_SAMESITE` may be
`strict`, `lax`, or `none` (`none` requires secure cookies). `COOKIE_DOMAIN` is
optional. Cookie settings must be kept consistent when clearing cookies.

Apply pending database migrations before starting the application:

```bash
alembic upgrade head
```

### 5. Start the application

From the project root, run:

```bash
uvicorn app.main:app --reload
```

The API should be available at:

- Base URL: `http://127.0.0.1:8000`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

## API Endpoints

Registration, email verification, login, refresh, logout, forgot-password,
and reset-password are public authentication routes. All account and
transaction data routes require `Authorization: Bearer <access_token>` using
the 15-minute HS256 access token returned by login or refresh. Accounts are
owned by the authenticated user; account creation assigns ownership on the
server. Transactions inherit ownership through their account. Existing
accounts whose `user_id` is null remain unowned and are not exposed or
automatically assigned to a registering user.

| Method | Endpoint                                  | Description                          |
| ------ | ----------------------------------------- | ------------------------------------ |
| POST   | `/api/auth/login`                         | Authenticate and set auth cookies    |
| POST   | `/api/auth/forgot-password`                | Request password reset instructions |
| POST   | `/api/auth/reset-password`                 | Set a new password using a reset token |
| POST   | `/api/auth/refresh`                       | Rotate refresh token and issue access token |
| POST   | `/api/auth/logout`                        | Revoke session and clear auth cookies |
| POST   | `/api/accounts`                           | Create an account                    |
| GET    | `/api/accounts`                           | List the authenticated user's accounts |
| GET    | `/api/accounts/{account_id}/balance`      | Retrieve an account balance          |
| POST   | `/api/accounts/{account_id}/transactions` | Create a credit or debit transaction |
| GET    | `/api/transactions`                       | Retrieve global or filtered history  |
| GET    | `/api/accounts/{account_id}/transactions` | Legacy account-specific history       |

### Transaction History Query Parameters

- `account_id`: Optional account UUID; omit to include all accounts.
- `type`: Optional transaction type — `credit` or `debit`.
- `page`: Page number; defaults to `1`.
- `limit`: Number of records per page; defaults to `10`, maximum `100`.

Example:

```http
GET /api/transactions?type=credit&page=1&limit=10
```

The response includes each transaction's account ID and account name, current page, page size, total records, total pages, and transactions ordered newest first. Add `account_id` to filter to a single account. The account-specific route remains available for existing clients.

## Running Tests

Run the test suite from the project root:

```bash
pytest
```

## Design Notes

- Account balances start at zero and are managed by the application.
- Transaction amounts must be positive.
- Debit transactions cannot exceed the available balance.
- Reference IDs must be unique within an account.
- Account balance updates and transaction creation are performed together to maintain consistency.
- Transaction editing and deletion are not exposed through the API.

## Repository

[GitHub — Transaction Ledger](https://github.com/tushar-kadam-n/transaction-ledger)
