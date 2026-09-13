"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { UserSummary } from "@/lib/types";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "./ui";
import { CrmLookup } from "./crm-lookup";
import { LanguageCombobox } from "./language-combobox";
import { OrderRecords } from "./crm-order-records";

type Money = string | number;
type Page<T> = { items: T[]; total: number; page: number; pages: number };
type Service = {
  id: string;
  code: string;
  name: string;
  billing_mode: string;
  active: boolean;
};
type Order = {
  id: string;
  number: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
  manager_id: string | null;
  application_id: string | null;
  deadline: string | null;
  status: string;
  notes: string;
  version: number;
  archived: boolean;
  created_at: string;
};
type Work = {
  id: string;
  service_code: string;
  work_type: string;
  source_language: string;
  target_language: string;
  tariff_ids: string;
  topic: string;
  urgent: boolean;
  native_speaker: boolean;
  character_count: number | null;
  page_count: Money | null;
  word_count: number | null;
  billing_unit: string;
  client_rate: Money;
  auto_price: Money;
  price: Money;
  price_overridden: boolean;
  price_override_reason: string;
  executor_id: string | null;
  executor_rate: Money;
  executor_billing_unit: string;
  executor_auto_cost: Money;
  executor_cost: Money;
  executor_cost_overridden: boolean;
  deadline: string | null;
  deadline_time: string;
  executor_deadline: string | null;
  executor_deadline_time: string;
  status: string;
  notes: string;
  version: number;
  sort_order: number;
};
type Payment = {
  id: string;
  amount_due: Money;
  amount_paid: Money;
  payment_method: string;
  invoice_number: string;
  invoice_date: string | null;
  paid_at: string | null;
  notes: string;
  version: number;
};
type OrderDetail = Order & {
  works: Work[];
  payment: Payment | null;
  files: OrderFile[];
  financial: Financial;
  client_name: string;
  contact_name: string;
  manager_name: string;
};
type Financial = {
  revenue: Money;
  executor_cost: Money;
  profit: Money;
  margin_percent: Money;
  client_paid: Money;
  client_debt: Money;
};
type OrderFile = {
  id: string;
  original_name: string;
  page_count: number | null;
  character_count: number | null;
  word_count: number | null;
  analysis_status: string;
  analysis_note: string;
  created_at: string;
};
type Analysis = {
  page_count: number | null;
  character_count: number | null;
  word_count: number | null;
  analysis_status: string;
  analysis_note: string;
};

type TariffOption = {
  key: string;
  tariff_ids: string[];
  resolution: string;
  rate: Money;
  unit: string;
  amount: Money;
  quantity: Money;
  base_amount: Money;
  surcharge_multiplier: Money;
  before_discount: Money;
  discount_percent: Money;
  discount_amount: Money;
  source_language: string;
  target_language: string;
  directions: string[];
  discount_name?: string | null;
  is_auto: boolean;
};
type DraftWork = {
  key: string;
  service_code: string;
  work_type: string;
  source_language: string;
  target_language: string;
  tariff_ids: string[];
  topic: string;
  urgent: boolean;
  native_speaker: boolean;
  character_count: string;
  page_count: string;
  word_count: string;
  billing_unit: string;
  client_rate: string;
  price: string;
  manualPrice: boolean;
  executor_id: string;
  executor_rate: string;
  executor_billing_unit: string;
  executor_cost: string;
  manualExecutorCost: boolean;
  deadline: string;
  deadline_time: string;
  executor_deadline: string;
  executor_deadline_time: string;
  status: string;
  notes: string;
  quoteAmount: string;
  quoteRate: string;
  quoteUnit: string;
  quoteMessage: string;
};

export const workTypes = [
  ["written_translation", "Письменный перевод"],
  ["interpreting", "Устный перевод"],
  ["certification", "Заверение"],
  ["localization", "Локализация"],
  ["audio_video", "Аудио и видео"],
  ["linguistic_support", "Лингвистическое сопровождение"],
  ["editing", "Редактура"],
  ["proofreading", "Корректура"],
  ["layout", "Вёрстка"],
] as const;

const orderStatuses = [
  ["NEW", "Новый"],
  ["ESTIMATING", "В расчёте"],
  ["APPROVED", "Согласован"],
  ["IN_PROGRESS", "В работе"],
  ["REVIEW", "На проверке"],
  ["READY", "Готов"],
  ["DELIVERED", "Выдан"],
  ["COMPLETED", "Завершён"],
  ["CANCELLED", "Отменён"],
] as const;
type StatusOption = {
  code: string;
  name: string;
  color: string;
  active: boolean;
  sort_order: number;
};
const fallbackStatuses: StatusOption[] = orderStatuses.map(
  ([code, name], index) => ({
    code,
    name,
    color: [
      "blue",
      "violet",
      "cyan",
      "amber",
      "violet",
      "green",
      "cyan",
      "green",
      "rose",
    ][index],
    active: true,
    sort_order: (index + 1) * 10,
  }),
);
const workStatuses = [
  ["NEW", "Новая"],
  ["IN_PROGRESS", "В работе"],
  ["REVIEW", "На проверке"],
  ["COMPLETED", "Готово"],
  ["CANCELLED", "Отменена"],
] as const;
const billingUnits = [
  ["CONDITIONAL_PAGE", "Усл. страница / 1800 знаков"],
  ["PER_1000_CHARS", "За 1000 знаков"],
  ["PER_PAGE", "За страницу"],
  ["PER_DOCUMENT", "За документ"],
  ["PER_MINUTE", "За минуту"],
  ["HOURLY", "За час"],
  ["FIXED", "Фиксированная"],
  ["CUSTOM", "Своя единица"],
] as const;
const statusLabel = (
  status: string,
  options: StatusOption[] = fallbackStatuses,
) => options.find((option) => option.code === status)?.name ?? status;
const rub = (value: Money | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
const tariffMessage = (option: TariffOption, automatic = option.is_auto) => {
  const quantity = Number(option.quantity ?? 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  });
  const multiplier = Number(option.surcharge_multiplier ?? 1);
  const discount = Number(option.discount_percent ?? 0);
  const route =
    option.resolution === "via_russian"
      ? "через русский"
      : option.resolution === "native_speaker"
        ? "носитель"
        : "по языковой паре";
  return `${automatic ? "Тариф подобран CRM" : "Тариф выбран менеджером"}: ${rub(option.rate)} × ${quantity} усл. стр.${multiplier > 1 ? ` × ${multiplier} срочность` : ""}${discount > 0 ? ` − ${discount}% скидка` : ""} · ${route}`;
};
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyWork = (): DraftWork => ({
  key: newKey(),
  service_code: "",
  work_type: "written_translation",
  source_language: "",
  target_language: "",
  tariff_ids: [],
  topic: "",
  urgent: false,
  native_speaker: false,
  character_count: "",
  page_count: "",
  word_count: "",
  billing_unit: "CUSTOM",
  client_rate: "0",
  price: "0",
  manualPrice: false,
  executor_id: "",
  executor_rate: "0",
  executor_billing_unit: "CUSTOM",
  executor_cost: "0",
  manualExecutorCost: false,
  deadline: "",
  deadline_time: "",
  executor_deadline: "",
  executor_deadline_time: "",
  status: "NEW",
  notes: "",
  quoteAmount: "",
  quoteRate: "",
  quoteUnit: "",
  quoteMessage: "",
});

function localPrice(work: DraftWork, executor = false) {
  if (
    !executor &&
    !work.manualPrice &&
    work.quoteAmount &&
    Number(work.client_rate || 0) === 0
  )
    return Number(work.quoteAmount);
  const unit = executor ? work.executor_billing_unit : work.billing_unit;
  const rate = Number(executor ? work.executor_rate : work.client_rate) || 0;
  let quantity = 0;
  if (unit === "CONDITIONAL_PAGE")
    quantity = work.character_count
      ? Math.max(
          1,
          Math.round((Number(work.character_count) / 1800) * 100) / 100,
        )
      : Number(work.page_count || 0);
  else if (unit === "PER_1000_CHARS")
    quantity = Number(work.character_count || 0) / 1000;
  else if (unit === "PER_PAGE") quantity = Number(work.page_count || 0);
  else if (unit === "PER_DOCUMENT" || unit === "CUSTOM" || unit === "HOURLY")
    quantity = Number(work.page_count || 1);
  else if (unit === "FIXED") quantity = 1;
  let result = quantity * rate;
  if (!executor && work.urgent) result *= 1.5;
  return Math.round(result * 100) / 100;
}

