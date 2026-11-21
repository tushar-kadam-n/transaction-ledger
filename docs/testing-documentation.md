# Transaction Ledger – Testing Documentation

**Version:** 1.0  
**Project:** Transaction Ledger

## 1. Purpose

This document describes the testing approach used to verify the functionality, reliability, and stability of the Transaction Ledger application.

Testing is performed at both backend and frontend levels to identify defects and prevent regressions during development.

## 2. Testing Strategy

The project follows a combination of automated and manual testing.

- **Backend testing:** Verifies API behavior, business logic, database interactions, authentication, and validation.
- **Frontend testing:** Verifies user interface behavior, navigation, form handling, API integration, and application responsiveness.
- **Integration testing:** Checks communication between frontend, backend, and database components.
- **Regression testing:** Ensures existing functionality continues to work after code changes.
- **Deployment verification:** Confirms that deployed application services are accessible and responding correctly.

## 3. Testing Tools and Technologies

| Tool / Technology  | Purpose                                 |
| ------------------ | --------------------------------------- |
| Pytest             | Backend automated testing               |
| FastAPI TestClient | API endpoint testing                    |
| PostgreSQL         | Database testing                        |
| ESLint             | Frontend code quality and lint checks   |
| Vite               | Frontend production build verification  |
| GitHub Actions     | Automated CI testing                    |
| Browser            | Manual frontend and integration testing |

## 4. Test Environments

Testing is performed in separate environments to avoid unintended changes to production data.

**Local Environment**

- Backend and frontend run locally.
- PostgreSQL uses the local development database.
- Automated and manual testing can be performed during development.

**CI Environment**

- GitHub Actions runs automated checks.
- Backend tests use a disposable PostgreSQL service.
- Frontend dependencies are installed using `npm ci`.
- Backend tests, frontend linting, and production builds are validated before changes are merged into the main branch.

**Production Environment**

- Production deployment is verified through automated smoke tests.
- Application availability and backend health are checked after deployment.

Production data must not be used for routine development or automated testing.

## 5. Running Tests Locally

### Backend

Activate the Python virtual environment and run:

```bash
pytest
```

### Frontend

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm ci
```

Run lint checks:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## 6. Continuous Integration

GitHub Actions automatically validates changes through the project's CI pipeline.

The pipeline includes:

- Backend dependency installation.
- PostgreSQL service initialization.
- Database migrations.
- Backend automated tests.
- Frontend dependency installation.
- Frontend lint checks.
- Frontend production build.

Changes must pass the required CI checks before they can be merged into the protected `main` branch.

## 7. Deployment Verification

After a successful CI run, the production deployment workflow verifies the deployed application.

The verification process includes:

- Confirming the expected backend commit is deployed.
- Confirming the matching frontend production deployment is ready.
- Checking frontend availability.
- Checking the backend health endpoint.
- Confirming successful service responses.

## 8. Testing and Quality Guidelines

- New functionality should include appropriate automated tests.
- Existing tests should continue passing after changes.
- Tests must use isolated test data and databases.
- Production credentials and data must not be exposed in test code.
- Database migrations should be validated before deployment.
- Frontend linting and production builds should pass before merging.
- Critical functionality should be manually verified when automated coverage is insufficient.

## 9. Document Maintenance

This document should be updated when the testing framework, test execution process, CI pipeline, or testing environments change.
