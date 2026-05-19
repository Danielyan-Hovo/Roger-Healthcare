"""Anthropic-backed transcript summarization.

Design notes
------------
- Uses the **async** Anthropic SDK so the FastAPI worker is never blocked
  during the long-running LLM call.
- A 20-second wall clock budget is enforced via ``asyncio.wait_for`` so a
  hung upstream cannot stall the request indefinitely.
- All upstream failures are converted into a placeholder string (rather
  than re-raised) so the caller can still persist the encounter record.
  This is what keeps the endpoint resilient — the DB write is the source
  of truth; the summary is a best-effort enrichment.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import Final

from anthropic import APIError, AsyncAnthropic

from ..config import ANTHROPIC_MODEL

logger = logging.getLogger(__name__)

LLM_TIMEOUT_SECONDS: Final[float] = 20.0
MAX_TOKENS: Final[int] = 600
TEMPERATURE: Final[float] = 0.2

EMPTY_TRANSCRIPT_PLACEHOLDER: Final[str] = "No transcript provided yet."

SYSTEM_PROMPT: Final[str] = """You are a Professional Medical Scribe for Roger Health.

Given a raw clinical visit transcript, produce a CONCISE, structured Markdown
summary that a busy clinician can scan in under 30 seconds. Use exactly these
sections, in this order, as level-3 Markdown headings (###). Omit a section
only if the transcript contains zero relevant information for it.

### Chief Complaint
### Key Symptoms
### Pain Level
### Clinician's Focus Areas
### Plan / Next Steps

Rules:
- Use short bullet points; no long paragraphs.
- Stay strictly under 250 words total.
- Quote vitals exactly as stated in the transcript when available.
- Do NOT invent symptoms, medications, or diagnoses that are not in the transcript.
- Do NOT include patient identifiers in the summary (no SSN, address, or phone).
- If the transcript is too short or non-clinical to support a meaningful
  summary, return only the line: "No clinically relevant content detected."
"""


def _build_user_prompt(transcript: str, patient_name: str | None) -> str:
    header = (
        f"Patient: {patient_name}\n\n"
        if patient_name
        else ""
    )
    return (
        f"{header}Raw transcript:\n"
        f"---\n"
        f"{transcript.strip()}\n"
        f"---\n\n"
        f"Generate the structured Markdown summary now."
    )


async def summarize_transcript(
    transcript: str,
    patient_name: str | None = None,
) -> str:
    """Summarize a transcript into structured Markdown.

    Returns the summary text on success, the empty-transcript placeholder
    when there is nothing to summarize, or a ``[Summary unavailable: ...]``
    sentinel on upstream failure so the caller can still persist the row.
    """

    if not transcript or not transcript.strip():
        return EMPTY_TRANSCRIPT_PLACEHOLDER

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        msg = "[Summary unavailable: ANTHROPIC_API_KEY not configured]"
        print(msg, file=sys.stderr)
        return msg

    client = AsyncAnthropic(api_key=api_key)
    user_prompt = _build_user_prompt(transcript, patient_name)

    try:
        response = await asyncio.wait_for(
            client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        msg = f"[Summary unavailable: timed out after {int(LLM_TIMEOUT_SECONDS)}s]"
        print(msg, file=sys.stderr)
        return msg
    except APIError as exc:
        msg = f"[Summary unavailable: Anthropic API error: {exc}]"
        print(msg, file=sys.stderr)
        return msg
    except Exception as exc:  # noqa: BLE001 — last-resort guard
        msg = f"[Summary unavailable: {type(exc).__name__}: {exc}]"
        print(msg, file=sys.stderr)
        return msg

    parts: list[str] = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    text_out = "\n".join(parts).strip()
    if not text_out:
        return "[Summary unavailable: empty response]"
    return text_out
