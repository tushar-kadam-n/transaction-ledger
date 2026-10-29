# Transaction Ledger API Documentation

## Base URL

`http://127.0.0.1:8000`

Interactive documentation is available at `/docs` when the application is running.

## 1. Create Account

**Endpoint:** `POST /api/accounts`

Creates an account with an initial balance of zero.

Request body:

```json
{
  "name": "Test Account"
}
```

Successful response: `201 Created` (if configured by the application).

The response contains the account ID, name, balance, and creation timestamp.

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
  "reference_id": "REF-001"
}
```

Debit request example:

```json
{
  "type": "debit",
  "amount": "25.00",
  "description": "Payment",
  "reference_id": "REF-002"
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

The transaction response includes transaction details, the resulting balance, and a duplicate indicator.

## 4. Get Transaction History

**Endpoint:** `GET /api/accounts/{account_id}/transactions`

Returns transaction history in newest-first order.

Query parameters:

| Parameter | Required | Default   | Description                     |
| --------- | -------- | --------- | ------------------------------- |
| `type`    | No       | All types | Filter by `credit` or `debit`   |
| `page`    | No       | `1`       | Page number, minimum `1`        |
| `limit`   | No       | `10`      | Records per page, range `1–100` |

Example:

```http
GET /api/accounts/ACCOUNT_UUID/transactions?type=debit&page=1&limit=10
```

The response includes:

- `account_id`
- `page`
- `limit`
- `total_records`
- `total_pages`
- `transactions`

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
