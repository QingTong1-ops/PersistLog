from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbSession
from app.schemas.consent import ConsentOut, ConsentUpdate
from app.services import consent_service

router = APIRouter(prefix="/consents", tags=["consents"])


@router.get("", response_model=list[ConsentOut])
def list_consents(user: CurrentUser, db: DbSession) -> list[ConsentOut]:
    return [
        ConsentOut.model_validate(consent)
        for consent in consent_service.list_consents(db, user)
    ]


@router.put("", response_model=ConsentOut)
def set_consent(
    user: CurrentUser,
    db: DbSession,
    payload: ConsentUpdate,
    request: Request,
) -> ConsentOut:
    consent = consent_service.set_consent(
        db,
        user,
        payload,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return ConsentOut.model_validate(consent)
