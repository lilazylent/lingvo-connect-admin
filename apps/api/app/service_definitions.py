"""Canonical service-driven work-form definitions for Lingvo Connect.

Phase 14 turns Oleg's order-registration matrix into explicit system metadata.
The API owns this metadata; the frontend consumes it from /crm/services so the
work editor does not grow a parallel forest of service-specific hard-coded forms.

The definitions describe *which business fields exist* for a service. They do
not introduce client wallet/deposit logic; that remains deliberately out of
scope until the website/customer-account integration phase.
"""

from __future__ import annotations

from typing import Any


# Field keys are stable API/UI contract names.  Their ordering is the form order.
SERVICE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "written_translation": {
        "category": "text",
        "fields": [
            "source_language", "target_language", "character_count", "page_count",
            "topic", "translator_type", "markup", "discount", "deadline",
            "deadline_time", "status", "notes",
        ],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": True,
    },
    "editing": {
        "category": "text",
        "fields": [
            "source_language", "target_language", "character_count", "page_count",
            "topic", "translator_type", "markup", "discount", "deadline",
            "deadline_time", "status", "notes",
        ],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": False,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
    },
    "proofreading": {
        "category": "text",
        "fields": [
            "source_language", "target_language", "character_count", "page_count",
            "topic", "translator_type", "markup", "discount", "deadline",
            "deadline_time", "status", "notes",
        ],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": False,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
    },
    "typing": {
        "category": "text",
        "fields": [
            "source_language", "character_count", "page_count", "topic",
            "translator_type", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SOURCE_LANGUAGE",
        "supports_routing": False,
    },
    "notarial_certification": {
        "category": "certification",
        "fields": [
            "document_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "company_certification": {
        "category": "certification",
        "fields": [
            "certification_mode", "document_count", "page_count", "markup", "discount",
            "deadline", "deadline_time", "status", "notes",
        ],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT", "PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "variants": {
            "BOUND": {
                "label": "Сшивка",
                "billing_unit": "PER_DOCUMENT",
                "fields": ["document_count"],
            },
            "PER_PAGE": {
                "label": "Постранично",
                "billing_unit": "PER_PAGE",
                "fields": ["page_count"],
            },
        },
        "default_variant": "BOUND",
    },
    "apostille": {
        "category": "certification",
        "fields": [
            "document_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "notarial_copy": {
        "category": "certification",
        "fields": [
            "page_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "text_layout": {
        "category": "layout",
        "fields": [
            "page_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "drawing_layout": {
        "category": "layout",
        "fields": [
            "page_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "recognition": {
        "category": "layout",
        "fields": [
            "page_count", "markup", "discount", "deadline", "deadline_time",
            "status", "notes",
        ],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "delivery": {
        "category": "additional",
        "fields": ["start_date", "start_time", "deadline", "deadline_time", "status", "notes"],
        "billing_unit": "FIXED",
        "allowed_billing_units": ["FIXED"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "audio_listening": {
        "category": "audio_video",
        "fields": ["duration_seconds", "status", "notes"],
        "billing_unit": "PER_SECOND",
        "allowed_billing_units": ["PER_SECOND"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "transcription": {
        "category": "audio_video",
        "fields": ["character_count", "page_count", "status", "notes"],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
    },
    "consecutive_interpreting": {
        "category": "interpreting",
        "fields": [
            "source_language", "target_language", "hour_count", "topic", "start_date",
            "start_time", "deadline", "deadline_time", "status", "notes",
        ],
        "billing_unit": "HOURLY",
        "allowed_billing_units": ["HOURLY"],
        "page_from_characters": False,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
    },
    "simultaneous_interpreting": {
        "category": "interpreting",
        "fields": [
            "source_language", "target_language", "hour_count", "topic", "start_date",
            "start_time", "deadline", "deadline_time", "status", "notes",
        ],
        "billing_unit": "HOURLY",
        "allowed_billing_units": ["HOURLY"],
        "page_from_characters": False,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
    },
}

# Existing installations may contain this pre-matrix service key.  The migration
# moves it to proofreading, but keeping the alias makes old snapshots readable.
SERVICE_ALIASES = {"native_proofreading": "proofreading"}


def canonical_service_code(code: str | None) -> str:
    value = (code or "").strip()
    return SERVICE_ALIASES.get(value, value)


def definition_for(code: str | None) -> dict[str, Any] | None:
    return SERVICE_DEFINITIONS.get(canonical_service_code(code))


def definition_view(code: str | None) -> dict[str, Any] | None:
    definition = definition_for(code)
    if not definition:
        return None
    # Return a detached JSON-safe structure so callers never mutate the source.
    result = dict(definition)
    result["fields"] = list(definition.get("fields", []))
    result["allowed_billing_units"] = list(definition.get("allowed_billing_units", []))
    if "variants" in definition:
        result["variants"] = {
            key: {**value, "fields": list(value.get("fields", []))}
            for key, value in definition["variants"].items()
        }
    return result


def billing_unit_for(code: str | None, certification_mode: str = "") -> str | None:
    definition = definition_for(code)
    if not definition:
        return None
    if canonical_service_code(code) == "company_certification":
        variant = (certification_mode or definition.get("default_variant") or "BOUND").upper()
        selected = definition.get("variants", {}).get(variant)
        if selected:
            return str(selected["billing_unit"])
    return str(definition["billing_unit"])


def matching_mode_for(code: str | None) -> str:
    definition = definition_for(code)
    return str(definition.get("matching_mode", "LANGUAGE_PAIR")) if definition else "LANGUAGE_PAIR"


def supports_routing(code: str | None) -> bool:
    definition = definition_for(code)
    return bool(definition and definition.get("supports_routing"))


def fields_for(code: str | None, certification_mode: str = "") -> set[str]:
    definition = definition_for(code)
    if not definition:
        return set()
    fields = set(definition.get("fields", []))
    if canonical_service_code(code) == "company_certification":
        fields.discard("document_count")
        fields.discard("page_count")
        variant = (certification_mode or definition.get("default_variant") or "BOUND").upper()
        selected = definition.get("variants", {}).get(variant)
        if selected:
            fields.update(selected.get("fields", []))
    return fields


def lookup_codes(code: str | None) -> set[str]:
    canonical = canonical_service_code(code)
    values = {canonical} if canonical else set()
    values.update(alias for alias, target in SERVICE_ALIASES.items() if target == canonical)
    return values
