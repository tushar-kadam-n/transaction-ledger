
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine
from app.routes.accounts import router as accounts_router
from app.routes.transactions import global_router as global_transactions_router
from app.routes.transactions import router as transactions_router

app = FastAPI(
    title="Transaction Ledger API",
    description="Manage accounts, credits, debits, and transaction history.",
    version="1.0.0",
)

allowed_origins = [
    origin
    for origin in (
        value.strip()
        for value in os.getenv("FRONTEND_ORIGINS", "").split(",")
    )
    if origin and "*" not in origin
]
if not allowed_origins:
    allowed_origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

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
