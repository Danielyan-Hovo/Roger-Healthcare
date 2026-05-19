"""Encounter endpoints with SHA-256 cached AI summarization.

Caching policy
--------------
``transcript_hash`` is the SHA-256 hex of the normalized transcript
(``transcript.strip().lower()``). On PUT we recompute the hash and compare
against the stored one. If they match, we skip the LLM call entirely
(zero tokens spent) and return the existing summary. Otherwise we
re-summarize and store both the new transcript and the new hash atomically.
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import db_session
from ..models import Encounter, Patient
from ..schemas import (
    EncounterCreate,
    EncounterReadWithCacheFlag,
    EncounterUpdate,
)
from ..services.ai_summary import EMPTY_TRANSCRIPT_PLACEHOLDER, summarize_transcript

router = APIRouter(prefix="/encounters", tags=["encounters"])

SessionDep = Annotated[AsyncSession, Depends(db_session)]


def _normalize(transcript: str) -> str:
    return (transcript or "").strip().lower()


def _hash_transcript(transcript: str) -> str:
    return hashlib.sha256(_normalize(transcript).encode("utf-8")).hexdigest()


@router.post(
    "",
    response_model=EncounterReadWithCacheFlag,
    status_code=status.HTTP_201_CREATED,
)
async def create_encounter(
    payload: EncounterCreate, session: SessionDep
) -> EncounterReadWithCacheFlag:
    patient = await session.get(Patient, payload.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="patient_not_found")

    transcript = payload.transcript or ""
    transcript_hash = _hash_transcript(transcript)

    if not transcript.strip():
        summary = EMPTY_TRANSCRIPT_PLACEHOLDER
    else:
        summary = await summarize_transcript(transcript, patient_name=patient.name)

    encounter = Encounter(
        patient_id=patient.id,
        transcript=transcript,
        transcript_hash=transcript_hash,
        summary=summary,
    )
    session.add(encounter)
    await session.commit()
    await session.refresh(encounter)

    response = EncounterReadWithCacheFlag.model_validate(encounter)
    response.summary_cached = False
    return response


@router.put("/{encounter_id}", response_model=EncounterReadWithCacheFlag)
async def update_encounter(
    encounter_id: uuid.UUID,
    payload: EncounterUpdate,
    session: SessionDep,
) -> EncounterReadWithCacheFlag:
    encounter = await session.get(Encounter, encounter_id)
    if encounter is None:
        raise HTTPException(status_code=404, detail="encounter_not_found")

    patient = await session.get(Patient, encounter.patient_id)

    new_transcript = payload.transcript or ""
    new_hash = _hash_transcript(new_transcript)

    summary_cached = False
    if new_hash == encounter.transcript_hash and encounter.summary:
        # Hash matches AND we already have a summary in storage — pure cache hit.
        # We still touch updated_at so the UI reflects the activity.
        encounter.transcript = new_transcript
        summary_cached = True
    else:
        encounter.transcript = new_transcript
        encounter.transcript_hash = new_hash
        if not new_transcript.strip():
            encounter.summary = EMPTY_TRANSCRIPT_PLACEHOLDER
        else:
            encounter.summary = await summarize_transcript(
                new_transcript,
                patient_name=patient.name if patient else None,
            )

    await session.commit()
    await session.refresh(encounter)

    response = EncounterReadWithCacheFlag.model_validate(encounter)
    response.summary_cached = summary_cached
    return response
