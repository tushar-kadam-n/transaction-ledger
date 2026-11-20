import uuid

from sqlalchemy import CheckConstraint, UniqueConstraint

from app.database import Base
from app.models.account import Account
from app.models.auth_token import AuthToken
from app.models.refresh_session import RefreshSession
from app.models.user import User


def _constraints(model):
    return list(model.__table__.constraints)


def test_auth_tables_are_registered_in_metadata():
    assert {"users", "auth_tokens", "refresh_sessions"}.issubset(Base.metadata.tables)


def test_user_model_defaults_normalization_and_constraints():
    assert isinstance(User.__table__.c.id.default.arg(None), uuid.UUID)
    user = User(email="  Person@Example.COM  ", password_hash="hashed")
    assert user.email == "person@example.com"
    assert User.__table__.c.email.nullable is False
    assert User.__table__.c.password_hash.nullable is False
    assert User.__table__.c.is_verified.default.arg is False
    assert User.__table__.c.is_verified.server_default is not None
    assert User.__table__.c.verified_at.nullable is True
    assert User.__table__.c.created_at.server_default is not None
    assert User.__table__.c.updated_at.server_default is not None
    assert any(
        isinstance(constraint, UniqueConstraint)
        and constraint.name == "uq_users_email"
        for constraint in _constraints(User)
    )
    assert any(
        isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_users_email_lowercase"
        for constraint in _constraints(User)
    )


def test_auth_token_model_fields_constraints_and_foreign_key():
    table = AuthToken.__table__
    assert isinstance(table.c.id.default.arg(None), uuid.UUID)
    assert table.c.token_hash.nullable is False
    assert table.c.expires_at.nullable is False
    assert table.c.used_at.nullable is True
    assert table.c.created_at.server_default is not None
    assert table.c.user_id.index is True
    assert table.c.expires_at.index is True
    assert next(iter(table.c.user_id.foreign_keys)).target_fullname == "users.id"
    assert next(iter(table.c.user_id.foreign_keys)).ondelete == "CASCADE"
    assert any(
        isinstance(constraint, UniqueConstraint)
        and constraint.name == "uq_auth_tokens_token_hash"
        for constraint in _constraints(AuthToken)
    )
    assert any(
        isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_auth_tokens_purpose"
        for constraint in _constraints(AuthToken)
    )


def test_refresh_session_model_fields_constraints_and_foreign_key():
    table = RefreshSession.__table__
    assert isinstance(table.c.id.default.arg(None), uuid.UUID)
    assert table.c.token_hash.nullable is False
    assert table.c.expires_at.nullable is False
    assert table.c.revoked_at.nullable is True
    assert table.c.last_used_at.nullable is True
    assert table.c.created_at.server_default is not None
    assert table.c.user_id.index is True
    assert table.c.expires_at.index is True
    assert next(iter(table.c.user_id.foreign_keys)).target_fullname == "users.id"
    assert next(iter(table.c.user_id.foreign_keys)).ondelete == "CASCADE"
    assert any(
        isinstance(constraint, UniqueConstraint)
        and constraint.name == "uq_refresh_sessions_token_hash"
        for constraint in _constraints(RefreshSession)
    )


def test_account_ownership_is_nullable_and_references_users():
    column = Account.__table__.c.user_id
    assert column.nullable is True
    assert column.index is True
    foreign_key = next(iter(column.foreign_keys))
    assert foreign_key.target_fullname == "users.id"
    assert foreign_key.ondelete == "RESTRICT"
