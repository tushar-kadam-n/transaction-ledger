
import logging
import os

from fastapi import FastAPI
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine
from app.routes.accounts import router as accounts_router
from app.routes.auth import router as auth_router
from app.routes.transactions import global_router as global_transactions_router
from app.routes.transactions import router as transactions_router

app = FastAPI(
    title="Transaction Ledger API",
    description="Manage accounts, credits, debits, and transaction history.",
    version="1.0.0",
)

logger = logging.getLogger(__name__)
raw_frontend_origins = os.getenv("FRONTEND_ORIGINS")
logger.info("FRONTEND_ORIGINS raw value: %r", raw_frontend_origins)
csrf_header_name = os.getenv("CSRF_HEADER_NAME", "X-CSRF-Token").strip()

allowed_origins = [
    origin
    for origin in (
        value.strip()
        for value in (raw_frontend_origins or "").split(",")
    )
    if origin and "*" not in origin
]
if not allowed_origins:
    allowed_origins = ["http://localhost:5173"]
logger.info("CORS allowed origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", csrf_header_name],
)


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(request, exc: RequestValidationError):
    if request.url.path.startswith("/api/auth/"):
        safe_errors = [
            {key: error[key] for key in ("type", "loc", "msg") if key in error}
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": safe_errors})
    return await request_validation_exception_handler(request, exc)

app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(transactions_router)
app.include_router(global_transactions_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/database")
def database_health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"status": "ok", "database": "connected"}
