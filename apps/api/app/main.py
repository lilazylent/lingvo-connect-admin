import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.routers import admin, applications, auth, clients, crm, imports, operations, users

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.admin_web_origin,
        settings.public_site_origin,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    if request.url.path in {"/api/public/leads", "/api/public/leads/with-attachment"}:
        content_length = request.headers.get("content-length")
        maximum = settings.public_max_body_bytes
        if request.url.path.endswith("/with-attachment"):
            maximum += settings.application_file_max_bytes
        if content_length and int(content_length) > maximum:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": "Запрос слишком большой",
                    "request_id": request.state.request_id,
                },
            )
    response = await call_next(request)
    response.headers["x-request-id"] = request.state.request_id
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "same-origin"
    return response


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, _error: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Внутренняя ошибка сервера",
            "request_id": request.state.request_id,
        },
    )


@app.get("/health/live", tags=["health"])
def health_live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def health_ready() -> dict:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(applications.public_router)
app.include_router(applications.admin_router)
app.include_router(applications.dashboard_router)
app.include_router(clients.router)
app.include_router(operations.router)
app.include_router(crm.router)
app.include_router(imports.router)
