# Database Documentation

**Project:** Transaction Ledger  
**Version:** 1.0  
**Status:** Schema inventory pending repository verification

## 1. Purpose

This document records the relational database design, data constraints and migration practices. The current SQLAlchemy models and Alembic migration files are authoritative.

## 2. Database technology

- Database engine: PostgreSQL
- ORM: SQLAlchemy
- Schema migration tool: Alembic
- Local database name: `transaction_ledger`
- CI database: disposable PostgreSQL 16 service
- Production database: hosted configuration; do not use local workflows to inspect or modify it

## 3. Known domain entities

The project includes account and transaction data. User/authentication-related tables also exist or are required by the implemented authentication functionality; the exact table inventory must be verified.

| Entity | Known purpose | Exact schema |
|---|---|---|
| User/authentication | User identity and authentication lifecycle | Pending repository verification |
| Account | Stores account information and balance | Pending repository verification |
| Transaction | Stores credit/debit activity associated with an account | Pending repository verification |

## 4. Relationships and constraints

Known business-level rules:
- Transactions belong to accounts.
- Transaction amount must be positive.
- Debit operations must respect available balance.
- Reference ID uniqueness is scoped to an account.

Exact foreign keys, nullability, unique constraints, indexes, check constraints, cascade rules and numeric precision must be extracted from current models and migrations.

## 5. Schema inventory template

Complete this table from the current schema:

| Table | Column | Type | Nullable | Default | Key/constraint | Description |
|---|---|---|---|---|---|---|
| Pending | Pending | Pending | Pending | Pending | Pending | Pending repository verification |

## 6. Entity relationship diagram

Add an ER diagram after verifying all tables and relationships from SQLAlchemy models and Alembic migrations. Do not infer relationships solely from API behavior.

## 7. Migration practices

- Alembic manages schema changes.
- CI runs `alembic upgrade head` against an isolated PostgreSQL service.
- Migrations should be committed with the application changes that require them.
- Review generated migration scripts before applying them.
- Never run local development migration commands against production unintentionally.

## 8. Data integrity and transaction behavior

Document the actual database and service-layer mechanisms that enforce:
- Account/transaction relationships
- Positive transaction amounts
- Account balance updates
- Duplicate reference ID scope
- Safe concurrent transaction processing

Whether each rule is enforced by database constraints, application validation, or both is pending inspection.

## 9. Environment and data safety

Local development must use the local `transaction_ledger` database via the verified local `.env`. CI must use its disposable database. Production credentials and connection strings must not appear in this document or source control.

## 10. Pending work

- Inspect all SQLAlchemy models.
- Inspect all Alembic revisions.
- List every table and column with types and nullability.
- Record keys, constraints and indexes.
- Create a verified ER diagram.
- Document seed/test data practices and backup/restore arrangements.
