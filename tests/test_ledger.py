
import uuid

import pytest


def create_account(client, name="Alice"):
    response = client.post(
        "/api/accounts",
        json={"name": name},
    )
    assert response.status_code == 201
    return response.json()["id"]


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
        },
    )

    assert debit.status_code == 201
    assert float(debit.json()["balance"]) == 70.0


def test_insufficient_balance(client):
    account_id = create_account(client)

    response = client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "50.00",
            "description": "Withdrawal",
            "reference_id": f"DEBIT-{uuid.uuid4()}",
        },
    )

    assert response.status_code == 422

    balance = client.get(
        f"/api/accounts/{account_id}/balance"
    )
    assert float(balance.json()["balance"]) == 0.0


def test_duplicate_reference_does_not_change_balance(client):
    account_id = create_account(client)

    payload = {
        "type": "credit",
        "amount": "100.00",
        "description": "Deposit",
        "reference_id": f"DUPLICATE-{uuid.uuid4()}",
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
        },
    )

    client.post(
        f"/api/accounts/{account_id}/transactions",
        json={
            "type": "debit",
            "amount": "10.00",
            "description": "Withdrawal",
            "reference_id": f"HISTORY-DEBIT-{uuid.uuid4()}",
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
    assert all_response.json()["count"] == 2

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
