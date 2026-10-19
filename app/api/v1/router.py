from fastapi import APIRouter

from app.api.v1 import auth, consents, job_targets, profile

router = APIRouter()

router.include_router(auth.router)
router.include_router(profile.router)
router.include_router(job_targets.router)
router.include_router(consents.router)


@router.get("/ping", tags=["meta"])
def ping() -> dict[str, str]:
    return {"message": "pong"}
