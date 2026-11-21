# Project Documentation

This directory is the single source of truth for project documentation.

## Documents

| Document                                                                      | Purpose                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Project technical documentation](project-technical-documentation.md)         | Overview, architecture, technology stack and project status   |
| [Software requirements specification](software-requirements-specification.md) | Functional and non-functional requirements and business rules |
| [API documentation](api-documentation.md)                                     | Backend API reference                                         |
| [Database documentation](database-documentation.md)                           | Schema, relationships, constraints and migrations             |
| [Testing documentation](testing-documentation.md)                             | Testing strategy, tools, environments and CI validation       |
| [Deployment and DevOps documentation](deployment-devops-documentation.md)     | Branching, CI/CD, deployments and production verification     |

## Maintenance Rules

1. Update documentation alongside implementation changes whenever practical.
2. Verify details against source code, tests, configuration or deployment before documenting them.
3. Mark unknown details as **Pending repository verification**; do not guess.
4. Separate implemented behavior from planned improvements.
5. Never include passwords, API keys, tokens, connection strings or other secrets.
6. Prefer relative links between documents.
7. Record significant changes in the changelog section of the project technical document.

## Documentation Baseline

- Baseline date: 21 November 2026
- Documentation version: 1.0
- Repository: `tushar-kadam-n/transaction-ledger`
- Primary branch: `main`

These documents are living records. Review the relevant documentation whenever implementation changes.
