from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import SessionContext, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin-guards"])


@router.get("/settings")
def settings_placeholder(_: Annotated[SessionContext, Depends(require_admin)]) -> dict:
    return {"status": "planned", "message": "Системные настройки появятся в следующих этапах."}


@router.get("/tariffs")
def tariffs_placeholder(_: Annotated[SessionContext, Depends(require_admin)]) -> dict:
    return {"status": "planned", "message": "Тарифы появятся после согласования формул."}
