from fastapi import APIRouter

from app.api.v1 import (
    audit,
    auth,
    consents,
    dashboard,
    imports,
    job_targets,
    jobs,
    notifications,
    profile,
    routes,
    tasks,
    today,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(profile.router)
router.include_router(job_targets.router)
router.include_router(consents.router)
router.include_router(imports.router)
router.include_router(jobs.router)
router.include_router(routes.router)
router.include_router(routes.stage_router)
router.include_router(tasks.router)
router.include_router(today.router)
router.include_router(dashboard.router)
router.include_router(notifications.router)
router.include_router(audit.router)


@router.get("/ping", tags=["meta"])
def ping() -> dict[str, str]:
    return {"message": "pong"}
