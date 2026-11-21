# Software Requirements Specification (SRS)

**Project:** Transaction Ledger  
**Version:** 1.0  
**Status:** Initial baseline — requirements to be reconciled with repository implementation

## 1. Purpose

This document describes the known product scope and business requirements for Transaction Ledger. It is intended to guide implementation and testing. Requirements marked for verification must be checked against the current application before being treated as acceptance criteria.

## 2. Product scope

Transaction Ledger is a web application that allows authenticated users to manage accounts, record credits and debits, inspect balances and search transaction history.

Out of scope unless explicitly added later:
- Multi-currency ledger behavior
- Banking/payment-network integration
- Automated movement of real money
- Accounting or tax compliance certification

## 3. User and access model

The application includes user registration and authentication. Whether users can belong to organizations, share accounts, or hold different roles is **Pending repository verification**.

## 4. Functional requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | The system shall support user registration. | Implemented; verify exact flow |
| FR-002 | The system shall support email verification. | Implemented; verify exact flow |
| FR-003 | The system shall allow users to log in and log out. | Implemented |
| FR-004 | The system shall support access-token refresh. | Implemented |
| FR-005 | The system shall support a forgot-password flow. | Implemented; verify exact flow |
| FR-006 | The system shall allow account creation. | Implemented |
| FR-007 | The system shall allow optional contact information for an account. | Implemented |
| FR-008 | The system shall display account balances. | Implemented |
| FR-009 | The system shall record credit and debit transactions. | Implemented |
| FR-010 | The system shall require transaction amounts greater than zero. | Implemented |
| FR-011 | The system shall reject a debit greater than the available account balance. | Implemented |
| FR-012 | Duplicate reference IDs shall be restricted within the same account. | Implemented |
| FR-013 | A reference ID may be reused on a different account. | Implemented |
| FR-014 | The system shall show transaction history for all accounts when no account filter is selected. | Implemented; verify current API/UI behavior |
| FR-015 | The system shall show account-specific history when an account is selected. | Implemented |
| FR-016 | Transaction history shall be ordered newest first. | Implemented |
| FR-017 | The system shall provide transaction search. | Implemented; search semantics pending verification |
| FR-018 | The user interface shall provide theme support. | Implemented |
| FR-019 | The user interface shall support responsive layouts. | Implemented |

## 5. Business rules

- **BR-001:** Transaction amount must be strictly greater than zero.
- **BR-002:** A debit cannot exceed the account's available balance.
- **BR-003:** Reference ID uniqueness is scoped to an account.
- **BR-004:** A transaction must be associated with a valid account.
- **BR-005:** Successful transaction processing must preserve balance consistency.

Atomicity, simultaneous transaction handling, reversal behavior, and whether transactions can be edited or deleted require repository verification.

## 6. Non-functional requirements

These are quality goals; measurable targets should be agreed before claiming compliance.

| ID | Requirement | Acceptance measure |
|---|---|---|
| NFR-001 | Security | Authentication and authorization checks verified by tests and code review |
| NFR-002 | Data integrity | Database constraints and transaction behavior verified |
| NFR-003 | Maintainability | Clear separation of frontend, backend and persistence concerns |
| NFR-004 | Testability | Automated backend and frontend checks run in CI |
| NFR-005 | Deployability | Production deployments are automated and verified |
| NFR-006 | Usability | Core workflows are understandable and responsive |
| NFR-007 | Reliability | Production health checks detect basic service availability |

Performance, accessibility, browser support, uptime and recovery objectives are **Not yet specified**.

## 7. Assumptions and constraints

- The application is currently single-currency.
- Local development uses the local PostgreSQL database `transaction_ledger`.
- CI uses an isolated PostgreSQL service.
- Production runs on Vercel and Render.
- Secrets must be supplied through environment configuration and must not be committed.
- Exact user ownership and authorization boundaries must be verified from backend routes and dependencies.

## 8. Acceptance and change control

A requirement is considered complete only when:
1. The implementation exists.
2. Relevant automated or manual tests verify the expected behavior.
3. The behavior is documented accurately.
4. Any deployment/configuration impact is handled.

Changes to scope or business rules should update this document and corresponding tests.
