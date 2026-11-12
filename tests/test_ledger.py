
import uuid
from datetime import datetime, timezone

import pytest


def create_account(client, name="Alice"):
    response = client.post(
        "/api/accounts",
        json={
            "name": name,
            "account_type": "savings",
            "email": f"{uuid.uuid4()}@example.com",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def transaction_date():
    return datetime.now(timezone.utc).isoformat()


def test_create_account(client):
    account_id = create_account(client)

    response = client.get(
        f"/api/accounts/{account_id}/balance"
    )

    assert response.status_code == 200
    assert float(response.json()["balance"]) == 0.0


def test_credit_and_debit(client):
    account_id = create_account(client)

    credit = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "credit",
            "amount": "100.00",
            "description": "Deposit",
            "reference_id": f"CREDIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    assert credit.status_code == 201
    assert float(credit.json()["balance"]) == 100.0

    debit = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "30.00",
            "description": "Withdrawal",
            "reference_id": f"DEBIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    assert debit.status_code == 201
    assert float(debit.json()["balance"]) == 70.0


def test_transaction_dates_are_stored_and_returned_in_history(client):
    account_id = create_account(client)
    current_date = transaction_date()
    past_date = "2020-01-02T03:04:05+00:00"

    current = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "credit",
            "amount": "40.00",
            "description": "Current transaction",
            "reference_id": f"DATE-CURRENT-{uuid.uuid4()}",
            "transaction_date": current_date,
        },
    )
    past = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "credit",
            "amount": "5.00",
            "description": "Past transaction",
            "reference_id": f"DATE-PAST-{uuid.uuid4()}",
            "transaction_date": past_date,
        },
    )

    assert current.status_code == past.status_code == 201
    assert datetime.fromisoformat(
        current.json()["transaction"]["transaction_date"]
    ) == datetime.fromisoformat(current_date)
    assert datetime.fromisoformat(
        past.json()["transaction"]["transaction_date"]
    ) == datetime.fromisoformat(past_date)
    assert float(past.json()["balance"]) == 45.0

    history = client.get(f"/api/transactions?account_id={account_id}").json()
    history_by_description = {
        row["description"]: row for row in history["transactions"]
    }
    assert datetime.fromisoformat(
        history_by_description["Past transaction"]["transaction_date"]
    ) == datetime.fromisoformat(past_date)
    assert float(
        client.get(f"/api/accounts/{account_id}/balance").json()["balance"]
    ) == 45.0


def test_insufficient_balance(client):
    account_id = create_account(client)

    response = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "50.00",
            "description": "Withdrawal",
            "reference_id": f"DEBIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    assert response.status_code == 422

    balance = client.get(
        f"/api/accounts/{account_id}/balance"
    )
    assert float(balance.json()["balance"]) == 0.0

    history = client.get(f"/api/accounts/{account_id}/transactions")
    assert history.status_code == 200
    assert history.json()["total_records"] == 0


def test_debit_equal_to_current_balance_is_allowed(client):
    account_id = create_account(client)
    credit = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "credit",
            "amount": "25.00",
            "description": "Deposit",
            "reference_id": f"EQUAL-CREDIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )
    assert credit.status_code == 201

    debit = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "25.00",
            "description": "Full withdrawal",
            "reference_id": f"EQUAL-DEBIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    assert debit.status_code == 201
    assert float(debit.json()["balance"]) == 0.0


def test_duplicate_reference_does_not_change_balance(client):
    account_id = create_account(client)

    payload = {
        "type": "credit",
        "amount": "100.00",
        "description": "Deposit",
        "reference_id": f"DUPLICATE-{uuid.uuid4()}",
        "transaction_date": transaction_date(),
    }

    first = client.post(
        f"/api/accounts/{account_id}/transactions",
        json=payload,
    )
    second = client.post(
        f"/api/accounts/{account_id}/transactions",
        json=payload,
    )

    assert first.status_code == 201
    assert second.json()["duplicate"] is True

    balance = client.get(
        f"/api/accounts/{account_id}/balance"
    )
    assert float(balance.json()["balance"]) == 100.0


def test_transaction_history_filter(client):
    account_id = create_account(client)

    client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "credit",
            "amount": "20.00",
            "description": "Deposit",
            "reference_id": f"HISTORY-CREDIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "10.00",
            "description": "Withdrawal",
            "reference_id": f"HISTORY-DEBIT-{uuid.uuid4()}",
            "transaction_date": transaction_date(),
        },
    )

    all_response = client.get(
        f"/api/accounts/{account_id}/transactions"
    )
    credit_response = client.get(
        f"/api/accounts/{account_id}/transactions?type=credit"
    )
    debit_response = client.get(
        f"/api/accounts/{account_id}/transactions?type=debit"
    )

    assert all_response.status_code == 200
    assert all_response.json()["total_records"] == 2

    assert credit_response.status_code == 200
    assert all(
        tx["type"] == "credit"
        for tx in credit_response.json()["transactions"]
    )

    assert debit_response.status_code == 200
    assert all(
        tx["type"] == "debit"
        for tx in debit_response.json()["transactions"]
    )


