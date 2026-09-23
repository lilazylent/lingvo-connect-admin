from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role, RoleDefinition, User

PERMISSIONS = [
    "OVERVIEW_VIEW",
    "APPLICATIONS_VIEW", "APPLICATIONS_EDIT",
    "CLIENTS_VIEW", "CLIENTS_EDIT",
    "ORDERS_VIEW", "ORDERS_EDIT",
    "EXECUTORS_VIEW", "EXECUTORS_EDIT",
    "FILES_VIEW", "FILES_EDIT",
    "USERS_MANAGE",
    "SETTINGS_MANAGE",
    "IMPORTS_MANAGE",
]

MANAGER_DEFAULT_PERMISSIONS = [
    "OVERVIEW_VIEW",
    "APPLICATIONS_VIEW", "APPLICATIONS_EDIT",
    "CLIENTS_VIEW", "CLIENTS_EDIT",
    "ORDERS_VIEW", "ORDERS_EDIT",
    "EXECUTORS_VIEW", "EXECUTORS_EDIT",
    "FILES_VIEW", "FILES_EDIT",
]

PERMISSION_LABELS = {
    "OVERVIEW_VIEW": "Обзор",
    "APPLICATIONS_VIEW": "Заявки · просмотр",
    "APPLICATIONS_EDIT": "Заявки · изменение",
    "CLIENTS_VIEW": "Клиенты · просмотр",
    "CLIENTS_EDIT": "Клиенты · изменение",
    "ORDERS_VIEW": "Заказы · просмотр",
    "ORDERS_EDIT": "Заказы · изменение",
    "EXECUTORS_VIEW": "Исполнители · просмотр",
    "EXECUTORS_EDIT": "Исполнители · изменение",
    "FILES_VIEW": "Файлы · просмотр",
    "FILES_EDIT": "Файлы · изменение",
    "USERS_MANAGE": "Пользователи и роли",
    "SETTINGS_MANAGE": "Настройки, тарифы и справочники",
    "IMPORTS_MANAGE": "Импорт данных",
}


def normalize_permissions(values: Iterable[str]) -> list[str]:
    allowed = set(PERMISSIONS)
    return [code for code in PERMISSIONS if code in set(values) and code in allowed]


def get_role_definition(db: Session, code: str) -> RoleDefinition | None:
    return db.get(RoleDefinition, code)


def permissions_for_user(db: Session, user: User) -> list[str]:
    if user.role == Role.ADMIN.value:
        return list(PERMISSIONS)
    role = get_role_definition(db, user.role)
    if role and role.is_active:
        return normalize_permissions(role.permissions or [])
    if user.role == Role.MANAGER.value:
        # Backward compatibility for databases created before the role table exists/was seeded.
        return list(MANAGER_DEFAULT_PERMISSIONS)
    return []


def role_name_for_user(db: Session, user: User) -> str:
    role = get_role_definition(db, user.role)
    if role:
        return role.name
    if user.role == Role.ADMIN.value:
        return "Администратор"
    if user.role == Role.MANAGER.value:
        return "Менеджер"
    return user.role


def has_permission(db: Session, user: User, permission: str) -> bool:
    return user.role == Role.ADMIN.value or permission in permissions_for_user(db, user)


def required_permission_for_request(request: Request, *, write: bool) -> str | None:
    path = request.url.path

    # Personal auth/preferences stay accessible to every authenticated user.
    if path.startswith("/api/admin/auth") or path.startswith("/api/admin/users/me/"):
        return None

    if path.startswith("/api/admin/users"):
        return "USERS_MANAGE"
    if path.startswith("/api/admin/imports"):
        return "IMPORTS_MANAGE"

    if path.startswith((
        "/api/admin/crm/services",
        "/api/admin/crm/tariffs",
        "/api/admin/crm/pricing-rules",
        "/api/admin/crm/languages",
        "/api/admin/crm/order-statuses",
    )):
        # Operational screens consume these dictionaries for work forms and pricing.
        # Reading remains available to authenticated staff; mutations stay protected.
        return "SETTINGS_MANAGE" if write else None

    if path.startswith(("/api/admin/dashboard", "/api/admin/crm/dashboard")):
        return "OVERVIEW_VIEW"
    if path.startswith("/api/admin/applications"):
        return "APPLICATIONS_EDIT" if write else "APPLICATIONS_VIEW"
    if path.startswith(("/api/admin/companies", "/api/admin/crm/clients")):
        return "CLIENTS_EDIT" if write else "CLIENTS_VIEW"
    if path.startswith(("/api/admin/orders", "/api/admin/crm/orders", "/api/admin/crm/pricing")):
        # Order-file endpoints are still guarded by order permission; the Files module
        # below guards the global file registry/export endpoints.
        return "ORDERS_EDIT" if write else "ORDERS_VIEW"
    if path.startswith(("/api/admin/executors", "/api/admin/crm/executors")):
        return "EXECUTORS_EDIT" if write else "EXECUTORS_VIEW"
    if path.startswith("/api/admin/files"):
        return "FILES_EDIT" if write else "FILES_VIEW"

    return None


def enforce_request_permission(db: Session, user: User, request: Request, *, write: bool) -> None:
    permission = required_permission_for_request(request, write=write)
    if permission and not has_permission(db, user, permission):
        raise HTTPException(status_code=403, detail="Недостаточно прав для этого раздела")
