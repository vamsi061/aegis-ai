"""Shared model primitives."""

import uuid

from sqlalchemy import CHAR, JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSONType = JSON().with_variant(JSONB(), "postgresql")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def GUID() -> UUID:
    """UUID type that works on PostgreSQL (native) and SQLite (CHAR storage)."""
    return UUID(as_uuid=True).with_variant(CHAR(32), "sqlite")


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(GUID(), primary_key=True, default=_uuid)


class Base(DeclarativeBase):
    pass
