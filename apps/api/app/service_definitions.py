"""Canonical service-driven work-form definitions for Lingvo Connect.

Phase 14 turns Oleg's order-registration matrix into explicit system metadata.
The API owns this metadata; the frontend consumes it from /crm/services so the
work editor does not grow a parallel forest of service-specific hard-coded forms.

The definitions describe *which business fields exist* for a service (``fields``: the
backend keeps only these on save) and *where they stand* (``layout``: the DOCX v3 grid of
2026-10-31, four columns; ``"name:2"`` spans two columns). Layout tokens that are not
business fields — service, tariff, price, files, client_billable, service_variant — are
always available. Fields missing from the layout (work deadline, start date of
interpreting) are still kept and shown in the collapsible «Срок работы» block.
See docs/ORDER_WORK_FIELD_MATRIX.md.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

# DOCX v3 rows shared by the text services (same entity on the same place everywhere).
_TEXT_TAIL = [
    ["translator_type:2", "status:2"],
    ["topic:2", "notes:2"],
    ["markup", "discount", "files:2"],
    ["client_billable:2", "document_names:2"],
]
_LANGUAGE_PAIR_ROW = ["source_language", "target_language", "tariff", "price"]
_SIMPLE_TAIL = [
    ["markup", "discount", "tariff", "price"],
    ["client_billable:2", "status:2"],
    ["notes:4"],
]
_TEXT_FIELDS = [
    "source_language", "target_language", "character_count", "page_count",
    "topic", "translator_type", "markup", "discount", "deadline",
    "deadline_time", "status", "notes", "document_names",
]
_SIMPLE_FIELDS = ["markup", "discount", "deadline", "deadline_time", "status", "notes"]

# Written translation from the tariff grid minus 30 % (DOCX v3 «Вычитка»).
WRITTEN_MINUS_30 = {"service_code": "written_translation", "variant": "CHARACTERS", "rate_factor": "0.7",
                    "label": "Тариф письменного перевода −30 %"}

# Field keys are stable API/UI contract names.
SERVICE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "written_translation": {
        "category": "text",
        "fields": [*_TEXT_FIELDS, "certification_mode"],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE", "PER_DOCUMENT"],
        "page_from_characters": True,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": True,
        # DOCX v3 lists the three scenarios as separate entries of «Услуга»; they stay one
        # service (same tariffs, executors and history) and the entry picks the variant.
        "variant_label": "Способ расчёта",
        "variants_in_service_picker": True,
        "variants": {
            "CHARACTERS": {
                "label": "Письменный перевод (полный)",
                "billing_unit": "CONDITIONAL_PAGE",
                "fields": ["character_count", "page_count"],
            },
            # «то, что было Редактура»: by characters with an automatic 30 % discount
            "REPETITIONS": {
                "label": "Письменный перевод (повторения)",
                "billing_unit": "CONDITIONAL_PAGE",
                "fields": ["character_count", "page_count"],
                "tariff_variant": "CHARACTERS",
                "auto_discount_percent": "30",
                "auto_discount_label": "Повторения −30 %",
            },
            # template documents (passports, certificates...) are priced per document
            "DOCUMENT": {
                "label": "Письменный перевод (шаблон)",
                "billing_unit": "PER_DOCUMENT",
                "fields": ["document_count"],
            },
        },
        "default_variant": "CHARACTERS",
        "layout": [["service:2", "character_count", "page_count", "document_count:2"], _LANGUAGE_PAIR_ROW, *_TEXT_TAIL],
    },
    "editing": {
        "category": "text",
        "fields": list(_TEXT_FIELDS),
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
        "layout": [["service:2", "character_count", "page_count"], _LANGUAGE_PAIR_ROW, *_TEXT_TAIL],
    },
    "proofreading": {
        "category": "text",
        "fields": list(_TEXT_FIELDS),
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
        "pricing_basis": WRITTEN_MINUS_30,
        "layout": [["service:2", "character_count", "page_count"], _LANGUAGE_PAIR_ROW, *_TEXT_TAIL],
    },
    "typing": {
        "category": "text",
        "fields": [field for field in _TEXT_FIELDS if field != "target_language"],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "SOURCE_LANGUAGE",
        "supports_routing": False,
        "layout": [["service:2", "character_count", "page_count"], ["source_language:2", "tariff", "price"], *_TEXT_TAIL],
    },
    "notarial_certification": {
        "category": "certification",
        "fields": ["document_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "document_count:2"], *_SIMPLE_TAIL],
    },
    "company_certification": {
        "category": "certification",
        "fields": ["certification_mode", "document_count", "page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT", "PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "variant_label": "Вариант заверения",
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
        "layout": [
            ["service:2", "document_count:2", "page_count:2"],
            ["certification_mode:2", "tariff", "price"],
            ["markup", "discount", "status:2"],
            ["client_billable:2", "notes:2"],
        ],
    },
    "apostille": {
        "category": "certification",
        "fields": ["document_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_DOCUMENT",
        "allowed_billing_units": ["PER_DOCUMENT"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "document_count:2"], *_SIMPLE_TAIL],
    },
    "notarial_copy": {
        "category": "certification",
        "fields": ["page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "page_count:2"], *_SIMPLE_TAIL],
    },
    "text_layout": {
        "category": "layout",
        "fields": ["page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "page_count:2"], *_SIMPLE_TAIL],
    },
    "drawing_layout": {
        "category": "layout",
        "fields": ["page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "page_count:2"], *_SIMPLE_TAIL],
    },
    "recognition": {
        "category": "layout",
        "fields": ["page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "page_count:2"], *_SIMPLE_TAIL],
    },
    # «Скан» (owner 2026-10-31): priced per actual page, same fields as «Распознавание».
    # The service stays disabled until the owner activates it in the settings.
    "scan": {
        "category": "layout",
        "fields": ["page_count", *_SIMPLE_FIELDS],
        "billing_unit": "PER_PAGE",
        "allowed_billing_units": ["PER_PAGE"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "labels": {"page_count": "Количество страниц (фактических)"},
        "layout": [["service:2", "page_count:2"], *_SIMPLE_TAIL],
    },
    "delivery": {
        "category": "additional",
        "fields": ["start_date", "start_time", *_SIMPLE_FIELDS],
        "billing_unit": "FIXED",
        "allowed_billing_units": ["FIXED"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "labels": {"start_date": "Дата", "start_time": "Время"},
        "layout": [["service:2", "start_date", "start_time"], *_SIMPLE_TAIL],
    },
    "audio_listening": {
        "category": "audio_video",
        "fields": ["duration_seconds", "markup", "discount", "status", "notes"],
        "billing_unit": "PER_SECOND",
        "allowed_billing_units": ["PER_SECOND"],
        "page_from_characters": False,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "duration_seconds:2"], *_SIMPLE_TAIL],
    },
    "transcription": {
        "category": "audio_video",
        "fields": [
            "source_language", "character_count", "page_count", "topic", "translator_type",
            "markup", "discount", "status", "notes", "document_names",
        ],
        "billing_unit": "CONDITIONAL_PAGE",
        "allowed_billing_units": ["CONDITIONAL_PAGE"],
        "page_from_characters": True,
        "matching_mode": "SERVICE_ONLY",
        "supports_routing": False,
        "layout": [["service:2", "character_count", "page_count"], ["source_language:2", "tariff", "price"], *_TEXT_TAIL],
    },
    "consecutive_interpreting": {
        "category": "interpreting",
        "fields": [
            "source_language", "target_language", "hour_count", "topic", "translator_type",
            "markup", "discount", "start_date", "start_time", "deadline", "deadline_time",
            "status", "notes", "document_names",
        ],
        "billing_unit": "HOURLY",
        "allowed_billing_units": ["HOURLY"],
        "page_from_characters": False,
        "matching_mode": "LANGUAGE_PAIR",
        "supports_routing": False,
        # one «Устный перевод» entry in the form; the type toggle switches between the two
        # services (their tariffs, executors and history stay separate)
        "service_group": {"code": "interpreting", "label": "Устный перевод", "toggle_label": "Тип перевода", "option_label": "Последовательный"},
        "layout": [
            ["service:2", "hour_count:2"],
            ["service_variant:2", "tariff", "price"],
            ["source_language", "target_language", "status:2"],
            ["translator_type:2", "notes:2"],
            ["topic:2"],
            ["markup", "discount", "files:2"],
            ["client_billable:2", "document_names:2"],
        ],
    },
}
SERVICE_DEFINITIONS["simultaneous_interpreting"] = {
    **SERVICE_DEFINITIONS["consecutive_interpreting"],
    "service_group": {"code": "interpreting", "label": "Устный перевод", "toggle_label": "Тип перевода", "option_label": "Синхронный"},
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
    result["layout"] = [list(row) for row in definition.get("layout", [])]
    if "variants" in definition:
        result["variants"] = {
            key: {**value, "fields": list(value.get("fields", []))}
            for key, value in definition["variants"].items()
        }
    return result


def variant_for(code: str | None, certification_mode: str = "") -> str:
    """Effective pricing variant of a service ("" when the service has no variants).

    ``certification_mode`` is the historical column name; it now stores the variant of
    any service that defines ``variants`` (company certification, written translation).
    """
    definition = definition_for(code)
    variants = (definition or {}).get("variants") or {}
    if not variants:
        return ""
    requested = (certification_mode or "").upper()
    return requested if requested in variants else str(definition.get("default_variant") or next(iter(variants)))


def billing_unit_for(code: str | None, certification_mode: str = "") -> str | None:
    definition = definition_for(code)
    if not definition:
        return None
    variant = variant_for(code, certification_mode)
    if variant:
        return str(definition["variants"][variant]["billing_unit"])
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
    variant = variant_for(code, certification_mode)
    if variant:
        # volume fields belong to the variants: keep only the selected variant's ones
        for option in definition["variants"].values():
            fields.difference_update(option.get("fields", []))
        fields.update(definition["variants"][variant].get("fields", []))
    return fields


def lookup_codes(code: str | None) -> set[str]:
    canonical = canonical_service_code(code)
    values = {canonical} if canonical else set()
    values.update(alias for alias, target in SERVICE_ALIASES.items() if target == canonical)
    return values


def pricing_basis_for(code: str | None) -> tuple[str, str, Decimal]:
    """Service whose tariffs price this one, its variant and the rate factor.

    «Вычитка» is priced by the written-translation grid minus 30 % (DOCX v3); every other
    service is priced by its own tariffs (factor 1).
    """
    canonical = canonical_service_code(code)
    basis = (definition_for(code) or {}).get("pricing_basis")
    if not basis:
        return canonical, "", Decimal("1")
    return str(basis["service_code"]), str(basis.get("variant") or ""), Decimal(str(basis["rate_factor"]))


def tariff_variant_for(code: str | None, certification_mode: str = "") -> str:
    """Variant whose price list applies («повторения» use the full-translation prices)."""
    variant = variant_for(code, certification_mode)
    option = ((definition_for(code) or {}).get("variants") or {}).get(variant) or {}
    return str(option.get("tariff_variant") or variant)


def auto_discount_for(code: str | None, certification_mode: str = "") -> tuple[Decimal, str] | None:
    """Fixed automatic discount of a variant (replaces volume/client discounts), if any."""
    variant = variant_for(code, certification_mode)
    option = ((definition_for(code) or {}).get("variants") or {}).get(variant) or {}
    if "auto_discount_percent" not in option:
        return None
    return Decimal(str(option["auto_discount_percent"])), str(option.get("auto_discount_label") or "")
