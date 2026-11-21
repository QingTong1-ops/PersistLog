from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, Query, status

from app.api.deps import CurrentUser, DbSession, PaginationDep
from app.core.errors import AppError
from app.schemas.pagination import Page
from app.schemas.practice import (
    ALLOWED_LANGUAGES,
    CodeEvaluationOut,
    CodeEvaluationSummary,
    EvaluationStart,
    PracticeContextOut,
    PracticeDraftCreate,
    PracticeDraftOut,
    PracticeDraftSubmit,
    PracticeDraftSummary,
    PracticeDraftUpdate,
    PracticeSubmissionCreate,
    PracticeSubmissionOut,
    PracticeSubmissionSummary,
)
from app.services import code_review_service, practice_service

router = APIRouter(prefix="/practice", tags=["practice"])


@router.get("/context", response_model=PracticeContextOut)
def get_context(
    user: CurrentUser,
    db: DbSession,
    task_id: Annotated[str | None, Query()] = None,
    occurrence_id: Annotated[str | None, Query()] = None,
) -> PracticeContextOut:
    return practice_service.get_context(db, user, task_id, occurrence_id)


@router.get("/drafts", response_model=Page[PracticeDraftSummary])
def list_drafts(
    user: CurrentUser,
    db: DbSession,
    page: PaginationDep,
    task_id: Annotated[str | None, Query()] = None,
) -> Page[PracticeDraftSummary]:
    items, total = practice_service.list_drafts(
        db,
        user,
        limit=page.limit,
        offset=page.offset,
        task_id=task_id,
    )
    return Page(
        items=items,
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post(
    "/drafts",
    response_model=PracticeDraftOut,
    status_code=status.HTTP_201_CREATED,
)
def create_draft(
    user: CurrentUser,
    db: DbSession,
    payload: PracticeDraftCreate,
) -> PracticeDraftOut:
    return practice_service.create_draft(db, user, payload)


@router.get("/drafts/{draft_id}", response_model=PracticeDraftOut)
def get_draft(
    user: CurrentUser,
    db: DbSession,
    draft_id: str,
) -> PracticeDraftOut:
    return practice_service.get_draft(db, user, draft_id)


@router.patch("/drafts/{draft_id}", response_model=PracticeDraftOut)
def update_draft(
    user: CurrentUser,
    db: DbSession,
    draft_id: str,
    payload: PracticeDraftUpdate,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> PracticeDraftOut:
    return practice_service.update_draft(
        db,
        user,
        draft_id,
        payload,
        if_match=if_match,
    )


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(
    user: CurrentUser,
    db: DbSession,
    draft_id: str,
    version: Annotated[int, Query(ge=1)],
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> None:
    practice_service.delete_draft(
        db,
        user,
        draft_id,
        version=version,
        if_match=if_match,
    )


@router.post(
    "/drafts/{draft_id}/submit",
    response_model=PracticeSubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_draft(
    user: CurrentUser,
    db: DbSession,
    draft_id: str,
    payload: PracticeDraftSubmit,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> PracticeSubmissionOut:
    return practice_service.submit_draft(
        db,
        user,
        draft_id,
        payload,
        if_match=if_match,
    )


@router.get("/submissions", response_model=Page[PracticeSubmissionSummary])
def list_submissions(
    user: CurrentUser,
    db: DbSession,
    page: PaginationDep,
    task_id: Annotated[str | None, Query()] = None,
    language: Annotated[str | None, Query()] = None,
) -> Page[PracticeSubmissionSummary]:
    if language is not None and language not in ALLOWED_LANGUAGES:
        raise AppError("INVALID_LANGUAGE", "不支持的语言", status_code=422)
    items, total = practice_service.list_submissions(
        db,
        user,
        limit=page.limit,
        offset=page.offset,
        task_id=task_id,
        language=language,
    )
    return Page(
        items=items,
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post(
    "/submissions",
    response_model=PracticeSubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_submission(
    user: CurrentUser,
    db: DbSession,
    payload: PracticeSubmissionCreate,
) -> PracticeSubmissionOut:
    return practice_service.create_submission(db, user, payload)


@router.post(
    "/submissions/{submission_id}/evaluations",
    response_model=EvaluationStart,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_evaluation(
    user: CurrentUser,
    db: DbSession,
    submission_id: str,
) -> EvaluationStart:
    return code_review_service.start_evaluation(db, user, submission_id)


@router.get(
    "/submissions/{submission_id}/evaluations",
    response_model=Page[CodeEvaluationSummary],
)
def list_evaluations(
    user: CurrentUser,
    db: DbSession,
    submission_id: str,
    page: PaginationDep,
) -> Page[CodeEvaluationSummary]:
    items, total = code_review_service.list_evaluations(
        db,
        user,
        submission_id,
        limit=page.limit,
        offset=page.offset,
    )
    return Page(
        items=[code_review_service.evaluation_summary(item) for item in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/evaluations/{evaluation_id}", response_model=CodeEvaluationOut)
def get_evaluation(
    user: CurrentUser,
    db: DbSession,
    evaluation_id: str,
) -> CodeEvaluationOut:
    return code_review_service.get_evaluation(db, user, evaluation_id)


@router.get("/submissions/{submission_id}", response_model=PracticeSubmissionOut)
def get_submission(
    user: CurrentUser,
    db: DbSession,
    submission_id: str,
) -> PracticeSubmissionOut:
    return practice_service.get_submission(db, user, submission_id)


@router.post(
    "/submissions/{submission_id}/copy-to-draft",
    response_model=PracticeDraftOut,
    status_code=status.HTTP_201_CREATED,
)
def copy_submission_to_draft(
    user: CurrentUser,
    db: DbSession,
    submission_id: str,
) -> PracticeDraftOut:
    return practice_service.copy_submission_to_draft(db, user, submission_id)
