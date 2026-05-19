"""Idempotent database seeding.

Reads the four sample text files from ``/app/sample_data`` (mounted into
the container via docker-compose) and inserts two patients with one
encounter each. The encounter summaries are deliberately left blank so
the demo can show "Generate Summary" running live.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal, create_all, wait_for_db
from app.models import Encounter, Patient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s seed :: %(message)s",
)
logger = logging.getLogger("seed")

SAMPLE_DIR = Path("/app/sample_data")


def _read(name: str) -> str:
    p = SAMPLE_DIR / name
    if not p.exists():
        # Fallback for running seed.py on the host during local dev.
        alt = Path(__file__).resolve().parent.parent / "sample_data" / name
        if alt.exists():
            return alt.read_text(encoding="utf-8")
        logger.warning("sample file missing: %s", p)
        return ""
    return p.read_text(encoding="utf-8")


def _hash(transcript: str) -> str:
    return hashlib.sha256(transcript.strip().lower().encode("utf-8")).hexdigest()


async def seed() -> None:
    await wait_for_db()
    await create_all()

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(Patient.id).limit(1))).scalar_one_or_none()
        if existing is not None:
            logger.info("patients already exist — skipping seed")
            return

        # ---- Patient 1: James "Jim" Wright -------------------------------- #
        history_1 = _read("medical_history_1.txt")
        transcript_1 = _read("cleaned_transcript_1.txt")

        patient_1 = Patient(
            name='James "Jim" Wright',
            date_of_birth=date(1944, 1, 2),
            medical_history=history_1,
            version=1,
        )
        session.add(patient_1)
        await session.flush()  # populate patient_1.id

        encounter_1 = Encounter(
            patient_id=patient_1.id,
            transcript=transcript_1,
            transcript_hash=_hash(transcript_1),
            summary="",  # left blank on purpose for the demo
        )
        session.add(encounter_1)

        # ---- Patient 2: Bettye Wellons ------------------------------------ #
        history_2 = _read("medical_history_2.txt")
        transcript_2 = _read("cleaned_transcript_2.txt")

        patient_2 = Patient(
            name="Bettye Wellons",
            date_of_birth=date(1940, 1, 23),
            medical_history=history_2,
            version=1,
        )
        session.add(patient_2)
        await session.flush()

        encounter_2 = Encounter(
            patient_id=patient_2.id,
            transcript=transcript_2,
            transcript_hash=_hash(transcript_2),
            summary="",
        )
        session.add(encounter_2)

        await session.commit()
        logger.info("seed complete: inserted 2 patients, 2 encounters")


if __name__ == "__main__":
    asyncio.run(seed())
