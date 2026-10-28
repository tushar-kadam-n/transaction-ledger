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
```

Replace the placeholders with your local PostgreSQL credentials. Do not commit your `.env` file or real credentials to GitHub.

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

| Method | Endpoint                                  | Description                          |
| ------ | ----------------------------------------- | ------------------------------------ |
| POST   | `/api/accounts`                           | Create an account                    |
| GET    | `/api/accounts/{account_id}/balance`      | Retrieve an account balance          |
| POST   | `/api/accounts/{account_id}/transactions` | Create a credit or debit transaction |
| GET    | `/api/accounts/{account_id}/transactions` | Retrieve transaction history         |

### Transaction History Query Parameters

- `type`: Optional transaction type — `credit` or `debit`.
- `page`: Page number; defaults to `1`.
- `limit`: Number of records per page; defaults to `10`, maximum `100`.

Example:

```http
GET /api/accounts/{account_id}/transactions?type=credit&page=1&limit=10
```

The response includes the account ID, current page, page size, total records, total pages, and transactions ordered newest first.

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
