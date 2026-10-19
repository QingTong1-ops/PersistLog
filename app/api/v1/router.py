from fastapi import APIRouter

router = APIRouter()


@router.get("/ping", tags=["meta"])
def ping() -> dict[str, str]:
    return {"message": "pong"}
