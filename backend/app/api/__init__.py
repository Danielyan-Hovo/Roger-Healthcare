"""API routers."""

from fastapi import APIRouter

from . import encounters, patients

router = APIRouter(prefix="/api")
router.include_router(patients.router)
router.include_router(encounters.router)
