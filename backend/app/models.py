"""ORM models for Patient and Encounter."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    desc,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

if TYPE_CHECKING:
    pass


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    medical_history: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Optimistic locking: a monotonically increasing version counter, bumped
    # on every successful PATCH. Clients submit the version they read; if it
    # no longer matches the server-side value we reject with HTTP 409.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    encounters: Mapped[list["Encounter"]] = relationship(
        "Encounter",
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="Encounter.created_at.desc()",
        lazy="selectin",
    )


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transcript: Mapped[str] = mapped_column(Text, nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # SHA-256 hex of the normalized (stripped + lowercased) transcript.
    # Acts as the cache key for AI summary regeneration.
    transcript_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, default="", index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    patient: Mapped[Patient] = relationship("Patient", back_populates="encounters")

    __table_args__ = (
        Index(
            "ix_encounters_patient_created_desc",
            "patient_id",
            desc("created_at"),
        ),
    )
