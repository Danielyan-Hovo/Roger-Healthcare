"""Patient resource endpoints.

Optimistic locking
------------------
``PATCH /patients/{id}`` requires the client to submit both the integer
``version`` and the ``updated_at`` timestamp they currently have. The server
compares against the row it just loaded; any drift means another writer
won the race and we return HTTP 409 with the freshest server-side state.
That conflict body is shaped so the frontend can drop straight into the
"refresh to load latest" UX without an extra round-trip.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import db_session
from ..models import Encounter, Patient
from ..schemas import (
    PatientCreate,
    PatientDetail,
    PatientSummary,
    PatientUpdate,
)

router = APIRouter(prefix="/patients", tags=["patients"])

SessionDep = Annotated[AsyncSession, Depends(db_session)]


@router.get("", response_model=list[PatientSummary])
async def list_patients(session: SessionDep) -> list[PatientSummary]:
    latest_subq = (
        select(
            Encounter.patient_id.label("patient_id"),
            func.max(Encounter.created_at).label("latest_encounter_at"),
        )
        .group_by(Encounter.patient_id)
        .subquery()
    )

    stmt = (
        select(
            Patient.id,
            Patient.name,
            Patient.date_of_birth,
            Patient.version,
            Patient.updated_at,
            latest_subq.c.latest_encounter_at,
        )
        .outerjoin(latest_subq, latest_subq.c.patient_id == Patient.id)
        .order_by(Patient.name.asc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        PatientSummary(
            id=row.id,
            name=row.name,
            date_of_birth=row.date_of_birth,
            version=row.version,
            updated_at=row.updated_at,
            latest_encounter_at=row.latest_encounter_at,
        )
        for row in rows
    ]


@router.post("", response_model=PatientDetail, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate, session: SessionDep
) -> PatientDetail:
    patient = Patient(
        name=payload.name.strip(),
        date_of_birth=payload.date_of_birth,
        medical_history=payload.medical_history or "",
        version=1,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return PatientDetail.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientDetail)
async def get_patient(patient_id: uuid.UUID, session: SessionDep) -> PatientDetail:
    patient = await _get_patient_or_404(session, patient_id)
    return PatientDetail.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientDetail)
async def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    session: SessionDep,
):
    patient = await _get_patient_or_404(session, patient_id)

    server_updated_at = _to_utc(patient.updated_at)
    client_updated_at = _to_utc(payload.expected_updated_at)
    if patient.version != payload.expected_version or server_updated_at != client_updated_at:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "version_conflict",
                "current": PatientDetail.model_validate(patient).model_dump(mode="json"),
            },
        )

    patient.medical_history = payload.medical_history
    patient.version = patient.version + 1
    await session.commit()
    await session.refresh(patient)
    return PatientDetail.model_validate(patient)


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #


async def _get_patient_or_404(session: AsyncSession, patient_id: uuid.UUID) -> Patient:
    patient = await session.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="patient_not_found")
    return patient


def _to_utc(dt: datetime) -> datetime:
    """Coerce timestamps to UTC for safe equality comparison.

    Postgres stores ``DateTime(timezone=True)`` as UTC. The client may send
    an ISO-8601 string with an offset; we normalize both sides before
    comparing to avoid spurious conflicts from tz drift.
    """

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
