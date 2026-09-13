import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.client_models import ClientActivity, Company, Representative
from app.db import get_db
from app.dependencies import SessionContext, require_authenticated, require_authenticated_write
from app.models import User, utcnow

router = APIRouter(prefix="/api/admin/companies", tags=["clients"])
DB = Annotated[Session, Depends(get_db)]
Read = Annotated[SessionContext, Depends(require_authenticated)]
Write = Annotated[SessionContext, Depends(require_authenticated_write)]


class CompanyFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(default="", max_length=200)
    tax_id: str | None = Field(default=None, max_length=12)
    notes: str = Field(default="", max_length=5000)
    kind: Literal["company", "individual"] = "company"
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=40)
    manager_id: str | None = None

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Проверьте email")
        return value

    @field_validator("tax_id")
    @classmethod
    def valid_tax_id(cls, value):
        if not value:
            return None
        if not re.fullmatch(r"(?:[0-9]{10}|[0-9]{12})", value):
            raise ValueError("ИНН: 10 или 12 цифр")
        return value


class CompanyEdit(CompanyFields):
    version: int = Field(ge=1)


class ArchiveChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: bool
    version: int = Field(ge=1)


class PersonFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(default="", max_length=160)
    position: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=5000)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Проверьте email")
        return value


class PersonEdit(PersonFields):
    version: int = Field(ge=1)


def view(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def company(db, company_id, *, active=False, lock=False):
    query = select(Company).where(Company.id == company_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise HTTPException(404, "Компания не найдена")
    if active and row.archived:
        raise HTTPException(409, "Компания в архиве. Сначала восстановите её.")
    return row


def person(db, company_id, representative_id):
    row = db.scalar(
        select(Representative).where(
            Representative.id == representative_id, Representative.company_id == company_id
        )
    )
    if row is None:
        raise HTTPException(404, "Представитель не найден в этой компании")
    return row


def record(db, context, company_id, action, representative_id=None):
    db.add(
        ClientActivity(
            company_id=company_id,
            representative_id=representative_id,
            actor_user_id=context.user.id,
            action=action,
        )
    )


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Компания с таким ИНН уже существует, в том числе возможно в архиве."
        ) from None


def change(db, row, version, values):
    model = type(row)
    result = db.execute(
        update(model)
        .where(model.id == row.id, model.version == version)
        .values(**values, version=version + 1, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Запись уже изменена. Обновите страницу и повторите изменение.")


@router.get("")
def list_companies(
    db: DB,
    context: Read,
    q: str = Query("", max_length=200),
    archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = [Company.archived == archived]
    if q.strip():
        filters.append(
            or_(
                Company.name.icontains(q.strip(), autoescape=True),
                Company.email.icontains(q.strip(), autoescape=True),
                Company.phone.icontains(q.strip(), autoescape=True),
                Company.tax_id.contains(q.strip(), autoescape=True),
                Company.id.in_(
                    select(Representative.company_id).where(
                        Representative.archived.is_(False),
                        or_(
                            Representative.name.icontains(q.strip(), autoescape=True),
                            Representative.email.icontains(q.strip(), autoescape=True),
                            Representative.phone.icontains(q.strip(), autoescape=True),
                        ),
                    )
                ),
            )
        )
    total = db.scalar(select(func.count()).select_from(Company).where(*filters)) or 0
    rows = db.scalars(
        select(Company)
        .where(*filters)
        .order_by(Company.name, Company.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [view(row) for row in rows],
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.post("", status_code=201)
def create_company(payload: CompanyFields, db: DB, context: Write):
    validate_manager(db, payload.manager_id)
    row = Company(**payload.model_dump())
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Компания с таким ИНН уже существует.") from None
    record(db, context, row.id, "company.created")
    commit(db)
    return view(row)


@router.get("/{company_id}")
def get_company(company_id: str, db: DB, context: Read):
    return view(company(db, company_id))


@router.patch("/{company_id}")
def edit_company(company_id: str, payload: CompanyEdit, db: DB, context: Write):
    validate_manager(db, payload.manager_id)
    row = company(db, company_id, active=True, lock=True)
    change(db, row, payload.version, payload.model_dump(exclude={"version"}))
    record(db, context, row.id, "company.updated")
    commit(db)
    db.refresh(row)
    return view(row)


def validate_manager(db, manager_id):
    if manager_id:
        manager = db.get(User, manager_id)
        if not manager or not manager.is_active or manager.role not in {"ADMIN", "MANAGER"}:
            raise HTTPException(422, "Выберите действующего менеджера")


@router.post("/{company_id}/archive")
def archive_company(company_id: str, payload: ArchiveChange, db: DB, context: Write):
    row = company(db, company_id, lock=True)
    change(db, row, payload.version, {"archived": payload.archived})
    record(db, context, row.id, "company.archived" if payload.archived else "company.restored")
    commit(db)
    db.refresh(row)
    return view(row)


@router.get("/{company_id}/representatives")
def list_people(
    company_id: str,
    db: DB,
    context: Read,
    archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
):
    company(db, company_id)
    filters = [Representative.company_id == company_id, Representative.archived == archived]
    if q:
        filters.append(
            or_(
                Representative.name.icontains(q, autoescape=True),
                Representative.email.icontains(q, autoescape=True),
                Representative.phone.icontains(q, autoescape=True),
                Representative.position.icontains(q, autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(Representative).where(*filters)) or 0
    rows = db.scalars(
        select(Representative)
        .where(*filters)
        .order_by(Representative.name, Representative.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [view(row) for row in rows],
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.post("/{company_id}/representatives", status_code=201)
def create_person(company_id: str, payload: PersonFields, db: DB, context: Write):
    company(db, company_id, active=True, lock=True)
    row = Representative(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.flush()
    record(db, context, company_id, "representative.created", row.id)
    commit(db)
    return view(row)


@router.patch("/{company_id}/representatives/{representative_id}")
def edit_person(
    company_id: str, representative_id: str, payload: PersonEdit, db: DB, context: Write
):
    company(db, company_id, active=True, lock=True)
    row = person(db, company_id, representative_id)
    if row.archived:
        raise HTTPException(409, "Сначала восстановите представителя из архива.")
    change(db, row, payload.version, payload.model_dump(exclude={"version"}))
    record(db, context, company_id, "representative.updated", row.id)
    commit(db)
    db.refresh(row)
    return view(row)


@router.post("/{company_id}/representatives/{representative_id}/archive")
def archive_person(
    company_id: str, representative_id: str, payload: ArchiveChange, db: DB, context: Write
):
    company(db, company_id, active=True, lock=True)
    row = person(db, company_id, representative_id)
    change(db, row, payload.version, {"archived": payload.archived})
    record(
        db,
        context,
        company_id,
        "representative.archived" if payload.archived else "representative.restored",
        row.id,
    )
    commit(db)
    db.refresh(row)
    return view(row)


@router.get("/{company_id}/activity")
def activity(company_id: str, db: DB, context: Read, page: int = Query(1, ge=1)):
    company(db, company_id)
    filters = [ClientActivity.company_id == company_id]
    total = db.scalar(select(func.count()).select_from(ClientActivity).where(*filters)) or 0
    rows = db.scalars(
        select(ClientActivity)
        .where(*filters)
        .order_by(ClientActivity.created_at.desc(), ClientActivity.id)
        .offset((page - 1) * 20)
        .limit(20)
    ).all()
    return {
        "items": [view(row) for row in rows],
        "total": total,
        "page": page,
        "pages": max(1, (total + 19) // 20),
    }