def test_unified_transaction_history_filters_and_paginates(client):
    account_a = create_account(client, "History Account A")
    account_b = create_account(client, "History Account B")

    transaction_specs = [
        (account_a, "credit", "10.00", "A initial credit"),
        (account_a, "debit", "2.00", "A debit"),
        (account_a, "credit", "3.00", "A newest credit"),
        (account_b, "credit", "5.00", "B credit"),
    ]
    for account_id, transaction_type, amount, description in transaction_specs:
        response = client.post(
            f"/api/accounts/{account_id}/transactions",
            json={
                "type": transaction_type,
                "amount": amount,
                "description": description,
                "reference_id": f"UNIFIED-{uuid.uuid4()}",
                "transaction_date": transaction_date(),
            },
        )
        assert response.status_code == 201

    all_history = client.get("/api/transactions?limit=100").json()
    global_rows = {
        row["description"]: row for row in all_history["transactions"]
    }
    assert {
        "A initial credit",
        "A debit",
        "A newest credit",
        "B credit",
    } <= global_rows.keys()
    assert global_rows["A debit"]["account_name"] == "History Account A"
    assert global_rows["B credit"]["account_name"] == "History Account B"
    assert "account_id" in global_rows["B credit"]

    account_page_one = client.get(
        f"/api/transactions?account_id={account_a}&page=1&limit=2"
    ).json()
    account_page_two = client.get(
        f"/api/transactions?account_id={account_a}&page=2&limit=2"
    ).json()
    assert account_page_one["total_records"] == 3
    assert account_page_one["total_pages"] == 2
    assert len(account_page_one["transactions"]) == 2
    assert len(account_page_two["transactions"]) == 1
    assert account_page_one["transactions"][0]["description"] == "A newest credit"

    debit_history = client.get(
        f"/api/transactions?account_id={account_a}&type=debit"
    ).json()
    assert debit_history["total_records"] == 1
    assert debit_history["transactions"][0]["description"] == "A debit"

    credit_history = client.get("/api/transactions?type=credit&limit=100").json()
    assert all(row["type"] == "credit" for row in credit_history["transactions"])

    legacy_response = client.get(
        f"/api/accounts/{account_a}/transactions"
    ).json()
    assert legacy_response["account_id"] == account_a
    assert len(legacy_response["transactions"]) == 3


def test_account_creation_rejects_client_balance(client):
    response = client.post(
        "/api/accounts",
        json={"name": "Bob", "balance": 5000},
    )

    assert response.status_code == 422


def test_duplicate_reference_on_different_accounts(client):
    account_one = create_account(client, "Alice")
    account_two = create_account(client, "Bob")

    payload = {
        "type": "credit",
        "amount": "100.00",
        "description": "Deposit",
        "reference_id": f"SHARED-{uuid.uuid4()}",
        "transaction_date": transaction_date(),
    }

    first = client.post(
        f"/api/accounts/{account_one}/transactions",
        json=payload,
    )
    second = client.post(
        f"/api/accounts/{account_two}/transactions",
        json=payload,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["duplicate"] is False

    balance_one = client.get(
        f"/api/accounts/{account_one}/balance"
    )
    balance_two = client.get(
        f"/api/accounts/{account_two}/balance"
    )

    assert float(balance_one.json()["balance"]) == 100.0
    assert float(balance_two.json()["balance"]) == 100.0


def test_missing_account_returns_404(client):
    missing_id = uuid.uuid4()

    response = client.get(
        f"/api/accounts/{missing_id}/balance"
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "contact_fields",
    [
        {"email": "only-email@example.com"},
        {"phone": "+1 (555) 123-4567"},
        {"email": "both@example.com", "phone": "5551234567"},
    ],
)
def test_create_account_with_contact_details(client, contact_fields):
    response = client.post(
        "/api/accounts",
        json={
            "name": "  Contact account  ",
            "account_type": "digital_wallet",
            "description": "  Primary account  ",
            **contact_fields,
        },
    )

    assert response.status_code == 201
    result = response.json()
    assert result["name"] == "Contact account"
    assert result["account_type"] == "digital_wallet"
    assert float(result["balance"]) == 0.0
    assert result["email"] == contact_fields.get("email")
    assert result["phone"] == contact_fields.get("phone")
    assert result["description"] == "Primary account"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "No contact", "account_type": "savings"},
        {
            "name": "Bad email",
            "account_type": "savings",
            "email": "not-an-email",
        },
        {
            "name": "Bad phone",
            "account_type": "savings",
            "phone": "12-abc",
        },
        {
            "name": "No type",
            "email": "valid@example.com",
        },
        {
            "account_type": "savings",
            "email": "valid@example.com",
        },
    ],
)
def test_create_account_validation(client, payload):
    response = client.post("/api/accounts", json=payload)
    assert response.status_code == 422