export function CrmOrders() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Page<Order> | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [overdue, setOverdue] = useState("");
  const [paid, setPaid] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"table" | "kanban">("table");
  const [statusOptions, setStatusOptions] =
    useState<StatusOption[]>(fallbackStatuses);
  const [wizard, setWizard] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const applicationId = searchParams.get("application_id") ?? "";
  const openId = searchParams.get("open") ?? "";

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        status,
        archived: String(archived),
        page: String(page),
        page_size: "100",
      });
      if (overdue) params.set("overdue", overdue);
      if (paid) params.set("paid", paid);
      if (language) params.set("language", language);
      const result = await api<Page<Order>>(
        `/api/admin/crm/orders?${params.toString()}`,
      );
      setData(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказы");
    }
  }, [query, status, archived, overdue, paid, language, page]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    api<StatusOption[]>("/api/admin/crm/order-statuses")
      .then((rows) => {
        if (rows.length) setStatusOptions(rows);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (applicationId) setWizard(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applicationId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (openId) setSelectedId(openId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openId]);

  return (
    <>
      <header className="page-head page-head--compact crm-orders-head">
        <div>
          <span className="overline overline--accent">CRM / 04</span>
          <h1>Заказы</h1>
          <p>
            Рабочий центр: регистрация, расчёт, исполнители, сроки, файлы и
            прибыль в одном заказе.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedId(null);
            setWizard(true);
          }}
        >
          Новый заказ +
        </Button>
      </header>
      {error && <ErrorState message={error} />}
      <section className="crm-commandbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load();
          }}
          className="crm-commandbar__search"
        >
          <Input
            label="Поиск"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="№ заказа или название"
          />
          <Button variant="secondary">Найти</Button>
        </form>
        <Select
          label="Статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {statusOptions
            .filter((s) => s.active)
            .map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
        </Select>
        <Input
          label="Язык"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
          placeholder="RU / EN / Немецкий"
        />
        <Select
          label="Срок"
          value={overdue}
          onChange={(e) => {
            setOverdue(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все сроки</option>
          <option value="true">Просроченные</option>
          <option value="false">Не просроченные</option>
        </Select>
        <Select
          label="Оплата"
          value={paid}
          onChange={(e) => {
            setPaid(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы оплаты</option>
          <option value="true">Оплачено</option>
          <option value="false">Ожидает оплаты</option>
        </Select>
        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          <span className="archive-toggle__box" />
          <span className="archive-toggle__label">Архив</span>
        </label>
        <div
          className="view-switch"
          role="group"
          aria-label="Представление заказов"
        >
          <button
            type="button"
            className={mode === "table" ? "is-active" : ""}
            onClick={() => setMode("table")}
          >
            Таблица
          </button>
          <button
            type="button"
            className={mode === "kanban" ? "is-active" : ""}
            onClick={() => setMode("kanban")}
          >
            Kanban
          </button>
        </div>
      </section>
      {wizard && (
        <OrderWizard
          applicationId={applicationId}
          statuses={statusOptions}
          onClose={() => setWizard(false)}
          onCreated={(id) => {
            setWizard(false);
            setSelectedId(id);
            void load();
          }}
        />
      )}
      {selectedId && (
        <OrderCard
          orderId={selectedId}
          statuses={statusOptions}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
      {!data ? (
        <LoadingState label="Загружаем заказы" />
      ) : mode === "table" ? (
        <OrdersTable
          data={data}
          statuses={statusOptions}
          page={page}
          setPage={setPage}
          select={setSelectedId}
        />
      ) : (
        <OrdersKanban
          orders={data.items}
          statuses={statusOptions}
          select={setSelectedId}
          onChanged={load}
        />
      )}
    </>
  );
}

function OrdersTable({
  data,
  statuses,
  page,
  setPage,
  select,
}: {
  data: Page<Order>;
  statuses: StatusOption[];
  page: number;
  setPage: (n: number) => void;
  select: (id: string) => void;
}) {
  return (
    <section className="table-surface crm-order-table">
      <div className="table-caption">Всего заказов: {data.total}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Название</th>
              <th>Дедлайн</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    className="crm-record-link"
                    onClick={() => select(o.id)}
                  >
                    {o.number}
                  </button>
                </td>
                <td>{o.title || "Без названия"}</td>
                <td>{o.deadline || "—"}</td>
                <td>
                  <Badge
                    tone={
                      o.status === "COMPLETED"
                        ? "success"
                        : o.deadline &&
                            o.deadline < new Date().toISOString().slice(0, 10)
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {statusLabel(o.status, statuses)}
                  </Badge>
                </td>
                <td>
                  <Button variant="quiet" onClick={() => select(o.id)}>
                    Открыть →
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && <p className="crm-empty">Заказов пока нет.</p>}
      <div className="pagination">
        <Button
          variant="quiet"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Назад
        </Button>
        <span>
          {page} / {data.pages}
        </span>
        <Button
          variant="quiet"
          disabled={page >= data.pages}
          onClick={() => setPage(page + 1)}
        >
          Далее →
        </Button>
      </div>
    </section>
  );
}

function OrdersKanban({
  orders,
  statuses,
  select,
  onChanged,
}: {
  orders: Order[];
  statuses: StatusOption[];
  select: (id: string) => void;
  onChanged: () => void;
}) {
  const visible = statuses
    .filter((status) => status.active && status.code !== "CANCELLED")
    .sort((a, b) => a.sort_order - b.sort_order);
  const [moving, setMoving] = useState("");
  async function move(id: string, status: string) {
    if (!id || moving) return;
    setMoving(id);
    try {
      await api(`/api/admin/crm/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await onChanged();
    } finally {
      setMoving("");
    }
  }
  return (
    <section className="kanban-board">
      {visible.map((status) => {
        const value = status.code;
        return (
          <div
            className={`kanban-column status-color--${status.color}`}
            key={value}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void move(e.dataTransfer.getData("text/order-id"), value);
            }}
          >
            <header>
              <strong>{status.name}</strong>
              <span>{orders.filter((o) => o.status === value).length}</span>
            </header>
            <div className="kanban-stack">
              {orders
                .filter((o) => o.status === value)
                .map((o) => (
                  <article
                    key={o.id}
                    className={`kanban-card ${moving === o.id ? "is-moving" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/order-id", o.id);
                    }}
                  >
                    <button
                      className="kanban-card__main"
                      onClick={() => select(o.id)}
                    >
                      <span>{o.number}</span>
                      <strong>{o.title || "Заказ без названия"}</strong>
                      <small>
                        {o.deadline ? `Срок ${o.deadline}` : "Срок не указан"}
                      </small>
                    </button>
                    <Select
                      label="Сменить статус"
                      hideLabel
                      value={o.status}
                      onChange={(e) => void move(o.id, e.target.value)}
                    >
                      {statuses
                        .filter((s) => s.active || s.code === o.status)
                        .map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                    </Select>
                  </article>
                ))}
              {!orders.some((o) => o.status === value) && (
                <p className="kanban-empty">Перетащите заказ сюда</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function OrderWizard({
  applicationId,
  statuses,
  onClose,
  onCreated,
}: {
  applicationId: string;
  statuses: StatusOption[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [client, setClient] = useState("");
  const [contact, setContact] = useState("");
  const [manager, setManager] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("NEW");
  const [works, setWorks] = useState<DraftWork[]>([emptyWork()]);
  const [services, setServices] = useState<Service[]>([]);
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [payment, setPayment] = useState({
    amount_paid: "0",
    payment_method: "",
    invoice_number: "",
    invoice_date: "",
    paid_at: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tariffOptions, setTariffOptions] = useState<
    Record<string, TariffOption[]>
  >({});
  useEffect(() => {
    api<Service[]>("/api/admin/crm/services?active=true")
      .then(setServices)
      .catch((e) => setError(e.message));
    api<UserSummary[]>("/api/admin/applications/managers")
      .then(setManagers)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!applicationId) return;
    api<{
      name: string;
      number: string;
      message: string;
      internal_summary: string | null;
      desired_date: string | null;
      responsible_manager: UserSummary | null;
    }>(`/api/admin/applications/${applicationId}`)
      .then((a) => {
        setTitle(`${a.name} — ${a.number}`);
        setNotes(a.internal_summary || a.message);
        setManager(a.responsible_manager?.id || "");
        if (a.desired_date)
          setWorks((ws) =>
            ws.map((w, i) =>
              i === 0 ? { ...w, deadline: a.desired_date || "" } : w,
            ),
          );
      })
      .catch((e) => setError(e.message));
  }, [applicationId]);
  const clientTotal = useMemo(
    () =>
      works.reduce(
        (sum, w) =>
          sum + (w.manualPrice ? Number(w.price || 0) : localPrice(w)),
        0,
      ),
    [works],
  );
  const paidAmount = Math.max(0, Number(payment.amount_paid || 0) || 0);
  const remainingTotal = Math.max(0, clientTotal - paidAmount);
  const executorTotal = useMemo(
    () =>
      works.reduce(
        (sum, w) =>
          sum +
          (w.manualExecutorCost
            ? Number(w.executor_cost || 0)
            : localPrice(w, true)),
        0,
      ),
    [works],
  );
  const patchWork = (key: string, patch: Partial<DraftWork>) =>
    setWorks((items) =>
      items.map((w) => (w.key === key ? { ...w, ...patch } : w)),
    );
  async function resolveTariff(work: DraftWork) {
    if (!work.service_code) {
      setTariffOptions((current) => ({ ...current, [work.key]: [] }));
      patchWork(work.key, {
        tariff_ids: [],
        quoteAmount: "",
        quoteRate: "",
        quoteUnit: "",
        quoteMessage:
          "Услугу можно выбрать позже — автотариф пока не применяется.",
      });
      return;
    }
    try {
      const result = await api<{ options: TariffOption[]; auto_key: string }>(
        "/api/admin/crm/pricing/options",
        {
          method: "POST",
          body: JSON.stringify({
            service_code: work.service_code,
            source_language: work.source_language,
            target_language: work.target_language,
            character_count: work.character_count
              ? Number(work.character_count)
              : null,
            page_count: work.page_count ? Number(work.page_count) : null,
            urgent: work.urgent,
            native_speaker: work.native_speaker,
          }),
        },
      );
      setTariffOptions((current) => ({
        ...current,
        [work.key]: result.options,
      }));
      const currentKey = work.tariff_ids.join(",");
      const selected =
        result.options.find((option) => option.key === currentKey) ||
        result.options.find((option) => option.key === result.auto_key) ||
        result.options[0];
      if (selected)
        patchWork(work.key, {
          tariff_ids: selected.tariff_ids,
          quoteAmount: String(selected.amount ?? 0),
          quoteRate: String(selected.rate ?? 0),
          quoteUnit: selected.unit || work.billing_unit,
          quoteMessage: tariffMessage(selected),
        });
      else
        patchWork(work.key, {
          tariff_ids: [],
          quoteAmount: "",
          quoteRate: "",
          quoteUnit: "",
          quoteMessage:
            "Подходящий тариф не найден. Можно указать ставку вручную.",
        });
    } catch (e) {
      setTariffOptions((current) => ({ ...current, [work.key]: [] }));
      patchWork(work.key, {
        tariff_ids: [],
        quoteAmount: "",
        quoteRate: "",
        quoteUnit: "",
        quoteMessage:
          e instanceof Error ? e.message : "Не удалось подобрать тариф",
      });
    }
  }
  async function analyze(next: File) {
    setFile(next);
    setAnalyzing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("upload", next);
      const result = await api<Analysis>(
        "/api/admin/crm/files/analyze-preview",
        { method: "POST", body: form },
      );
      setAnalysis(result);
      setWorks((ws) =>
        ws.map((w, i) =>
          i === 0
            ? {
                ...w,
                character_count:
                  result.character_count?.toString() ?? w.character_count,
                page_count: result.page_count?.toString() ?? w.page_count,
                word_count: result.word_count?.toString() ?? w.word_count,
              }
            : w,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось проанализировать документ",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        title,
        client_id: client || null,
        contact_id: contact || null,
        manager_id: manager || null,
        application_id: applicationId || null,
        status,
        notes,
        works: works.map((w) => ({
          service_code: w.service_code,
          work_type: w.work_type,
          source_language: w.source_language,
          target_language: w.target_language,
          tariff_ids: w.tariff_ids,
          topic: w.topic,
          urgent: w.urgent,
          native_speaker: w.native_speaker,
          character_count: w.character_count ? Number(w.character_count) : null,
          page_count: w.page_count ? Number(w.page_count) : null,
          word_count: w.word_count ? Number(w.word_count) : null,
          billing_unit: w.billing_unit,
          client_rate: Number(w.client_rate || 0),
          price: w.manualPrice ? Number(w.price || 0) : null,
          price_override_reason: w.manualPrice
            ? "Ручная корректировка менеджером"
            : "",
          executor_id: w.executor_id || null,
          executor_rate: Number(w.executor_rate || 0),
          executor_billing_unit: w.executor_billing_unit,
          executor_cost: w.manualExecutorCost
            ? Number(w.executor_cost || 0)
            : null,
          deadline: w.deadline || null,
          deadline_time: w.deadline_time,
          executor_deadline: w.executor_deadline || null,
          executor_deadline_time: w.executor_deadline_time,
          status: w.status,
          notes: w.notes,
        })),
        payment: {
          ...payment,
          amount_paid: Number(payment.amount_paid || 0),
          invoice_date: payment.invoice_date || null,
          paid_at: payment.paid_at || null,
        },
      };
      const created = await api<OrderDetail>("/api/admin/crm/orders/wizard", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (file) {
        const form = new FormData();
        form.append("upload", file);
        await api(`/api/admin/crm/orders/${created.id}/files/analyze`, {
          method: "POST",
          body: form,
        });
      }
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать заказ");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (step !== 4) return;
    works.forEach((w) => {
      if (
        w.service_code &&
        !w.manualPrice &&
        !w.quoteAmount &&
        Number(w.client_rate || 0) === 0
      )
        void resolveTariff(w);
    });
    // Calculation is intentionally triggered only when the review step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const canNext = true;
  return (
    <section className="crm-wizard">
      <header className="crm-wizard__head">
        <div>
          <span className="overline">Новый заказ</span>
          <h2>Регистрация заказа</h2>
          <p>Шесть коротких шагов вместо одной длинной формы.</p>
        </div>
        <Button variant="quiet" onClick={onClose}>
          Закрыть
        </Button>
      </header>
      {error && <ErrorState message={error} />}
      <nav className="wizard-steps">
        {[
          "Клиент",
          "Работы",
          "Документы",
          "Расчёт",
          "Исполнители",
          "Проверка",
        ].map((label, i) => (
          <button
            key={label}
            className={
              step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""
            }
            onClick={() => setStep(i + 1)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="wizard-panel">
        {step === 1 && (
          <div className="wizard-grid">
            <div className="wizard-draft-note">
              Можно перейти дальше и создать заказ с любым объёмом известной
              информации — недостающие данные редактируются позже.
            </div>
            <CrmLookup
              label="Найти клиента"
              placeholder="Имя, компания, телефон или email"
              path="/api/admin/companies"
              value={client}
              onChange={(id) => {
                setClient(id);
                setContact("");
              }}
            />
            {client && (
              <CrmLookup
                label="Контактное лицо"
                placeholder="Имя, должность, телефон или email"
                path={`/api/admin/companies/${client}/representatives`}
                value={contact}
                onChange={setContact}
              />
            )}
            <Select
              label="Ответственный"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">Не назначен</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </Select>
            <Input
              label="Название заказа"
              hint="Можно заполнить позже"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: договор RU → EN + нотариат"
            />
            <Select
              label="Статус"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Textarea
              label="Внутренний комментарий"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Link className="client-directory-action" href="/admin/clients">
              ＋ Быстро добавить клиента в справочник ↗
            </Link>
          </div>
        )}
        {step === 2 && (
          <div className="wizard-work-list">
            {works.map((w, index) => (
              <WorkDraft
                key={w.key}
                work={w}
                index={index}
                services={services}
                patch={(p) => patchWork(w.key, p)}
                remove={() =>
                  setWorks((items) => items.filter((x) => x.key !== w.key))
                }
              />
            ))}
            {!works.length && (
              <div className="wizard-empty-work">
                <strong>Работы пока не добавлены</strong>
                <span>
                  Заказ можно создать и без работ — добавите их позже в
                  карточке.
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => setWorks((items) => [...items, emptyWork()])}
            >
              Добавить работу +
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="document-step">
            <label className="file-drop">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.xlsx,.xlsm,image/*"
                onChange={(e) =>
                  e.target.files?.[0] && void analyze(e.target.files[0])
                }
              />
              <span>Прикрепить документ клиента</span>
              <strong>
                {file?.name || "PDF, DOCX, TXT, XLSX или изображение"}
              </strong>
            </label>
            {analyzing && <LoadingState label="Анализируем документ" />}
            {analysis && (
              <div className="analysis-result">
                <div>
                  <span>Страниц</span>
                  <strong>{analysis.page_count ?? "—"}</strong>
                </div>
                <div>
                  <span>Знаков</span>
                  <strong>
                    {analysis.character_count?.toLocaleString("ru-RU") ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Слов</span>
                  <strong>
                    {analysis.word_count?.toLocaleString("ru-RU") ?? "—"}
                  </strong>
                </div>
                <p>{analysis.analysis_note}</p>
              </div>
            )}
            <p className="context-note">
              Если значение нельзя определить надёжно, CRM не придумывает его.
              Объём можно вручную исправить в каждой работе.
            </p>
          </div>
        )}
        {step === 4 && (
          <div className="pricing-step">
            {works.map((w, i) => {
              const options = tariffOptions[w.key] || [];
              const selectedKey = w.tariff_ids.join(",");
              const selected = options.find(
                (option) => option.key === selectedKey,
              );
              return (
                <article key={w.key} className="price-row">
                  <header>
                    <strong>
                      {i + 1}.{" "}
                      {services.find((s) => s.code === w.service_code)?.name ||
                        "Услуга не указана"}
                    </strong>
                    <span>
                      {w.source_language}
                      {w.target_language ? ` → ${w.target_language}` : ""}
                    </span>
                  </header>
                  <div className="price-row__fields price-row__fields--tariff">
                    <div className="pricing-field pricing-field--tariff">
                      <Select
                        label="Тариф"
                        value={selectedKey}
                        onChange={(e) => {
                          const option = options.find(
                            (item) => item.key === e.target.value,
                          );
                          if (option)
                            patchWork(w.key, {
                              tariff_ids: option.tariff_ids,
                              quoteAmount: String(option.amount),
                              quoteRate: String(option.rate),
                              quoteUnit: option.unit,
                              client_rate: "0",
                              quoteMessage: tariffMessage(option, false),
                            });
                        }}
                      >
                        <option value="">
                          {options.length
                            ? "Выберите тариф"
                            : "Подходящих тарифов нет"}
                        </option>
                        {options.map((option) => (
                          <option
                            key={option.key}
                            value={option.key}
                          >{`${option.source_language || "Любой"} → ${option.target_language || "Любой"} · ${rub(option.rate)} · ${billingUnits.find(([unit]) => unit === option.unit)?.[1] || option.unit}${option.is_auto ? " · рекомендован" : ""}`}</option>
                        ))}
                      </Select>
                    </div>
                    {selected ? (
                      <div className="pricing-field">
                        <span className="field__label">Ставка по тарифу</span>
                        <div className="calculated-value">
                          <strong>{rub(selected.rate)}</strong>
                          <small>
                            {billingUnits.find(
                              ([unit]) => unit === selected.unit,
                            )?.[1] || selected.unit}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div className="pricing-field pricing-field--manual-rate">
                        <Select
                          label="Единица тарифа"
                          value={w.billing_unit}
                          onChange={(e) =>
                            patchWork(w.key, {
                              billing_unit: e.target.value,
                              tariff_ids: [],
                              quoteAmount: "",
                              quoteUnit: "",
                              quoteMessage: "",
                            })
                          }
                        >
                          {billingUnits.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                        <Input
                          label="Ставка вручную, ₽"
                          type="number"
                          min="0"
                          step="0.01"
                          value={w.client_rate}
                          onChange={(e) =>
                            patchWork(w.key, {
                              client_rate: e.target.value,
                              tariff_ids: [],
                              quoteAmount: "",
                              quoteMessage: "",
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="pricing-field">
                      <span className="field__label">Ручной итог</span>
                      <label className="manual-switch manual-switch--feature manual-switch--compact">
                        <input
                          type="checkbox"
                          checked={w.manualPrice}
                          onChange={(e) =>
                            patchWork(w.key, {
                              manualPrice: e.target.checked,
                              price: String(localPrice(w)),
                            })
                          }
                        />
                        <span>
                          <b>{w.manualPrice ? "Включён" : "Выключен"}</b>
                          <small>
                            {w.manualPrice
                              ? "Итог задаёт менеджер"
                              : "Расчёт выполняет CRM"}
                          </small>
                        </span>
                      </label>
                    </div>
                    <div className="pricing-field">
                      <span className="field__label">
                        {w.manualPrice ? "Итог вручную" : "Авторасчёт"}
                      </span>
                      {w.manualPrice ? (
                        <input
                          aria-label="Итог вручную, ₽"
                          className="input pricing-inline-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={w.price}
                          onChange={(e) =>
                            patchWork(w.key, { price: e.target.value })
                          }
                        />
                      ) : (
                        <div className="calculated-value calculated-value--total">
                          <strong>{rub(localPrice(w))}</strong>
                          <small>Итог по работе</small>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tariff-resolution">
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => void resolveTariff(w)}
                    >
                      Обновить подбор
                    </Button>
                    <span>
                      {w.quoteMessage ||
                        "CRM подберёт тариф по услуге, языковой паре и параметрам работы."}
                    </span>
                  </div>
                </article>
              );
            })}
            <div className="wizard-total">
              <div>
                <span>Стоимость работ</span>
                <small>{rub(clientTotal)}</small>
              </div>
              <div>
                <span>Уже оплачено</span>
                <small>{rub(paidAmount)}</small>
              </div>
              <div className="wizard-total__primary">
                <span>Итого</span>
                <strong>{rub(remainingTotal)}</strong>
              </div>
            </div>
            <div className="wizard-grid">
              <Input
                label="Уже оплачено, ₽"
                type="number"
                min="0"
                step="0.01"
                value={payment.amount_paid}
                onChange={(e) =>
                  setPayment({ ...payment, amount_paid: e.target.value })
                }
              />
              <Input
                label="Способ оплаты"
                value={payment.payment_method}
                onChange={(e) =>
                  setPayment({ ...payment, payment_method: e.target.value })
                }
              />
              <Input
                label="№ счёта"
                value={payment.invoice_number}
                onChange={(e) =>
                  setPayment({ ...payment, invoice_number: e.target.value })
                }
              />
              <Input
                label="Дата счёта"
                type="date"
                value={payment.invoice_date}
                onChange={(e) =>
                  setPayment({ ...payment, invoice_date: e.target.value })
                }
              />
              <Input
                label="Дата оплаты"
                type="date"
                value={payment.paid_at}
                onChange={(e) =>
                  setPayment({ ...payment, paid_at: e.target.value })
                }
              />
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="executor-step">
            {works.map((w, i) => (
              <article className="executor-row" key={w.key}>
                <header>
                  <strong>
                    {i + 1}.{" "}
                    {services.find((s) => s.code === w.service_code)?.name ||
                      "Услуга не указана"}
                  </strong>
                  <span>
                    {rub(w.manualPrice ? Number(w.price) : localPrice(w))}{" "}
                    клиенту
                  </span>
                </header>
                <div className="executor-grid">
                  <CrmLookup
                    label="Исполнитель"
                    placeholder="Имя, телефон, email или Telegram"
                    path={`/api/admin/executors?language=${encodeURIComponent(w.target_language || w.source_language)}&work_type=${encodeURIComponent(w.work_type)}`}
                    value={w.executor_id}
                    onChange={(id) => patchWork(w.key, { executor_id: id })}
                  />
                  <Input
                    label="Срок исполнителя"
                    type="date"
                    value={w.executor_deadline}
                    onChange={(e) =>
                      patchWork(w.key, { executor_deadline: e.target.value })
                    }
                  />
                  <Input
                    label="Время"
                    type="time"
                    value={w.executor_deadline_time}
                    onChange={(e) =>
                      patchWork(w.key, {
                        executor_deadline_time: e.target.value,
                      })
                    }
                  />
                  <Select
                    label="Единица ставки"
                    value={w.executor_billing_unit}
                    onChange={(e) =>
                      patchWork(w.key, {
                        executor_billing_unit: e.target.value,
                      })
                    }
                  >
                    {billingUnits.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Ставка исполнителя, ₽"
                    type="number"
                    min="0"
                    step="0.01"
                    value={w.executor_rate}
                    onChange={(e) =>
                      patchWork(w.key, { executor_rate: e.target.value })
                    }
                  />
                  <div className="pricing-field">
                    <span className="field__label">Ручная стоимость</span>
                    <label className="manual-switch manual-switch--feature manual-switch--compact">
                      <input
                        type="checkbox"
                        checked={w.manualExecutorCost}
                        onChange={(e) =>
                          patchWork(w.key, {
                            manualExecutorCost: e.target.checked,
                            executor_cost: String(localPrice(w, true)),
                          })
                        }
                      />
                      <span>
                        <b>{w.manualExecutorCost ? "Включена" : "Выключена"}</b>
                        <small>
                          {w.manualExecutorCost
                            ? "Сумму задаёт менеджер"
                            : "CRM считает по ставке"}
                        </small>
                      </span>
                    </label>
                  </div>
                  <div className="pricing-field">
                    <span className="field__label">
                      {w.manualExecutorCost
                        ? "К оплате исполнителю"
                        : "Авторасчёт"}
                    </span>
                    {w.manualExecutorCost ? (
                      <input
                        aria-label="К оплате исполнителю, ₽"
                        className="input pricing-inline-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={w.executor_cost}
                        onChange={(e) =>
                          patchWork(w.key, { executor_cost: e.target.value })
                        }
                      />
                    ) : (
                      <div className="calculated-value calculated-value--total">
                        <strong>{rub(localPrice(w, true))}</strong>
                        <small>По ставке исполнителя</small>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {step === 6 && (
          <div className="review-step">
            <div className="review-hero">
              <div>
                <span>Клиент</span>
                <strong>{client ? "Выбран" : "Можно уточнить позже"}</strong>
              </div>
              <div>
                <span>Работ</span>
                <strong>{works.length}</strong>
              </div>
              <div>
                <span>Клиенту</span>
                <strong>{rub(clientTotal)}</strong>
              </div>
              <div>
                <span>Исполнителям</span>
                <strong>{rub(executorTotal)}</strong>
              </div>
              <div>
                <span>Прибыль</span>
                <strong>{rub(clientTotal - executorTotal)}</strong>
              </div>
              <div>
                <span>Маржа</span>
                <strong>
                  {clientTotal
                    ? `${Math.round(((clientTotal - executorTotal) / clientTotal) * 1000) / 10}%`
                    : "0%"}
                </strong>
              </div>
            </div>
            <div className="review-list">
              {works.map((w, i) => (
                <div key={w.key}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {services.find((s) => s.code === w.service_code)?.name ||
                        "Услуга не указана"}
                    </strong>
                    <small>
                      {w.source_language}
                      {w.target_language
                        ? ` → ${w.target_language}`
                        : ""} · {w.deadline || "без срока"}
                    </small>
                  </div>
                  <b>{rub(w.manualPrice ? Number(w.price) : localPrice(w))}</b>
                </div>
              ))}
            </div>
            <div className="review-submit-zone">
              {file && (
                <p className="context-note">
                  Файл «{file.name}» будет загружен и проанализирован после
                  создания заказа.
                </p>
              )}
              <Button disabled={busy} onClick={() => void create()}>
                {busy ? "Создаём заказ…" : "Создать заказ"}
              </Button>
            </div>
          </div>
        )}
      </div>
      <footer className="wizard-footer">
        <Button
          variant="quiet"
          disabled={step === 1 || busy}
          onClick={() => setStep(step - 1)}
        >
          ← Назад
        </Button>
        <span>Шаг {step} из 6</span>
        {step < 6 && (
          <Button disabled={!canNext || busy} onClick={() => setStep(step + 1)}>
            Продолжить →
          </Button>
        )}
      </footer>
    </section>
  );
}

function WorkDraft({
  work,
  index,
  services,
  patch,
  remove,
}: {
  work: DraftWork;
  index: number;
  services: Service[];
  patch: (p: Partial<DraftWork>) => void;
  remove: () => void;
}) {
  const service = services.find((s) => s.code === work.service_code);
  return (
    <article className="work-draft">
      <header>
        <div>
          <span className="overline">
            Работа {String(index + 1).padStart(2, "0")}
          </span>
          <strong>{service?.name || "Новая работа"}</strong>
        </div>
        <Button variant="quiet" onClick={remove}>
          Удалить
        </Button>
      </header>
      <div className="wizard-grid">
        <Select
          label="Услуга"
          value={work.service_code}
          onChange={(e) => {
            const s = services.find((x) => x.code === e.target.value);
            patch({
              service_code: e.target.value,
              work_type: e.target.value || "written_translation",
              billing_unit: s?.billing_mode || "CUSTOM",
              tariff_ids: [],
              client_rate: "0",
              quoteAmount: "",
              quoteRate: "",
              quoteUnit: "",
              quoteMessage: "",
            });
          }}
        >
          <option value="">Не указана — заполнить позже</option>
          {services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input
          label="Тематика"
          value={work.topic}
          onChange={(e) => patch({ topic: e.target.value })}
        />
        <LanguageCombobox
          label="Язык с"
          value={work.source_language}
          onChange={(value) =>
            patch({
              source_language: value,
              tariff_ids: [],
              client_rate: "0",
              quoteAmount: "",
              quoteRate: "",
              quoteUnit: "",
              quoteMessage: "",
            })
          }
        />
        <LanguageCombobox
          label="Язык на"
          value={work.target_language}
          onChange={(value) =>
            patch({
              target_language: value,
              tariff_ids: [],
              client_rate: "0",
              quoteAmount: "",
              quoteRate: "",
              quoteUnit: "",
              quoteMessage: "",
            })
          }
        />
        <Input
          label="Знаков"
          type="number"
          min="0"
          value={work.character_count}
          onChange={(e) =>
            patch({
              character_count: e.target.value,
              tariff_ids: [],
              quoteAmount: "",
              quoteRate: "",
              quoteUnit: "",
              quoteMessage: "",
            })
          }
        />
        <Input
          label="Страниц"
          type="number"
          min="0"
          step="0.01"
          value={work.page_count}
          onChange={(e) =>
            patch({
              page_count: e.target.value,
              tariff_ids: [],
              quoteAmount: "",
              quoteRate: "",
              quoteUnit: "",
              quoteMessage: "",
            })
          }
        />
        <Input
          label="Срок"
          type="date"
          value={work.deadline}
          onChange={(e) => patch({ deadline: e.target.value })}
        />
        <Input
          label="Время"
          type="time"
          value={work.deadline_time}
          onChange={(e) => patch({ deadline_time: e.target.value })}
        />
        <Select
          label="Статус работы"
          value={work.status}
          onChange={(e) => patch({ status: e.target.value })}
        >
          {workStatuses.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <label className="manual-switch manual-switch--feature">
          <input
            type="checkbox"
            checked={work.urgent}
            onChange={(e) =>
              patch({
                urgent: e.target.checked,
                tariff_ids: [],
                client_rate: "0",
                quoteAmount: "",
                quoteRate: "",
                quoteUnit: "",
                quoteMessage: "",
              })
            }
          />
          <span>
            <b>Срочный перевод</b>
            <small>Применить повышающий коэффициент</small>
          </span>
        </label>
        <label className="manual-switch manual-switch--feature">
          <input
            type="checkbox"
            checked={work.native_speaker}
            onChange={(e) =>
              patch({
                native_speaker: e.target.checked,
                tariff_ids: [],
                client_rate: "0",
                quoteAmount: "",
                quoteRate: "",
                quoteUnit: "",
                quoteMessage: "",
              })
            }
          />
          <span>
            <b>Перевод носителем</b>
            <small>Работу выполняет носитель языка</small>
          </span>
        </label>
        <Textarea
          label="Комментарий"
          value={work.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
    </article>
  );
}

function draftFromWork(work: Work): DraftWork {
  return {
    key: work.id,
    service_code: work.service_code,
    work_type: work.work_type,
    source_language: work.source_language,
    target_language: work.target_language,
    tariff_ids: work.tariff_ids
      ? work.tariff_ids.split(",").filter(Boolean)
      : [],
    topic: work.topic,
    urgent: work.urgent,
    native_speaker: work.native_speaker,
    character_count: work.character_count?.toString() ?? "",
    page_count: work.page_count?.toString() ?? "",
    word_count: work.word_count?.toString() ?? "",
    billing_unit: work.billing_unit,
    client_rate: String(work.client_rate ?? 0),
    price: String(work.price ?? 0),
    manualPrice: work.price_overridden,
    executor_id: work.executor_id ?? "",
    executor_rate: String(work.executor_rate ?? 0),
    executor_billing_unit: work.executor_billing_unit,
    executor_cost: String(work.executor_cost ?? 0),
    manualExecutorCost: work.executor_cost_overridden,
    deadline: work.deadline ?? "",
    deadline_time: work.deadline_time ?? "",
    executor_deadline: work.executor_deadline ?? "",
    executor_deadline_time: work.executor_deadline_time ?? "",
    status: work.status,
    notes: work.notes,
    quoteAmount: String(work.auto_price ?? 0),
    quoteRate: "",
    quoteUnit: "",
    quoteMessage: "",
  };
}

type WorkEditorState = {
  mode: "new" | "edit";
  workId?: string;
  version?: number;
  draft: DraftWork;
};

function OrderCard({
  orderId,
  statuses,
  onClose,
  onChanged,
}: {
  orderId: string;
  statuses: StatusOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [workEditor, setWorkEditor] = useState<WorkEditorState | null>(null);
  const [savingWork, setSavingWork] = useState(false);
  const [paymentEdit, setPaymentEdit] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({
    amount_paid: "0",
    payment_method: "",
    invoice_number: "",
    invoice_date: "",
    paid_at: "",
    notes: "",
  });
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [detailsEdit, setDetailsEdit] = useState(false);
  const [detailDraft, setDetailDraft] = useState({
    title: "",
    client_id: "",
    contact_id: "",
    manager_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const detail = await api<OrderDetail>(`/api/admin/crm/orders/${orderId}`);
      setOrder(detail);
      setPaymentDraft({
        amount_paid: String(detail.payment?.amount_paid ?? 0),
        payment_method: detail.payment?.payment_method ?? "",
        invoice_number: detail.payment?.invoice_number ?? "",
        invoice_date: detail.payment?.invoice_date ?? "",
        paid_at: detail.payment?.paid_at ?? "",
        notes: detail.payment?.notes ?? "",
      });
      setDetailDraft({
        title: detail.title ?? "",
        client_id: detail.client_id ?? "",
        contact_id: detail.contact_id ?? "",
        manager_id: detail.manager_id ?? "",
        notes: detail.notes ?? "",
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказ");
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    api<Service[]>("/api/admin/crm/services?active=true")
      .then(setServices)
      .catch(() => {});
    api<UserSummary[]>("/api/admin/applications/managers")
      .then(setManagers)
      .catch(() => {});
  }, []);

  async function changeStatus(status: string) {
    try {
      await api(`/api/admin/crm/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить статус");
    }
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("upload", file);
      await api(`/api/admin/crm/orders/${orderId}/files/analyze`, {
        method: "POST",
        body: form,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }
  async function duplicateWork(workId: string) {
    try {
      await api(`/api/admin/crm/orders/${orderId}/works/${workId}/duplicate`, {
        method: "POST",
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось дублировать работу",
      );
    }
  }
  async function archiveWork(workId: string) {
    if (
      !confirm(
        "Убрать эту работу из активного заказа? История сохранится в архиве.",
      )
    )
      return;
    try {
      await api(`/api/admin/crm/orders/${orderId}/works/${workId}/archive`, {
        method: "POST",
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось архивировать работу",
      );
    }
  }
  async function saveWork() {
    if (!workEditor) return;
    setSavingWork(true);
    setError("");
    const w = workEditor.draft;
    const payload = {
      service_code: w.service_code,
      work_type: w.work_type,
      source_language: w.source_language,
      target_language: w.target_language,
      topic: w.topic,
      urgent: w.urgent,
      native_speaker: w.native_speaker,
      character_count: w.character_count ? Number(w.character_count) : null,
      page_count: w.page_count ? Number(w.page_count) : null,
      word_count: w.word_count ? Number(w.word_count) : null,
      billing_unit: w.billing_unit,
      client_rate: Number(w.client_rate || 0),
      price: w.manualPrice ? Number(w.price || 0) : null,
      price_override_reason: w.manualPrice
        ? "Ручная корректировка в карточке заказа"
        : "",
      executor_id: w.executor_id || null,
      executor_rate: Number(w.executor_rate || 0),
      executor_billing_unit: w.executor_billing_unit,
      executor_cost: w.manualExecutorCost ? Number(w.executor_cost || 0) : null,
      deadline: w.deadline || null,
      deadline_time: w.deadline_time,
      executor_deadline: w.executor_deadline || null,
      executor_deadline_time: w.executor_deadline_time,
      status: w.status,
      notes: w.notes,
      ...(workEditor.mode === "edit" ? { version: workEditor.version } : {}),
    };
    try {
      const path =
        workEditor.mode === "edit"
          ? `/api/admin/crm/orders/${orderId}/works/${workEditor.workId}`
          : `/api/admin/crm/orders/${orderId}/works`;
      await api(path, {
        method: workEditor.mode === "edit" ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setWorkEditor(null);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить работу");
    } finally {
      setSavingWork(false);
    }
  }
  async function saveOrderDetails() {
    if (!order) return;
    setError("");
    try {
      await api(`/api/admin/crm/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: detailDraft.title,
          client_id: detailDraft.client_id || null,
          contact_id: detailDraft.contact_id || null,
          manager_id: detailDraft.manager_id || null,
          notes: detailDraft.notes,
          version: order.version,
        }),
      });
      setDetailsEdit(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить данные заказа",
      );
    }
  }

  async function savePayment() {
    if (!order) return;
    try {
      await api(`/api/admin/crm/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          amount_paid: Number(paymentDraft.amount_paid || 0),
          payment_method: paymentDraft.payment_method,
          invoice_number: paymentDraft.invoice_number,
          invoice_date: paymentDraft.invoice_date || null,
          paid_at: paymentDraft.paid_at || null,
          notes: paymentDraft.notes,
          version: order.payment?.version ?? 1,
        }),
      });
      setPaymentEdit(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить оплату");
    }
  }

  if (!order)
    return (
      <section className="crm-editor">
        <Button variant="quiet" onClick={onClose}>
          Закрыть
        </Button>
        {error ? <ErrorState message={error} /> : <LoadingState />}
      </section>
    );
  const serviceName = (code: string) =>
    services.find((item) => item.code === code)?.name ||
    code ||
    "Услуга не указана";

  return (
    <section className="crm-order-card">
      <header className="order-card-head">
        <div>
          <span className="overline">{order.number}</span>
          <h2>{order.title || "Заказ без названия"}</h2>
          <p>
            {order.deadline
              ? `Общий дедлайн ${order.deadline}`
              : "Общий дедлайн не указан"}
          </p>
        </div>
        <div className="order-card-head__actions">
          <Select
            label="Статус заказа"
            value={order.status}
            onChange={(e) => void changeStatus(e.target.value)}
          >
            {statuses
              .filter((s) => s.active || s.code === order.status)
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
          </Select>
          <Button
            variant="secondary"
            aria-expanded={detailsEdit}
            onClick={() => setDetailsEdit(!detailsEdit)}
          >
            {detailsEdit ? "Свернуть" : "Изменить данные"}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <nav className="order-section-nav" aria-label="Разделы заказа">
        <a href="#order-core">Основное</a>
        <a href="#order-works">Работы</a>
        <a href="#order-finance">Финансы</a>
        <a href="#order-files">Файлы</a>
        <a href="#order-history">История</a>
      </nav>
      <section
        id="order-core"
        className={
          detailsEdit ? "order-core-editor is-editing" : "order-core-editor"
        }
      >
        {detailsEdit ? (
          <>
            <header className="order-edit-heading">
              <div>
                <span className="overline">Основное</span>
                <h3>Данные заказа</h3>
                <p>
                  Клиент, ответственный и внутренняя информация редактируются
                  отдельно от работ.
                </p>
              </div>
            </header>
            <div className="order-edit-groups">
              <fieldset className="order-edit-group">
                <legend>Клиент и ответственность</legend>
                <CrmLookup
                  label="Клиент"
                  path="/api/admin/companies"
                  value={detailDraft.client_id}
                  onChange={(id) =>
                    setDetailDraft({
                      ...detailDraft,
                      client_id: id,
                      contact_id: "",
                    })
                  }
                />
                {detailDraft.client_id && (
                  <CrmLookup
                    label="Контактное лицо"
                    path={`/api/admin/companies/${detailDraft.client_id}/representatives`}
                    value={detailDraft.contact_id}
                    onChange={(id) =>
                      setDetailDraft({ ...detailDraft, contact_id: id })
                    }
                  />
                )}
                <Select
                  label="Ответственный"
                  value={detailDraft.manager_id}
                  onChange={(e) =>
                    setDetailDraft({
                      ...detailDraft,
                      manager_id: e.target.value,
                    })
                  }
                >
                  <option value="">Не назначен</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </fieldset>
              <fieldset className="order-edit-group">
                <legend>Параметры и заметки</legend>
                <Input
                  label="Название заказа"
                  hint="Можно оставить пустым"
                  value={detailDraft.title}
                  onChange={(e) =>
                    setDetailDraft({ ...detailDraft, title: e.target.value })
                  }
                />
                <Textarea
                  label="Внутренний комментарий"
                  value={detailDraft.notes}
                  onChange={(e) =>
                    setDetailDraft({ ...detailDraft, notes: e.target.value })
                  }
                />
              </fieldset>
            </div>
            <div className="form-actions order-edit-actions">
              <Button onClick={() => void saveOrderDetails()}>
                Сохранить данные
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setDetailsEdit(false);
                  setDetailDraft({
                    title: order.title ?? "",
                    client_id: order.client_id ?? "",
                    contact_id: order.contact_id ?? "",
                    manager_id: order.manager_id ?? "",
                    notes: order.notes ?? "",
                  });
                }}
              >
                Отмена
              </Button>
            </div>
          </>
        ) : (
          <div className="order-context-strip">
            <div>
              <span>Клиент</span>
              <strong>{order.client_name || "Не указан"}</strong>
            </div>
            <div>
              <span>Контакт</span>
              <strong>{order.contact_name || "Не указан"}</strong>
            </div>
            <div>
              <span>Ответственный</span>
              <strong>{order.manager_name || "Не назначен"}</strong>
            </div>
          </div>
        )}
      </section>
      <section id="order-finance" className="order-finance-module">
        <header>
          <div>
            <span className="overline">Финансы</span>
            <h3>Экономика заказа</h3>
          </div>
          <p>Стоимость, расходы, маржа и текущий долг клиента.</p>
        </header>
        <div className="finance-strip">
          <div>
            <span>Клиенту</span>
            <strong>{rub(order.financial.revenue)}</strong>
          </div>
          <div>
            <span>Себестоимость</span>
            <strong>{rub(order.financial.executor_cost)}</strong>
          </div>
          <div
            className={Number(order.financial.profit) > 0 ? "is-positive" : ""}
          >
            <span>Прибыль</span>
            <strong>{rub(order.financial.profit)}</strong>
          </div>
          <div>
            <span>Маржа</span>
            <strong>{Number(order.financial.margin_percent)}%</strong>
          </div>
          <div
            className={
              Number(order.financial.client_debt) > 0 ? "is-warning" : ""
            }
          >
            <span>Долг клиента</span>
            <strong>{rub(order.financial.client_debt)}</strong>
          </div>
        </div>
      </section>

      {workEditor && (
        <section className="work-inline-editor">
          <header>
            <div>
              <span className="overline">
                {workEditor.mode === "edit"
                  ? "Редактирование работы"
                  : "Новая работа"}
              </span>
              <h3>{serviceName(workEditor.draft.service_code)}</h3>
              <p>
                Поля разделены на параметры работы и финансовую ответственность.
              </p>
            </div>
            <Button variant="quiet" onClick={() => setWorkEditor(null)}>
              Закрыть
            </Button>
          </header>
          <section className="work-edit-module">
            <div className="work-edit-module__head">
              <span>01</span>
              <div>
                <strong>Данные работы</strong>
                <small>Услуга, языковая пара, объём, сроки и статус.</small>
              </div>
            </div>
            <WorkDraft
              work={workEditor.draft}
              index={0}
              services={services}
              patch={(patch) =>
                setWorkEditor({
                  ...workEditor,
                  draft: { ...workEditor.draft, ...patch },
                })
              }
              remove={() => setWorkEditor(null)}
            />
          </section>
          <section className="work-edit-module">
            <div className="work-edit-module__head">
              <span>02</span>
              <div>
                <strong>Финансы и исполнитель</strong>
                <small>
                  Клиентская ставка, себестоимость и назначенный специалист.
                </small>
              </div>
            </div>
            <div className="wizard-grid work-inline-editor__finance">
              <Select
                label="Единица тарифа"
                value={workEditor.draft.billing_unit}
                onChange={(e) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: {
                      ...workEditor.draft,
                      billing_unit: e.target.value,
                    },
                  })
                }
              >
                {billingUnits.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <Input
                label="Тариф клиенту, ₽"
                type="number"
                min="0"
                step="0.01"
                value={workEditor.draft.client_rate}
                onChange={(e) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: { ...workEditor.draft, client_rate: e.target.value },
                  })
                }
              />
              <label className="manual-switch">
                <input
                  type="checkbox"
                  checked={workEditor.draft.manualPrice}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: {
                        ...workEditor.draft,
                        manualPrice: e.target.checked,
                      },
                    })
                  }
                />
                <span>Ручной итог</span>
              </label>
              {workEditor.draft.manualPrice && (
                <Input
                  label="Итог клиенту, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={workEditor.draft.price}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: { ...workEditor.draft, price: e.target.value },
                    })
                  }
                />
              )}
              <CrmLookup
                label="Исполнитель"
                path="/api/admin/executors"
                value={workEditor.draft.executor_id}
                onChange={(id) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: { ...workEditor.draft, executor_id: id },
                  })
                }
              />
              <Input
                label="Ставка исполнителя, ₽"
                type="number"
                min="0"
                step="0.01"
                value={workEditor.draft.executor_rate}
                onChange={(e) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: {
                      ...workEditor.draft,
                      executor_rate: e.target.value,
                    },
                  })
                }
              />
              <Select
                label="Единица ставки"
                value={workEditor.draft.executor_billing_unit}
                onChange={(e) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: {
                      ...workEditor.draft,
                      executor_billing_unit: e.target.value,
                    },
                  })
                }
              >
                {billingUnits.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <label className="manual-switch">
                <input
                  type="checkbox"
                  checked={workEditor.draft.manualExecutorCost}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: {
                        ...workEditor.draft,
                        manualExecutorCost: e.target.checked,
                      },
                    })
                  }
                />
                <span>Ручная стоимость исполнителя</span>
              </label>
              {workEditor.draft.manualExecutorCost && (
                <Input
                  label="Итого исполнителю, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={workEditor.draft.executor_cost}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: {
                        ...workEditor.draft,
                        executor_cost: e.target.value,
                      },
                    })
                  }
                />
              )}
            </div>
          </section>
          <div className="work-inline-editor__actions">
            <Button variant="quiet" onClick={() => setWorkEditor(null)}>
              Отмена
            </Button>
            <Button disabled={savingWork} onClick={() => void saveWork()}>
              {savingWork ? "Сохраняем…" : "Сохранить работу"}
            </Button>
          </div>
        </section>
      )}

      <div className="order-card-layout">
        <main>
          <section id="order-works" className="order-card-section">
            <header>
              <div>
                <span className="overline">Работы</span>
                <h3>{order.works.length} в заказе</h3>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setWorkEditor({ mode: "new", draft: emptyWork() })
                }
              >
                Добавить работу +
              </Button>
            </header>
            <div className="order-work-table">
              {order.works.map((w, i) => (
                <article key={w.id}>
                  <span className="order-work-table__index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{serviceName(w.service_code)}</strong>
                    <small>
                      {[w.source_language, w.target_language]
                        .filter(Boolean)
                        .join(" → ") || "Без языковой пары"}{" "}
                      ·{" "}
                      {w.character_count
                        ? `${w.character_count.toLocaleString("ru-RU")} зн.`
                        : w.page_count
                          ? `${w.page_count} стр.`
                          : "объём вручную"}
                    </small>
                  </div>
                  <div>
                    <span>Исполнитель</span>
                    <strong>
                      {w.executor_id ? (
                        <ExecutorName id={w.executor_id} />
                      ) : (
                        "Не назначен"
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Дедлайн</span>
                    <strong>{w.deadline || "—"}</strong>
                  </div>
                  <div>
                    <span>Клиенту</span>
                    <strong>{rub(w.price)}</strong>
                  </div>
                  <div>
                    <span>Исполнителю</span>
                    <strong>{rub(w.executor_cost)}</strong>
                  </div>
                  <Badge tone={w.executor_id ? "neutral" : "warning"}>
                    {statusLabel(w.status)}
                  </Badge>
                  <div className="work-row-actions">
                    <Button
                      type="button"
                      variant="quiet"
                      className="work-action"
                      onClick={() =>
                        setWorkEditor({
                          mode: "edit",
                          workId: w.id,
                          version: w.version,
                          draft: draftFromWork(w),
                        })
                      }
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      className="work-action"
                      onClick={() => void duplicateWork(w.id)}
                    >
                      Дублировать
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="work-action work-action--danger"
                      onClick={() => void archiveWork(w.id)}
                    >
                      В архив
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section id="order-files" className="order-card-section">
            <header>
              <div>
                <span className="overline">Файлы</span>
                <h3>Документы заказа</h3>
              </div>
              <label className="compact-upload">
                <input
                  type="file"
                  onChange={(e) =>
                    e.target.files?.[0] && void upload(e.target.files[0])
                  }
                />
                {uploading ? "Анализ…" : "Добавить файл +"}
              </label>
            </header>
            <div className="file-metrics-list">
              {order.files.map((f) => (
                <article key={f.id} className="file-metric-row">
                  <span className="file-metric-row__mark" aria-hidden="true">
                    {(f.original_name.split(".").pop() || "FILE")
                      .slice(0, 4)
                      .toUpperCase()}
                  </span>
                  <div
                    className="file-metric-row__copy"
                    title={f.original_name}
                  >
                    <strong>{f.original_name}</strong>
                    <small>
                      {f.analysis_note || "Файл прикреплён к заказу"}
                    </small>
                  </div>
                  <div className="file-metric-row__metric">
                    <span>Страниц</span>
                    <strong>{f.page_count ?? "—"}</strong>
                  </div>
                  <div className="file-metric-row__metric">
                    <span>Знаков</span>
                    <strong>
                      {f.character_count?.toLocaleString("ru-RU") ?? "—"}
                    </strong>
                  </div>
                  <Badge
                    tone={
                      f.analysis_status === "OK"
                        ? "success"
                        : f.analysis_status === "ERROR"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {f.analysis_status === "OK"
                      ? "Готово"
                      : f.analysis_status === "ERROR"
                        ? "Ошибка"
                        : f.analysis_status}
                  </Badge>
                </article>
              ))}
              {!order.files.length && (
                <p className="crm-empty">Файлы ещё не прикреплены.</p>
              )}
            </div>
          </section>
        </main>
        <aside>
          <section
            className={`order-side-card order-payment-card ${paymentEdit ? "is-editing" : ""}`}
          >
            <div className="order-side-card__head">
              <span className="overline">Оплата клиента</span>
              <Button
                type="button"
                variant="quiet"
                className="order-side-card__toggle"
                onClick={() => setPaymentEdit(!paymentEdit)}
              >
                {paymentEdit ? "Свернуть" : "Изменить"}
              </Button>
            </div>
            {paymentEdit ? (
              <div className="payment-edit">
                <Input
                  label="Оплачено, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentDraft.amount_paid}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      amount_paid: e.target.value,
                    })
                  }
                />
                <Input
                  label="Способ оплаты"
                  value={paymentDraft.payment_method}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      payment_method: e.target.value,
                    })
                  }
                />
                <Input
                  label="№ счёта"
                  value={paymentDraft.invoice_number}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      invoice_number: e.target.value,
                    })
                  }
                />
                <Input
                  label="Дата счёта"
                  type="date"
                  value={paymentDraft.invoice_date}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      invoice_date: e.target.value,
                    })
                  }
                />
                <Input
                  label="Дата оплаты"
                  type="date"
                  value={paymentDraft.paid_at}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      paid_at: e.target.value,
                    })
                  }
                />
                <Textarea
                  label="Комментарий"
                  rows={3}
                  value={paymentDraft.notes}
                  onChange={(e) =>
                    setPaymentDraft({ ...paymentDraft, notes: e.target.value })
                  }
                />
                <div className="payment-edit__actions">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setPaymentEdit(false);
                      setPaymentDraft({
                        amount_paid: String(order.payment?.amount_paid ?? 0),
                        payment_method: order.payment?.payment_method ?? "",
                        invoice_number: order.payment?.invoice_number ?? "",
                        invoice_date: order.payment?.invoice_date ?? "",
                        paid_at: order.payment?.paid_at ?? "",
                        notes: order.payment?.notes ?? "",
                      });
                    }}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={() => void savePayment()}>
                    Сохранить оплату
                  </Button>
                </div>
              </div>
            ) : (
              <div className="payment-summary">
                <div>
                  <span>К оплате</span>
                  <strong>
                    {rub(order.payment?.amount_due ?? order.financial.revenue)}
                  </strong>
                </div>
                <div>
                  <span>Оплачено</span>
                  <strong>{rub(order.payment?.amount_paid ?? 0)}</strong>
                </div>
                <div>
                  <span>Счёт</span>
                  <strong>{order.payment?.invoice_number || "—"}</strong>
                </div>
                <div>
                  <span>Дата оплаты</span>
                  <strong>{order.payment?.paid_at || "—"}</strong>
                </div>
              </div>
            )}
          </section>
          {order.application_id && (
            <Link
              className="order-side-link"
              href={`/admin/applications/${order.application_id}`}
            >
              Исходная заявка ↗
            </Link>
          )}
          <div id="order-history">
            <OrderRecords id={order.id} disabled={order.archived} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function ExecutorName({ id }: { id: string }) {
  const [name, setName] = useState("Исполнитель");
  useEffect(() => {
    let active = true;
    api<{ name: string }>(`/api/admin/executors/${id}`)
      .then((x) => {
        if (active) setName(x.name || "Исполнитель без имени");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return <>{name}</>;
}
