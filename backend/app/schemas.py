"""Pydantic v2 request and response schemas.

Names are snake_case to match the database columns and the API JSON shape
end-to-end (no client/server casing translation).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Encounter
# --------------------------------------------------------------------------- #


class EncounterCreate(BaseModel):
    patient_id: uuid.UUID
    transcript: str = ""


class EncounterUpdate(BaseModel):
    transcript: str = ""


class EncounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    transcript: str
    summary: str
    transcript_hash: str
    created_at: datetime
    updated_at: datetime


class EncounterReadWithCacheFlag(EncounterRead):
    """Same as ``EncounterRead`` plus a transient hint for the frontend
    indicating whether the LLM was re-invoked or the cached summary reused.
    Not persisted — derived per-response.
    """

    summary_cached: bool = False


# --------------------------------------------------------------------------- #
# Patient
# --------------------------------------------------------------------------- #


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    date_of_birth: date
    medical_history: str = ""


class PatientUpdate(BaseModel):
    medical_history: str
    expected_version: int = Field(ge=1)
    expected_updated_at: datetime


class PatientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    date_of_birth: date
    version: int
    updated_at: datetime
    latest_encounter_at: datetime | None = None


class PatientDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    date_of_birth: date
    medical_history: str
    version: int
    created_at: datetime
    updated_at: datetime
    encounters: list[EncounterRead] = []


class VersionConflict(BaseModel):
    error: str = "version_conflict"
    current: PatientDetail


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #


class HealthResponse(BaseModel):
    status: str = "ok"
