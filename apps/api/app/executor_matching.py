"""Deterministic executor matching for Phase 10.2-10.4.

The same backend matcher serves persisted works and new-order preview matching.
Language capabilities are bidirectional. Direct viable candidates have priority;
a Russian two-stage route is exposed only when no selectable direct candidate exists.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crm_models import LanguageCatalog, ServiceType
from app.operations_models import Executor, ExecutorAvailability, ExecutorDirection, Order, OrderWork
from app.service_definitions import canonical_service_code, lookup_codes, matching_mode_for, supports_routing


_BLOCKING_AVAILABILITY = {"BUSY", "UNAVAILABLE", "VACATION"}


def _normalize(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


def _work_service_code(work: OrderWork) -> str:
    return (work.service_code or work.work_type or "").strip()


def _pair_matches(direction: ExecutorDirection, source_language: str, target_language: str) -> bool:
    source = _normalize(source_language)
    target = _normalize(target_language)
    saved_source = _normalize(direction.source_language)
    saved_target = _normalize(direction.target_language)
    return (saved_source == source and saved_target == target) or (
        saved_source == target and saved_target == source
    )


def _direction_preference(
    direction: ExecutorDirection, source_language: str, target_language: str
) -> tuple[int, str, str]:
    exact = (
        _normalize(direction.source_language) == _normalize(source_language)
        and _normalize(direction.target_language) == _normalize(target_language)
    )
    return (
        0 if exact else 1,
        _normalize(direction.source_language),
        _normalize(direction.target_language),
    )


def _resolve_required_date(work: OrderWork, order: Order) -> tuple[date | None, str | None]:
    if work.executor_deadline:
        return work.executor_deadline, "executor_deadline"
    if work.deadline:
        return work.deadline, "work_deadline"
    if order.deadline:
        return order.deadline, "order_deadline"
    return None, None


def _availability_for_date(
    db: Session, executor_ids: list[str], required_date: date | None
) -> dict[str, ExecutorAvailability]:
    if not executor_ids or required_date is None:
        return {}
    rows = db.scalars(
        select(ExecutorAvailability).where(
            ExecutorAvailability.executor_id.in_(executor_ids),
            ExecutorAvailability.archived.is_(False),
            ExecutorAvailability.start_date <= required_date,
            ExecutorAvailability.end_date >= required_date,
        )
    ).all()
    return {
        row.executor_id: row
        for row in sorted(rows, key=lambda item: (item.executor_id, item.start_date, item.id))
    }


def _availability_payload(
    row: ExecutorAvailability | None, required_date: date | None
) -> tuple[dict[str, Any], str, bool | None]:
    if required_date is None or row is None:
        return (
            {"state": "UNKNOWN", "start_date": None, "end_date": None, "notes": ""},
            "UNKNOWN",
            None,
        )
    if row.state == "FREE":
        candidate_state = "AVAILABLE"
        compatible: bool | None = True
    elif row.state in _BLOCKING_AVAILABILITY:
        candidate_state = "UNAVAILABLE"
        compatible = False
    else:
        candidate_state = "UNKNOWN"
        compatible = None
    return (
        {
            "state": row.state,
            "start_date": row.start_date,
            "end_date": row.end_date,
            "notes": row.notes,
        },
        candidate_state,
        compatible,
    )


def _candidate_counts(candidates: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "available": sum(item["candidate_state"] == "AVAILABLE" for item in candidates),
        "unknown": sum(item["candidate_state"] == "UNKNOWN" for item in candidates),
        "unavailable": sum(item["candidate_state"] == "UNAVAILABLE" for item in candidates),
        "total": len(candidates),
    }


def _source_matches(direction: ExecutorDirection, source_language: str) -> bool:
    source = _normalize(source_language)
    return source in {_normalize(direction.source_language), _normalize(direction.target_language)}


def _pair_candidates(
    db: Session,
    *,
    service_code: str,
    service_name: str,
    source_language: str,
    target_language: str,
    required_date: date | None,
    matching_mode: str = "LANGUAGE_PAIR",
) -> list[dict[str, Any]]:
    codes = lookup_codes(service_code) or {service_code}
    rows = db.execute(
        select(ExecutorDirection, Executor)
        .join(Executor, Executor.id == ExecutorDirection.executor_id)
        .where(
            Executor.archived.is_(False),
            ExecutorDirection.work_type.in_(codes),
        )
    ).all()

    matched_by_executor: dict[str, tuple[ExecutorDirection, Executor]] = {}
    for direction, executor in rows:
        if matching_mode == "LANGUAGE_PAIR" and not _pair_matches(direction, source_language, target_language):
            continue
        if matching_mode == "SOURCE_LANGUAGE" and not _source_matches(direction, source_language):
            continue
        existing = matched_by_executor.get(executor.id)
        if existing is None:
            matched_by_executor[executor.id] = (direction, executor)
            continue
        if matching_mode == "LANGUAGE_PAIR" and _direction_preference(
            direction, source_language, target_language
        ) < _direction_preference(existing[0], source_language, target_language):
            matched_by_executor[executor.id] = (direction, executor)

    availability = _availability_for_date(db, list(matched_by_executor), required_date)
    candidates: list[dict[str, Any]] = []
    for executor_id, (direction, executor) in matched_by_executor.items():
        availability_data, candidate_state, deadline_compatible = _availability_payload(
            availability.get(executor_id), required_date
        )
        candidates.append(
            {
                "executor_id": executor.id,
                "executor_name": executor.name,
                "service_code": canonical_service_code(service_code),
                "service_name": service_name,
                "matched_pair": {
                    "source_language": direction.source_language,
                    "target_language": direction.target_language,
                    "bidirectional": matching_mode == "LANGUAGE_PAIR",
                },
                "default_rate": Decimal(str(direction.default_rate)),
                "rate_unit": direction.rate_unit,
                "availability": availability_data,
                "candidate_state": candidate_state,
                "deadline_compatible": deadline_compatible,
            }
        )

    state_order = {"AVAILABLE": 0, "UNKNOWN": 1, "UNAVAILABLE": 2}
    candidates.sort(
        key=lambda item: (
            state_order[item["candidate_state"]],
            1 if Decimal(str(item["default_rate"])) <= 0 else 0,
            Decimal(str(item["default_rate"])) if Decimal(str(item["default_rate"])) > 0 else Decimal("0"),
            _normalize(item["executor_name"]),
            item["executor_id"],
        )
    )
    return candidates


def _canonical_russian(db: Session) -> str | None:
    # Do Unicode normalization in Python: SQLite LOWER() is ASCII-oriented and
    # cannot be relied on for Cyrillic catalog names in tests/local installs.
    rows = db.scalars(select(LanguageCatalog).where(LanguageCatalog.active.is_(True))).all()
    for row in rows:
        if _normalize(row.name) == _normalize("Русский"):
            return row.name
    return None


def _routed_match(
    db: Session,
    *,
    service_code: str,
    service_name: str,
    source_language: str,
    target_language: str,
    required_date: date | None,
    matchable: bool,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "eligible": False,
        "via_language": None,
        "reason": None,
        "complete": False,
        "stages": [],
    }
    if not matchable:
        result["reason"] = "WORK_NOT_MATCHABLE"
        return result

    russian = _canonical_russian(db)
    if not russian:
        result["reason"] = "RUSSIAN_NOT_IN_CATALOG"
        return result
    if _normalize(source_language) == _normalize(target_language):
        result["reason"] = "SAME_LANGUAGE"
        return result
    if _normalize(source_language) == _normalize(russian) or _normalize(target_language) == _normalize(russian):
        result["reason"] = "RUSSIAN_IS_ENDPOINT"
        return result

    result["eligible"] = True
    result["via_language"] = russian
    stage_pairs = [
        (1, source_language, russian),
        (2, russian, target_language),
    ]
    stages: list[dict[str, Any]] = []
    for index, stage_source, stage_target in stage_pairs:
        candidates = _pair_candidates(
            db,
            service_code=service_code,
            service_name=service_name,
            source_language=stage_source,
            target_language=stage_target,
            required_date=required_date,
        )
        stages.append(
            {
                "index": index,
                "source_language": stage_source,
                "target_language": stage_target,
                "candidates": candidates,
                "counts": _candidate_counts(candidates),
            }
        )
    result["stages"] = stages
    result["complete"] = all(
        any(candidate["candidate_state"] == "AVAILABLE" for candidate in stage["candidates"])
        for stage in stages
    )
    return result


def _matching_response(
    db: Session,
    *,
    order_id: str | None,
    work_id: str | None,
    service_code: str,
    work_type: str,
    source_language: str,
    target_language: str,
    deadline: date | None,
    executor_deadline: date | None,
    order_deadline: date | None = None,
) -> dict[str, Any]:
    resolved_service_code = canonical_service_code(service_code or work_type)
    source_language = (source_language or "").strip()
    target_language = (target_language or "").strip()
    matching_mode = matching_mode_for(resolved_service_code)
    missing_fields: list[str] = []
    if not resolved_service_code:
        missing_fields.append("service_code")
    if matching_mode in {"LANGUAGE_PAIR", "SOURCE_LANGUAGE"} and not source_language:
        missing_fields.append("source_language")
    if matching_mode == "LANGUAGE_PAIR" and not target_language:
        missing_fields.append("target_language")

    if executor_deadline:
        required_date, required_date_source = executor_deadline, "executor_deadline"
    elif deadline:
        required_date, required_date_source = deadline, "work_deadline"
    elif order_deadline:
        required_date, required_date_source = order_deadline, "order_deadline"
    else:
        required_date, required_date_source = None, None

    service = None
    if resolved_service_code:
        service = db.scalar(
            select(ServiceType).where(
                func.lower(func.trim(ServiceType.code)) == _normalize(resolved_service_code)
            )
        )
    service_name = service.name if service else ""
    matchable = not missing_fields
    candidates = (
        _pair_candidates(
            db,
            service_code=resolved_service_code,
            service_name=service_name,
            source_language=source_language,
            target_language=target_language,
            required_date=required_date,
            matching_mode=matching_mode,
        )
        if matchable
        else []
    )
    direct_viable = any(item["candidate_state"] == "AVAILABLE" for item in candidates)
    if supports_routing(resolved_service_code) and matching_mode == "LANGUAGE_PAIR":
        route_probe = _routed_match(
            db,
            service_code=resolved_service_code,
            service_name=service_name,
            source_language=source_language,
            target_language=target_language,
            required_date=required_date,
            matchable=matchable,
        )
    else:
        route_probe = {
            "eligible": False,
            "via_language": None,
            "reason": "ROUTING_NOT_SUPPORTED",
            "complete": False,
            "stages": [],
        }
    routed = (
        {
            "eligible": False,
            "via_language": route_probe.get("via_language"),
            "reason": "DIRECT_MATCH_AVAILABLE",
            "complete": False,
            "stages": [],
        }
        if direct_viable and route_probe.get("eligible")
        else route_probe
    )

    return {
        "order_id": order_id,
        "work": {
            "id": work_id,
            "service_code": resolved_service_code,
            "service_name": service_name,
            "source_language": source_language,
            "target_language": target_language,
            "deadline": deadline,
            "executor_deadline": executor_deadline,
        },
        "match_type": "DIRECT",
        "matching_mode": matching_mode,
        "matchable": matchable,
        "missing_fields": missing_fields,
        "required_date": required_date,
        "required_date_source": required_date_source,
        "candidates": candidates,
        "counts": _candidate_counts(candidates),
        "direct_viable": direct_viable,
        "routed_match": routed,
    }


def direct_executor_candidates(db: Session, order: Order, work: OrderWork) -> dict[str, Any]:
    """Return deterministic candidates for an already persisted work."""
    return _matching_response(
        db,
        order_id=order.id,
        work_id=work.id,
        service_code=work.service_code or "",
        work_type=work.work_type or "",
        source_language=work.source_language or "",
        target_language=work.target_language or "",
        deadline=work.deadline,
        executor_deadline=work.executor_deadline,
        order_deadline=order.deadline,
    )


def preview_executor_candidates(
    db: Session,
    *,
    service_code: str = "",
    work_type: str = "",
    source_language: str = "",
    target_language: str = "",
    deadline: date | None = None,
    executor_deadline: date | None = None,
    order_deadline: date | None = None,
) -> dict[str, Any]:
    """Run the exact same matcher for an unsaved new-order work."""
    return _matching_response(
        db,
        order_id=None,
        work_id=None,
        service_code=service_code,
        work_type=work_type,
        source_language=source_language,
        target_language=target_language,
        deadline=deadline,
        executor_deadline=executor_deadline,
        order_deadline=order_deadline,
    )
