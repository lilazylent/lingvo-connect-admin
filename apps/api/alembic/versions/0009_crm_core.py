"""CRM core: services, tariffs, work pricing metadata, payments and file analysis."""

import sqlalchemy as sa
from alembic import op

revision = "0009_crm_core"
down_revision = "0008_order_files"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "service_types",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("billing_mode", sa.String(40), nullable=False, server_default="CUSTOM"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code", name="uq_service_types_code"),
    )
    op.create_index("ix_service_types_code", "service_types", ["code"])
    op.create_index("ix_service_types_name", "service_types", ["name"])
    op.create_index("ix_service_types_active", "service_types", ["active"])

    op.create_table(
        "tariffs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("service_code", sa.String(64), nullable=False),
        sa.Column("source_language", sa.String(80), nullable=False, server_default=""),
        sa.Column("target_language", sa.String(80), nullable=False, server_default=""),
        sa.Column("direction", sa.String(32), nullable=False, server_default="ANY"),
        sa.Column("unit", sa.String(32), nullable=False, server_default="CONDITIONAL_PAGE"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("min_quantity", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("urgency_multiplier", sa.Numeric(8, 4), nullable=False, server_default="1.50"),
        sa.Column("native_multiplier", sa.Numeric(8, 4), nullable=False, server_default="1.00"),
        sa.Column("active_from", sa.Date(), nullable=True),
        sa.Column("active_to", sa.Date(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("service_code", "source_language", "target_language", "direction", "unit", "active_from", name="uq_tariff_business_key"),
    )
    for column in ["service_code", "source_language", "target_language", "direction", "active"]:
        op.create_index(f"ix_tariffs_{column}", "tariffs", [column])

    work_columns = [
        sa.Column("service_code", sa.String(64), nullable=False, server_default="written_translation"),
        sa.Column("topic", sa.String(160), nullable=False, server_default=""),
        sa.Column("urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("native_speaker", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("character_count", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Numeric(10, 2), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=True),
        sa.Column("billing_unit", sa.String(32), nullable=False, server_default="CUSTOM"),
        sa.Column("client_rate", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("auto_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("price_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("price_override_reason", sa.String(500), nullable=False, server_default=""),
        sa.Column("executor_rate", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("executor_billing_unit", sa.String(32), nullable=False, server_default="CUSTOM"),
        sa.Column("executor_auto_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("executor_cost_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("executor_deadline", sa.Date(), nullable=True),
        sa.Column("deadline_time", sa.String(5), nullable=False, server_default=""),
        sa.Column("executor_deadline_time", sa.String(5), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
    ]
    for column in work_columns:
        op.add_column("order_works", column)
    op.create_index("ix_order_works_service_code", "order_works", ["service_code"])
    op.create_index("ix_order_works_deadline", "order_works", ["deadline"])

    op.create_table(
        "pricing_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("rule_type", sa.String(40), nullable=False),
        sa.Column("service_code", sa.String(64), nullable=False, server_default=""),
        sa.Column("threshold_from", sa.Numeric(14, 4), nullable=True),
        sa.Column("threshold_to", sa.Numeric(14, 4), nullable=True),
        sa.Column("percent", sa.Numeric(8, 4), nullable=False, server_default="0"),
        sa.Column("multiplier", sa.Numeric(8, 4), nullable=False, server_default="1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pricing_rules_code", "pricing_rules", ["code"])
    op.create_index("ix_pricing_rules_rule_type", "pricing_rules", ["rule_type"])
    op.create_index("ix_pricing_rules_service_code", "pricing_rules", ["service_code"])
    op.create_index("ix_pricing_rules_active", "pricing_rules", ["active"])

    op.create_table(
        "client_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount_due", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("payment_method", sa.String(64), nullable=False, server_default=""),
        sa.Column("invoice_number", sa.String(80), nullable=False, server_default=""),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", name="uq_client_payments_order_id"),
    )
    op.create_index("ix_client_payments_order_id", "client_payments", ["order_id"])

    op.create_table(
        "executor_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("work_id", sa.String(36), sa.ForeignKey("order_works.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("executor_id", sa.String(36), sa.ForeignKey("executors.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("amount_due", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("work_id", name="uq_executor_payments_work_id"),
    )
    op.create_index("ix_executor_payments_work_id", "executor_payments", ["work_id"])
    op.create_index("ix_executor_payments_executor_id", "executor_payments", ["executor_id"])

    for name, type_ in [
        ("page_count", sa.Integer()),
        ("character_count", sa.Integer()),
        ("word_count", sa.Integer()),
    ]:
        op.add_column("order_files", sa.Column(name, type_, nullable=True))
    op.add_column("order_files", sa.Column("analysis_status", sa.String(32), nullable=False, server_default="PENDING"))
    op.add_column("order_files", sa.Column("analysis_note", sa.String(500), nullable=False, server_default=""))

    import uuid
    from datetime import datetime, timezone
    bind = op.get_bind()
    now = datetime.now(timezone.utc)

    rules_table = sa.table("pricing_rules", sa.column("id"), sa.column("code"), sa.column("name"), sa.column("rule_type"), sa.column("service_code"), sa.column("threshold_from"), sa.column("threshold_to"), sa.column("percent"), sa.column("multiplier"), sa.column("active"), sa.column("notes"), sa.column("created_at"), sa.column("updated_at"))
    for code, name, low, high, percent in [
        ("volume_discount_5", "Скидка 5%: 20–99 усл. страниц", 20, 99, 5),
        ("volume_discount_10", "Скидка 10%: 100–499 усл. страниц", 100, 499, 10),
        ("volume_discount_15", "Скидка 15%: 500+ усл. страниц", 500, None, 15),
    ]:
        bind.execute(rules_table.insert().values(id=str(uuid.uuid4()), code=code, name=name, rule_type="VOLUME_DISCOUNT", service_code="written_translation", threshold_from=low, threshold_to=high, percent=percent, multiplier=1, active=True, notes="Тарифы Лингво Коннект 2026", created_at=now, updated_at=now))

    service_rows = [
        ("apostille", "Апостиль", "PER_DOCUMENT"),
        ("audio_listening", "Аудирование", "PER_SECOND"),
        ("text_layout", "Вёрстка текста", "PER_PAGE"),
        ("drawing_layout", "Вёрстка чертежей", "PER_PAGE"),
        ("native_proofreading", "Вычитка носителем", "PERCENT_OF_BASE_SERVICE"),
        ("delivery", "Доставка", "CUSTOM"),
        ("company_certification", "Наше заверение", "PER_DOCUMENT"),
        ("notarial_certification", "Нотариальное заверение", "PER_DOCUMENT"),
        ("typing", "Набор текста", "PERCENT_OF_BASE_SERVICE"),
        ("notarial_copy", "Нотариальная копия", "PER_PAGE"),
        ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
        ("recognition", "Распознавание", "PER_PAGE"),
        ("editing", "Редактура", "PERCENT_OF_BASE_SERVICE"),
        ("scan", "Скан", "PER_PAGE"),
        ("transcription", "Транскрибация", "PER_MINUTE"),
        ("consecutive_interpreting", "Устный последовательный перевод", "HOURLY"),
        ("simultaneous_interpreting", "Устный синхронный перевод", "HOURLY"),
    ]
    table = sa.table("service_types", sa.column("id"), sa.column("code"), sa.column("name"), sa.column("billing_mode"), sa.column("active"), sa.column("sort_order"), sa.column("notes"), sa.column("created_at"), sa.column("updated_at"))
    for index, (code, name, mode) in enumerate(service_rows, 1):
        bind.execute(table.insert().values(id=str(uuid.uuid4()), code=code, name=name, billing_mode=mode, active=True, sort_order=index * 10, notes="", created_at=now, updated_at=now))

    # Authoritative rows from the supplied “Тарифы Лингво Коннект 2026” sheet.
    # Empty native-speaker cells are represented by None and are not auto-priced.
    language_tariffs = [
        ("Английский", 540, 590, 2200),
        ("Азербайджанский", 690, 790, None),
        ("Албанский", 890, 990, 2200),
        ("Арабский", 1090, 1290, 2200),
        ("Армянский", 690, 790, None),
        ("Белорусский", 540, 590, None),
        ("Болгарский", 790, 890, 2200),
        ("Венгерский", 890, 990, 2200),
        ("Вьетнамский", 1090, 1290, 2200),
        ("Греческий", 890, 990, 2200),
        ("Грузинский", 790, 890, 2200),
        ("Датский", 940, 1040, 2200),
        ("Иврит", 1090, 1290, 2200),
        ("Индонезийский", 1090, 1290, 2200),
        ("Испанский", 690, 790, 2200),
        ("Итальянский", 690, 790, 2200),
        ("Казахский", 690, 790, None),
        ("Киргизский", 690, 790, None),
        ("Китайский", 1090, 1290, 2200),
        ("Корейский", 1090, 1290, 2200),
        ("Латышский", 940, 1040, 2200),
        ("Литовский", 940, 1040, 2200),
        ("Немецкий", 690, 790, 2200),
        ("Нидерландский", 940, 1040, 2200),
        ("Норвежский", 940, 1040, 2200),
        ("Польский", 790, 890, 2200),
        ("Португальский", 790, 890, 2200),
        ("Румынский", 790, 890, 2200),
        ("Сербский", 790, 890, 2200),
        ("Словацкий", 790, 890, 2200),
        ("Словенский", 790, 890, 2200),
        ("Таджикский", 690, 790, None),
        ("Тайский", 1090, 1290, 2200),
        ("Турецкий", 940, 1040, 2200),
        ("Туркменский", 690, 790, None),
        ("Узбекский", 690, 790, None),
        ("Украинский", 540, 590, None),
        ("Фарси", 1090, 1290, 2200),
        ("Финский", 940, 1040, 2200),
        ("Французский", 690, 790, 2200),
        ("Хинди", 1090, 1290, 2200),
        ("Хорватский", 790, 890, 2200),
        ("Чешский", 790, 890, 2200),
        ("Шведский", 940, 1040, 2200),
        ("Эстонский", 940, 1040, 2200),
        ("Японский", 1090, 1290, 2200),
    ]
    tariffs_table = sa.table(
        "tariffs", sa.column("id"), sa.column("service_code"), sa.column("source_language"),
        sa.column("target_language"), sa.column("direction"), sa.column("unit"), sa.column("amount"),
        sa.column("min_quantity"), sa.column("urgency_multiplier"), sa.column("native_multiplier"),
        sa.column("active_from"), sa.column("active_to"), sa.column("active"), sa.column("notes"),
        sa.column("created_at"), sa.column("updated_at")
    )
    for language, to_russian, from_russian, native in language_tariffs:
        base = dict(service_code="written_translation", unit="CONDITIONAL_PAGE", min_quantity=1, urgency_multiplier=1.5, native_multiplier=1, active_from=None, active_to=None, active=True, notes="Тарифы Лингво Коннект 2026", created_at=now, updated_at=now)
        bind.execute(tariffs_table.insert().values(id=str(uuid.uuid4()), source_language=language, target_language="Русский", direction="TO_RUSSIAN", amount=to_russian, **base))
        bind.execute(tariffs_table.insert().values(id=str(uuid.uuid4()), source_language="Русский", target_language=language, direction="FROM_RUSSIAN", amount=from_russian, **base))
        if native is not None:
            bind.execute(tariffs_table.insert().values(id=str(uuid.uuid4()), source_language="", target_language=language, direction="NATIVE_SPEAKER", amount=native, **base))


def downgrade():
    for name in ["analysis_note", "analysis_status", "word_count", "character_count", "page_count"]:
        op.drop_column("order_files", name)
    op.drop_table("executor_payments")
    op.drop_table("client_payments")
    op.drop_index("ix_order_works_deadline", table_name="order_works")
    op.drop_index("ix_order_works_service_code", table_name="order_works")
    for name in ["sort_order", "executor_deadline_time", "deadline_time", "executor_deadline", "executor_cost_overridden", "executor_auto_cost", "executor_billing_unit", "executor_rate", "price_override_reason", "price_overridden", "auto_price", "client_rate", "billing_unit", "word_count", "page_count", "character_count", "native_speaker", "urgent", "topic", "service_code"]:
        op.drop_column("order_works", name)
    op.drop_table("pricing_rules")
    op.drop_table("tariffs")
    op.drop_table("service_types")
