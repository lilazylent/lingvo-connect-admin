"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-provider";
import { CrmContacts } from "./crm-contacts";
import { api } from "@/lib/api";
import { formatActivityDate, operationalActivityLabel } from "@/lib/activity-labels";
import { Badge, Button, ErrorState, Input, LoadingState, Select, Textarea, type BadgeTone } from "./ui";
import { Icon, Pictogram } from "./icons";
import { LanguageCombobox } from "./language-combobox";

type Direction = {
  source_language: string;
  target_language: string;
  work_type: string;
  default_rate?: string | number;
  rate_unit?: string;
  service_name?: string;
  canonical_service?: boolean;
};

type CatalogService = {
  id: string;
  code: string;
  name: string;
  billing_mode: string;
  active: boolean;
};

type Entry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  archived: boolean;
  version: number;
  manager_id?: string | null;
  kind?: string;
  tax_id?: string | null;
  telegram?: string;
  directions?: Direction[];
};

type PageData = { items: Entry[]; total: number; page: number; pages: number };

type ClientOrder = {
  id: string;
  number: string;
  title: string;
  status: string;
  deadline: string | null;
  archived?: boolean;
};

type ClientSummary = {
  order_count: number;
  active_orders: number;
  revenue: string | number;
  debt: string | number;
  deposit_balance: string | number;
  last_order: ClientOrder | null;
  orders: ClientOrder[];
};


type ClientDepositTransaction = {
  id: string;
  order_id: string | null;
  kind: string;
  amount: string | number;
  balance_after: string | number;
  note: string;
  created_at: string;
};

type ClientDepositData = {
  company_id: string;
  balance: string | number;
  transactions: ClientDepositTransaction[];
};

type ExecutorWork = {
  id: string;
  order_id: string;
  work_type?: string;
  service_code: string;
  source_language?: string;
  target_language?: string;
  status: string;
  deadline: string | null;
};

type ExecutorAssignment = {
  id: string;
  work_id: string;
  executor_id: string;
  character_count: number | null;
  page_count: string | number | null;
  billing_unit: string;
  rate: string | number;
  cost: string | number;
  amount_paid: string | number;
  paid_at: string | null;
  deadline: string | null;
  deadline_time?: string;
  status: string;
  notes?: string;
  work?: ExecutorWork | null;
};

type ExecutorSummary = {
  active_works: number;
  completed_works: number;
  amount_due: string | number;
  amount_paid: string | number;
  owed: string | number;
  assignments: ExecutorAssignment[];
  works: ExecutorWork[];
};

type SummaryData = ClientSummary | ExecutorSummary;

type AvailabilityState = "FREE" | "BUSY" | "UNAVAILABLE" | "VACATION";
type ExecutorAvailability = {
  id: string;
  state: AvailabilityState;
  start_date: string;
  end_date: string;
  notes: string;
  version: number;
};

type DetailTab = "overview" | "contacts" | "availability" | "records" | "history";
type ExecutorDirectoryView = "list" | "calendar";

type ActivityItem = {
  id: string;
  action?: string;
  created_at?: string;
};

const orderStatusLabels: Record<string, string> = {
  NEW: "Новый",
  ESTIMATING: "Оценка",
  APPROVED: "Согласован",
  IN_PROGRESS: "В работе",
  REVIEW: "Проверка",
  READY: "Готов",
  DELIVERED: "Передан",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

const legacyWorkTypeLabels: Record<string, string> = {
  written_translation: "Письменный перевод",
  interpreting: "Устный перевод",
  editing: "Редактура",
  proofreading: "Корректура",
  certification: "Заверение",
  localization: "Локализация",
  audio_video: "Аудио и видео",
  linguistic_support: "Лингвистическое сопровождение",
  layout: "Вёрстка",
  transcription: "Транскрибация",
};

function workTypeLabel(value: string | undefined, serviceName?: string) {
  if (serviceName) return serviceName;
  if (!value) return "Не указано";
  return legacyWorkTypeLabels[value] ?? value;
}

function statusLabel(value: string | undefined) {
  if (!value) return "Не указан";
  return orderStatusLabels[value] ?? value;
}

function statusTone(value: string | undefined): BadgeTone {
  if (value === "COMPLETED" || value === "READY" || value === "DELIVERED") return "success";
  if (value === "CANCELLED") return "neutral";
  if (value === "NEW") return "accent";
  if (value === "ESTIMATING" || value === "REVIEW") return "warning";
  return "info";
}


const availabilityLabels: Record<AvailabilityState, string> = {
  FREE: "Свободен",
  BUSY: "Занят",
  UNAVAILABLE: "Недоступен",
  VACATION: "Отпуск",
};

function availabilityTone(value: AvailabilityState): BadgeTone {
  if (value === "FREE") return "success";
  if (value === "BUSY") return "warning";
  if (value === "VACATION") return "info";
  return "neutral";
}

function rub(value: string | number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Без срока";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, Math.max(0, month - 1), day, 12, 0, 0, 0);
}

function startOfCalendarWeek(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return isoDate(next);
}

function shiftIsoDate(value: string, days: number) {
  const date = dateFromIso(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function calendarDayLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(dateFromIso(value));
}

function calendarRangeLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `${formatter.format(dateFromIso(start))} — ${formatter.format(dateFromIso(end))}`;
}

function availabilityForDay(items: ExecutorAvailability[], day: string) {
  return items.find((item) => item.start_date <= day && item.end_date >= day) ?? null;
}

function pairLabel(direction: Pick<Direction, "source_language" | "target_language">) {
  const source = direction.source_language || "—";
  const target = direction.target_language || "—";
  return `${source} ↔ ${target}`;
}

const executorRateUnitLabels: Record<string, string> = {
  CONDITIONAL_PAGE: "усл. стр.",
  PER_1000_CHARS: "1000 знаков",
  PER_PAGE: "страница",
  PER_DOCUMENT: "документ",
  PER_MINUTE: "минута",
  HOURLY: "час",
  FIXED: "фикс.",
  CUSTOM: "единица",
};

function directionRateLabel(direction: Direction) {
  const value = Number(direction.default_rate || 0);
  if (!value) return "Ставка не задана";
  return `${rub(value)} / ${executorRateUnitLabels[direction.rate_unit || ""] || direction.rate_unit || "ед."}`;
}

function isExecutorSummary(value: SummaryData | null | undefined): value is ExecutorSummary {
  return Boolean(value && "active_works" in value);
}

function isClientSummary(value: SummaryData | null | undefined): value is ClientSummary {
  return Boolean(value && "order_count" in value);
}

export function CrmDirectory({ executor = false }: { executor?: boolean }) {
  const { state } = useAuth();
  const endpoint = executor ? "/api/admin/executors" : "/api/admin/companies";
  const [data, setData] = useState<PageData | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [workType, setWorkType] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totals, setTotals] = useState({ active: 0, archived: 0 });
  const [summaries, setSummaries] = useState<Record<string, SummaryData>>({});
  const [error, setError] = useState("");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [executorView, setExecutorView] = useState<ExecutorDirectoryView>("list");
  const [calendarStart, setCalendarStart] = useState(() => startOfCalendarWeek());
  const [calendarAvailability, setCalendarAvailability] = useState<Record<string, ExecutorAvailability[]>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarEditor, setCalendarEditor] = useState<{ entry: Entry; day: string; item: ExecutorAvailability | null } | null>(null);

  const listUrl = useCallback((options: { q: string; archived: boolean; page: number }) => {
    const params = new URLSearchParams({
      q: options.q,
      archived: String(options.archived),
      page: String(options.page),
    });
    if (executor) {
      params.set("language", language);
      params.set("work_type", workType);
    }
    return `${endpoint}?${params.toString()}`;
  }, [endpoint, executor, language, workType]);

  const load = useCallback(async () => {
    try {
      const [result, activeRows, archivedRows] = await Promise.all([
        api<PageData>(listUrl({ q: query, archived, page })),
        api<PageData>(listUrl({ q: "", archived: false, page: 1 })),
        api<PageData>(listUrl({ q: "", archived: true, page: 1 })),
      ]);
      setData(result);
      setTotals({ active: activeRows.total, archived: archivedRows.total });
      setSelected((current) => current ? result.items.find((item) => item.id === current.id) ?? null : null);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить справочник");
    }
  }, [archived, listUrl, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!executor) return;
    const controller = new AbortController();
    void api<CatalogService[]>("/api/admin/crm/services?active=true", { signal: controller.signal })
      .then((rows) => setServices(rows.filter((row) => row.active)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [executor]);

  const visibleEntries = data?.items;
  useEffect(() => {
    if (!executor || executorView !== "calendar" || !visibleEntries?.length) {
      if (executorView !== "calendar") setCalendarAvailability({});
      setCalendarLoading(false);
      return;
    }
    const controller = new AbortController();
    setCalendarLoading(true);
    void Promise.allSettled(visibleEntries.map(async (entry) => {
      const result = await api<{ items: ExecutorAvailability[] }>(`/api/admin/executors/${entry.id}/availability`, { signal: controller.signal });
      return [entry.id, result.items] as const;
    })).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, ExecutorAvailability[]> = {};
      for (const result of results) {
        if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
      }
      setCalendarAvailability(next);
      setCalendarLoading(false);
    });
    return () => controller.abort();
  }, [executor, executorView, visibleEntries]);

  useEffect(() => {
    if (!visibleEntries?.length) return;
    const controller = new AbortController();
    void Promise.allSettled(
      visibleEntries.map(async (entry) => {
        const result = await api<SummaryData>(`/api/admin/crm/${executor ? "executors" : "clients"}/${entry.id}/summary`, { signal: controller.signal });
        return [entry.id, result] as const;
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, SummaryData> = {};
      for (const result of results) {
        if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
      }
      setSummaries((current) => ({ ...current, ...next }));
    });
    return () => controller.abort();
  }, [executor, visibleEntries]);

  const directionCount = data?.items.reduce((total, item) => total + (item.directions?.length ?? 0), 0) ?? 0;
  const companyCount = data?.items.filter((item) => item.kind !== "individual").length ?? 0;
  const panelOpen = executorView === "list" && Boolean(selected || editing);

  function selectEntry(entry: Entry) {
    setSelected(entry);
    setEditing(false);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, entry: Entry) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectEntry(entry);
  }

  return <div className={`phase4-directory ${executor ? "phase4-directory--executor" : "phase4-directory--client"}`}>
    <header className="page-head page-head--compact phase4-directory__head">
      <div>
        <span className="overline overline--accent">Лингво Коннект / {executor ? "Исполнители" : "Клиенты"}</span>
        <h1>{executor ? "Исполнители" : "Клиенты"}</h1>
        <p>{executor
          ? "Рабочий справочник переводчиков, редакторов и специалистов: направления, загрузка, назначения и расчёты в одной карточке."
          : "Компании и контактные лица: реальные заказы, оборот, задолженность, контакты и история сотрудничества в одном рабочем контексте."}</p>
      </div>
      <Button onClick={() => { if (executor) setExecutorView("list"); setSelected(null); setEditing(true); }}>
        <Icon name="plus" size={17} />{executor ? "Добавить исполнителя" : "Добавить клиента"}
      </Button>
    </header>

    <section className="lc-module-metrics lc-module-metrics--4" aria-label={executor ? "Показатели исполнителей" : "Показатели клиентов"}>
      <DirectoryMetric icon={executor ? "executors" : "clients"} tone="pink" value={totals.active + totals.archived} label={executor ? "Всего исполнителей" : "Всего клиентов"} />
      <DirectoryMetric icon="shield" tone="green" value={totals.active} label="Активные" />
      <DirectoryMetric icon="folder" tone="blue" value={totals.archived} label="В архиве" />
      <DirectoryMetric icon={executor ? "applications" : "orders"} tone="orange" value={executor ? directionCount : companyCount} label={executor ? "Направлений" : "Компаний"} />
    </section>

    <div className="phase4-directory__utility-row">
      {state?.user.role === "ADMIN" && <Link className="text-link phase4-directory__import" href="/admin/imports"><Icon name="upload" size={15} /> Импортировать XLS / XLSX</Link>}
      {executor && <div className="view-switch directory-view-switch" role="group" aria-label="Представление исполнителей">
        <button type="button" className={executorView === "list" ? "is-active" : ""} onClick={() => setExecutorView("list")}>Список</button>
        <button type="button" className={executorView === "calendar" ? "is-active" : ""} onClick={() => { setSelected(null); setEditing(false); setExecutorView("calendar"); }}>Календарь</button>
      </div>}
    </div>

    {error && <ErrorState message={error} />}

    <form className="directory-commandbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search); }}>
      <Input label="Поиск" placeholder={executor ? "Имя, email, телефон или Telegram" : "Компания, контакт, email, телефон или ИНН"} value={search} onChange={(event) => setSearch(event.target.value)} />
      {executor && <>
        <Input label="Язык" placeholder="Например, английский" value={language} onChange={(event) => { setLanguage(event.target.value); setPage(1); }} />
        <Select label="Специализация" value={workType} onChange={(event) => { setWorkType(event.target.value); setPage(1); }}>
          <option value="">Все услуги</option>
          {services.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
        </Select>
      </>}
      <div className="directory-commandbar__actions">
        <Button variant="secondary">Найти</Button>
        <label className="archive-toggle">
          <input type="checkbox" checked={archived} onChange={(event) => { setArchived(event.target.checked); setPage(1); }} />
          <span className="archive-toggle__box" aria-hidden="true" />
          <span className="archive-toggle__label">Архив</span>
        </label>
      </div>
    </form>

    {executor && executorView === "calendar" ? (!data ? <LoadingState /> : <ExecutorAvailabilityCalendar
      data={data}
      availability={calendarAvailability}
      loading={calendarLoading}
      calendarStart={calendarStart}
      onCalendarStartChange={setCalendarStart}
      page={page}
      setPage={setPage}
      onOpenEntry={(entry) => { setExecutorView("list"); selectEntry(entry); }}
      onEditCell={(entry, day, item) => setCalendarEditor({ entry, day, item })}
    />) : <div className={`directory-workspace ${panelOpen ? "has-panel" : ""}`}>
      {!data ? <LoadingState /> : <DirectoryTable
        data={data}
        executor={executor}
        selectedId={selected?.id ?? null}
        summaries={summaries}
        onSelect={selectEntry}
        onRowKeyDown={handleRowKeyDown}
        page={page}
        setPage={setPage}
      />}

      {editing ? <DirectoryForm
        key={selected?.id ?? "new"}
        entry={selected}
        executor={executor}
        endpoint={endpoint}
        services={services}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); void load(); }}
      /> : selected ? <DirectoryDetail
        key={selected.id}
        entry={selected}
        executor={executor}
        summary={summaries[selected.id]}
        onClose={() => setSelected(null)}
        onEdit={() => setEditing(true)}
        onOpenAvailabilityCalendar={() => { setSelected(null); setExecutorView("calendar"); }}
      /> : null}
    </div>}

    {calendarEditor && <ExecutorAvailabilityEditor
      entry={calendarEditor.entry}
      day={calendarEditor.day}
      item={calendarEditor.item}
      onClose={() => setCalendarEditor(null)}
      onSaved={async () => {
        const result = await api<{ items: ExecutorAvailability[] }>(`/api/admin/executors/${calendarEditor.entry.id}/availability`);
        setCalendarAvailability((current) => ({ ...current, [calendarEditor.entry.id]: result.items }));
        setCalendarEditor(null);
      }}
    />}
  </div>;
}

function DirectoryMetric({ icon, tone, value, label }: { icon: Parameters<typeof Icon>[0]["name"]; tone: string; value: number; label: string }) {
  return <div className={`lc-module-metric lc-module-metric--${tone}`}>
    <span><Pictogram name={icon} size={19} /></span>
    <strong>{value}</strong>
    <b>{label}</b>
  </div>;
}

function DirectoryTable({
  data,
  executor,
  selectedId,
  summaries,
  onSelect,
  onRowKeyDown,
  page,
  setPage,
}: {
  data: PageData;
  executor: boolean;
  selectedId: string | null;
  summaries: Record<string, SummaryData>;
  onSelect: (entry: Entry) => void;
  onRowKeyDown: (event: KeyboardEvent<HTMLTableRowElement>, entry: Entry) => void;
  page: number;
  setPage: (page: number) => void;
}) {
  return <section className="table-surface directory-list-surface" aria-label={executor ? "Список исполнителей" : "Список клиентов"}>
    <div className="table-caption">
      <span>{executor ? "Исполнителей" : "Клиентов"}: {data.total}</span>
      <span>Страница {page} из {data.pages}</span>
    </div>
    <div className="table-wrap">
      <table className="directory-table">
        <thead>
          <tr>
            <th>{executor ? "Исполнитель" : "Клиент"}</th>
            <th>{executor ? "Направления" : "Контакты"}</th>
            <th>{executor ? "Загрузка" : "Заказы"}</th>
            <th>{executor ? "Расчёты" : "Оборот"}</th>
            <th>Статус</th>
            <th><span className="sr-only">Открыть</span></th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((entry) => {
            const summary = summaries[entry.id];
            return <tr
              key={entry.id}
              tabIndex={0}
              aria-selected={selectedId === entry.id}
              className={`clickable-row ${selectedId === entry.id ? "is-selected" : ""}`}
              onClick={() => onSelect(entry)}
              onKeyDown={(event) => onRowKeyDown(event, entry)}
            >
              <td>
                <strong>{entry.name || (executor ? "Исполнитель без имени" : "Клиент без названия")}</strong>
                <span>{executor ? (entry.telegram || entry.email || "Контакты не указаны") : (entry.kind === "individual" ? "Частное лицо" : "Компания")}</span>
              </td>
              <td>{executor ? <ExecutorDirectionsCell entry={entry} /> : <ClientContactsCell entry={entry} />}</td>
              <td>{executor ? <ExecutorWorkloadCell summary={summary} /> : <ClientOrdersCell summary={summary} />}</td>
              <td>{executor ? <ExecutorMoneyCell summary={summary} /> : <ClientMoneyCell summary={summary} />}</td>
              <td><Badge tone={entry.archived ? "warning" : "success"}>{entry.archived ? "В архиве" : "Активен"}</Badge></td>
              <td className="directory-table__open" aria-hidden="true">→</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {!data.items.length && <div className="directory-empty"><strong>Записей пока нет</strong><span>Измените фильтры или добавьте новую запись.</span></div>}
    <div className="pagination">
      <Button variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</Button>
      <span>{page} / {data.pages}</span>
      <Button variant="quiet" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</Button>
    </div>
  </section>;
}

function ClientContactsCell({ entry }: { entry: Entry }) {
  return <>
    <strong>{entry.email || "Email не указан"}</strong>
    <span>{entry.phone || (entry.tax_id ? `ИНН ${entry.tax_id}` : "Телефон не указан")}</span>
  </>;
}

function ExecutorDirectionsCell({ entry }: { entry: Entry }) {
  const directions = entry.directions ?? [];
  const first = directions[0];
  const specializations = Array.from(new Set(directions.map((item) => workTypeLabel(item.work_type, item.service_name))));
  return <>
    <strong>{first ? pairLabel(first) : "Направления не указаны"}</strong>
    <span>{specializations.length ? specializations.slice(0, 2).join(" · ") : "Специализация не указана"}</span>
  </>;
}

function ClientOrdersCell({ summary }: { summary: SummaryData | undefined }) {
  if (!isClientSummary(summary)) return <><strong>—</strong><span>Загрузка данных</span></>;
  return <><strong>{summary.order_count} заказов</strong><span>{summary.active_orders} активных</span></>;
}

function ClientMoneyCell({ summary }: { summary: SummaryData | undefined }) {
  if (!isClientSummary(summary)) return <><strong>—</strong><span>—</span></>;
  const debt = Number(summary.debt || 0);
  return <><strong>{rub(summary.revenue)}</strong><span>{`Депозит ${rub(summary.deposit_balance)}${debt > 0 ? ` · долг ${rub(debt)}` : ""}`}</span></>;
}

function ExecutorWorkloadCell({ summary }: { summary: SummaryData | undefined }) {
  if (!isExecutorSummary(summary)) return <><strong>—</strong><span>Загрузка данных</span></>;
  return <><strong>{summary.active_works} активных</strong><span>{summary.completed_works} завершено</span></>;
}

function ExecutorMoneyCell({ summary }: { summary: SummaryData | undefined }) {
  if (!isExecutorSummary(summary)) return <><strong>—</strong><span>—</span></>;
  return <><strong>{rub(summary.owed)}</strong><span>К выплате</span></>;
}

function DirectoryDetail({ entry, executor, summary, onClose, onEdit, onOpenAvailabilityCalendar }: { entry: Entry; executor: boolean; summary: SummaryData | undefined; onClose: () => void; onEdit: () => void; onOpenAvailabilityCalendar?: () => void }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const tabs = useMemo(() => [
    { id: "overview" as const, label: "Обзор" },
    { id: "contacts" as const, label: executor ? "Направления" : "Контакты" },
    ...(executor ? [{ id: "availability" as const, label: "Доступность" }] : []),
    { id: "records" as const, label: executor ? "Работы" : "Заказы" },
    { id: "history" as const, label: "История" },
  ], [executor]);
  const title = entry.name || (executor ? "Без имени" : "Без названия");

  return <aside className="directory-detail-panel" aria-label={`${executor ? "Карточка исполнителя" : "Карточка клиента"}: ${title}`}>
    <header className="directory-detail-panel__header">
      <div>
        <span>{executor ? "Исполнитель" : "Клиент"}</span>
        <h2>{title}</h2>
      </div>
      <div className="directory-detail-panel__header-actions">
        <Badge tone={entry.archived ? "warning" : "success"}>{entry.archived ? "Архив" : "Активен"}</Badge>
        <button type="button" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" size={18} /></button>
      </div>
    </header>

    <div className="directory-detail-tabs" role="tablist" aria-label="Разделы карточки">
      {tabs.map((item) => <button
        key={item.id}
        id={`directory-tab-${entry.id}-${item.id}`}
        type="button"
        role="tab"
        className={tab === item.id ? "is-active" : ""}
        aria-selected={tab === item.id}
        aria-controls={`directory-panel-${entry.id}-${item.id}`}
        onClick={() => setTab(item.id)}
      >{item.label}</button>)}
    </div>

    <div
      id={`directory-panel-${entry.id}-${tab}`}
      role="tabpanel"
      aria-labelledby={`directory-tab-${entry.id}-${tab}`}
      className="directory-detail-panel__body"
    >
      {tab === "overview" && <DirectoryOverview entry={entry} executor={executor} summary={summary} />}
      {tab === "contacts" && (executor
        ? <ExecutorDirectionsPanel entry={entry} />
        : <CrmContacts clientId={entry.id} disabled={entry.archived} />)}
      {tab === "availability" && executor && <ExecutorAvailabilityPanel entry={entry} onOpenCalendar={onOpenAvailabilityCalendar} />}
      {tab === "records" && (executor
        ? <ExecutorWorksPanel summary={summary} />
        : <ClientOrdersPanel summary={summary} />)}
      {tab === "history" && <DirectoryActivity id={entry.id} executor={executor} />}
    </div>

    <footer className="directory-detail-panel__footer">
      <Button className="directory-detail-panel__primary" onClick={onEdit}>Редактировать</Button>
    </footer>
  </aside>;
}

function DirectoryOverview({ entry, executor, summary }: { entry: Entry; executor: boolean; summary: SummaryData | undefined }) {
  return <div className="directory-overview">
    <section className="directory-detail-section">
      <div className="directory-detail-section__title"><Icon name={executor ? "executors" : "clients"} size={17} /><strong>Основная информация</strong></div>
      <dl className="directory-facts">
        <div><dt>Email</dt><dd>{entry.email || "Не указан"}</dd></div>
        <div><dt>Телефон</dt><dd>{entry.phone || "Не указан"}</dd></div>
        {executor ? <div><dt>Telegram / контакт</dt><dd>{entry.telegram || "Не указан"}</dd></div> : <>
          <div><dt>Тип клиента</dt><dd>{entry.kind === "individual" ? "Частное лицо" : "Компания"}</dd></div>
          <div><dt>ИНН</dt><dd>{entry.tax_id || "Не указан"}</dd></div>
        </>}
      </dl>
    </section>

    <DirectorySummaryCards executor={executor} summary={summary} />

    {!executor && <ClientDepositPanel entry={entry} initialBalance={isClientSummary(summary) ? summary.deposit_balance : 0} />}

    {!executor && isClientSummary(summary) && <ClientLanguagePairs orders={summary.orders} />}
    {executor && <ExecutorSpecializations entry={entry} />}

    <section className="directory-detail-section">
      <div className="directory-detail-section__title"><Icon name="document" size={17} /><strong>Внутренняя заметка</strong></div>
      <p className={entry.notes ? "directory-note" : "directory-muted"}>{entry.notes || "Заметка пока не добавлена."}</p>
    </section>
  </div>;
}

function DirectorySummaryCards({ executor, summary }: { executor: boolean; summary: SummaryData | undefined }) {
  if (!summary) return <div className="directory-summary-loading"><LoadingState label="Загрузка CRM-показателей" /></div>;

  const items = executor && isExecutorSummary(summary)
    ? [
      ["Активные работы", String(summary.active_works)],
      ["Завершено", String(summary.completed_works)],
      ["Начислено", rub(summary.amount_due)],
      ["К выплате", rub(summary.owed)],
    ]
    : isClientSummary(summary) ? [
      ["Всего заказов", String(summary.order_count)],
      ["Активные", String(summary.active_orders)],
      ["Выручка", rub(summary.revenue)],
      ["Задолженность", rub(summary.debt)],
    ] : [];

  return <section className="directory-detail-section">
    <div className="directory-detail-section__title"><Icon name="overview" size={17} /><strong>CRM-показатели</strong></div>
    <div className="directory-summary-grid">
      {items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
  </section>;
}

function depositOperationLabel(kind: string) {
  if (kind === "MANUAL_TOP_UP") return "Пополнение";
  if (kind === "MANUAL_SET") return "Корректировка";
  if (kind === "ORDER_DEBIT") return "Списание по заказу";
  return "Операция";
}

function ClientDepositPanel({ entry, initialBalance }: { entry: Entry; initialBalance: string | number }) {
  const [data, setData] = useState<ClientDepositData | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api<ClientDepositData>(`/api/admin/companies/${entry.id}/deposit?limit=12`);
      setData(result);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить депозит");
    }
  }, [entry.id]);

  useEffect(() => { void load(); }, [load]);

  async function change(mode: "TOP_UP" | "SET_BALANCE") {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0 || (mode === "TOP_UP" && numeric <= 0)) {
      setError(mode === "TOP_UP" ? "Укажите сумму пополнения больше нуля" : "Укажите новый баланс");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/companies/${entry.id}/deposit`, {
        method: "POST",
        body: JSON.stringify({ mode, amount: numeric, note }),
      });
      setAmount("");
      setNote("");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось изменить депозит");
    } finally {
      setBusy(false);
    }
  }

  const balance = data?.balance ?? initialBalance;
  return <section className="directory-detail-section client-deposit-panel">
    <div className="directory-detail-section__title"><Icon name="wallet" size={17} /><strong>Депозит клиента</strong></div>
    <div className="client-deposit-panel__balance">
      <span>Текущий остаток</span>
      <strong>{rub(balance)}</strong>
    </div>
    <div className="client-deposit-panel__editor">
      <Input label="Сумма, ₽" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Input label="Комментарий" placeholder="Например, оплата по счёту" value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="client-deposit-panel__actions">
        <Button disabled={busy || entry.archived} onClick={() => void change("TOP_UP")}>{busy ? "Сохраняем…" : "Пополнить"}</Button>
        <Button variant="quiet" disabled={busy || entry.archived} onClick={() => void change("SET_BALANCE")}>Установить баланс</Button>
      </div>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="client-deposit-panel__history">
      <strong>Последние операции</strong>
      {data?.transactions.length ? data.transactions.map((item) => <div className="client-deposit-operation" key={item.id}>
        <div><b>{depositOperationLabel(item.kind)}</b><span>{item.note || (item.order_id ? "Заказ клиента" : "Ручная операция")}</span></div>
        <div><b className={Number(item.amount) < 0 ? "is-debit" : "is-credit"}>{Number(item.amount) > 0 ? "+" : ""}{rub(item.amount)}</b><span>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))}</span></div>
      </div>) : <p className="directory-muted">Операций пока нет.</p>}
    </div>
  </section>;
}

function ClientLanguagePairs({ orders }: { orders: ClientOrder[] }) {
  const [pairs, setPairs] = useState<string[]>([]);
  const orderIds = orders.slice(0, 6).map((order) => order.id).join(",");

  useEffect(() => {
    if (!orderIds) return;
    const controller = new AbortController();
    const ids = orderIds.split(",");
    void Promise.allSettled(ids.map((id) => api<{ items: ExecutorWork[] }>(`/api/admin/orders/${id}/works?page=1`, { signal: controller.signal }))).then((results) => {
      if (controller.signal.aborted) return;
      const next = new Set<string>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const work of result.value.items) {
          if (work.source_language || work.target_language) next.add(`${work.source_language || "—"} → ${work.target_language || "—"}`);
        }
      }
      setPairs(Array.from(next).slice(0, 8));
    });
    return () => controller.abort();
  }, [orderIds]);

  return <section className="directory-detail-section">
    <div className="directory-detail-section__title"><Icon name="applications" size={17} /><strong>Языковые пары по заказам</strong></div>
    {pairs.length ? <div className="directory-chip-list">{pairs.map((pair) => <span key={pair}>{pair}</span>)}</div> : <p className="directory-muted">В доступных заказах языковые пары пока не заполнены.</p>}
  </section>;
}

function ExecutorSpecializations({ entry }: { entry: Entry }) {
  const directions = entry.directions ?? [];
  const specializations = Array.from(new Set(directions.map((direction) => workTypeLabel(direction.work_type, direction.service_name))));
  return <section className="directory-detail-section">
    <div className="directory-detail-section__title"><Icon name="applications" size={17} /><strong>Специализация</strong></div>
    {specializations.length ? <div className="directory-chip-list">{specializations.map((item) => <span key={item}>{item}</span>)}</div> : <p className="directory-muted">Специализация пока не указана.</p>}
  </section>;
}

function ExecutorDirectionsPanel({ entry }: { entry: Entry }) {
  const directions = entry.directions ?? [];
  return <section className="directory-tab-section">
    <header><div><span className="overline">Рабочие направления</span><h3>Языковые пары и услуги</h3></div><Badge tone="info">{directions.length}</Badge></header>
    {directions.length ? <div className="directory-direction-list">
      {directions.map((direction, index) => <article key={`${direction.source_language}-${direction.target_language}-${direction.work_type}-${index}`}>
        <strong>{pairLabel(direction)}</strong>
        <div className="directory-direction-list__meta"><span>{workTypeLabel(direction.work_type, direction.service_name)}</span><small>{directionRateLabel(direction)}</small></div>
      </article>)}
    </div> : <div className="directory-empty directory-empty--panel"><strong>Направления не заполнены</strong><span>Добавьте языковые пары и виды работ через редактирование карточки.</span></div>}
  </section>;
}

function ExecutorAvailabilityPanel({ entry, onOpenCalendar }: { entry: Entry; onOpenCalendar?: () => void }) {
  const [items, setItems] = useState<ExecutorAvailability[] | null>(null);
  const [error, setError] = useState("");
  const endpoint = `/api/admin/executors/${entry.id}/availability`;

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: ExecutorAvailability[] }>(endpoint);
      setItems(data.items);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить календарь");
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  return <section className="directory-tab-section executor-availability-summary">
    <header>
      <div><span className="overline">Календарь исполнителя</span><h3>Доступность</h3></div>
      <Badge tone="info">{items?.length ?? 0}</Badge>
    </header>
    <p className="directory-muted executor-availability__hint">Пустой календарь означает «Доступность не указана», а не «Свободен». Редактирование выполняется в общем календаре команды.</p>
    {onOpenCalendar && <Button type="button" variant="secondary" className="executor-availability-summary__open" onClick={onOpenCalendar}>Открыть календарь исполнителей</Button>}
    {error && <ErrorState message={error} />}
    {!items ? <LoadingState label="Загрузка доступности" /> : items.length ? <div className="executor-availability__list">
      {items.map((item) => <article key={item.id}>
        <div>
          <Badge tone={availabilityTone(item.state)}>{availabilityLabels[item.state]}</Badge>
          <strong>{shortDate(item.start_date)} — {shortDate(item.end_date)}</strong>
          {item.notes && <span>{item.notes}</span>}
        </div>
      </article>)}
    </div> : <div className="directory-empty directory-empty--panel"><strong>Доступность не указана</strong><span>Добавьте периоды через общий календарь исполнителей. Подбор не будет считать пустой календарь свободным.</span></div>}
  </section>;
}

function ExecutorAvailabilityCalendar({
  data,
  availability,
  loading,
  calendarStart,
  onCalendarStartChange,
  page,
  setPage,
  onOpenEntry,
  onEditCell,
}: {
  data: PageData;
  availability: Record<string, ExecutorAvailability[]>;
  loading: boolean;
  calendarStart: string;
  onCalendarStartChange: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  onOpenEntry: (entry: Entry) => void;
  onEditCell: (entry: Entry, day: string, item: ExecutorAvailability | null) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftIsoDate(calendarStart, index)), [calendarStart]);
  const end = days.at(-1) ?? calendarStart;

  return <section className="table-surface executor-calendar" aria-label="Календарь доступности исполнителей">
    <div className="executor-calendar__toolbar">
      <div>
        <span className="overline">Командная загрузка</span>
        <h2>Календарь исполнителей</h2>
        <p>{calendarRangeLabel(calendarStart, end)} · пустая ячейка означает, что доступность не указана.</p>
      </div>
      <div className="executor-calendar__nav" aria-label="Период календаря">
        <Button type="button" variant="quiet" aria-label="Предыдущая неделя" onClick={() => onCalendarStartChange(shiftIsoDate(calendarStart, -7))}>←</Button>
        <Button type="button" variant="secondary" onClick={() => onCalendarStartChange(startOfCalendarWeek())}>Сегодня</Button>
        <Button type="button" variant="quiet" aria-label="Следующая неделя" onClick={() => onCalendarStartChange(shiftIsoDate(calendarStart, 7))}>→</Button>
      </div>
    </div>
    {loading && <div className="executor-calendar__loading">Обновляем статусы…</div>}
    <div className="executor-calendar__scroll">
      <table className="executor-calendar__table">
        <thead><tr><th>Исполнитель</th>{days.map((day) => <th key={day}><span>{calendarDayLabel(day)}</span></th>)}</tr></thead>
        <tbody>
          {data.items.map((entry) => <tr key={entry.id}>
            <th scope="row"><button type="button" onClick={() => onOpenEntry(entry)}><strong>{entry.name || "Исполнитель без имени"}</strong><span>{entry.email || entry.phone || "Контакты не указаны"}</span></button></th>
            {days.map((day) => {
              const item = availabilityForDay(availability[entry.id] ?? [], day);
              const label = item ? availabilityLabels[item.state] : "Не указано";
              return <td key={day}>
                <button
                  type="button"
                  className={`executor-calendar__cell ${item ? `is-${item.state.toLowerCase()}` : "is-unknown"}`}
                  aria-label={`${entry.name || "Исполнитель"}, ${calendarDayLabel(day)}: ${label}`}
                  disabled={entry.archived}
                  onClick={() => onEditCell(entry, day, item)}
                >
                  <span>{item ? availabilityLabels[item.state] : "—"}</span>
                </button>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
    {!data.items.length && <div className="directory-empty"><strong>Исполнители не найдены</strong><span>Измените фильтры или добавьте исполнителя.</span></div>}
    <div className="executor-calendar__pager">
      <span>Исполнителей: {data.total}</span>
      <div><Button type="button" variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button><span>{page} / {data.pages}</span><Button type="button" variant="quiet" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Далее →</Button></div>
    </div>
  </section>;
}

function ExecutorAvailabilityEditor({ entry, day, item, onClose, onSaved }: { entry: Entry; day: string; item: ExecutorAvailability | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [state, setState] = useState<AvailabilityState>(item?.state ?? "FREE");
  const [startDate, setStartDate] = useState(item?.start_date ?? day);
  const [endDate, setEndDate] = useState(item?.end_date ?? day);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/admin/executors/${entry.id}/availability`;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!startDate || !endDate) { setError("Укажите начало и окончание периода."); return; }
    setBusy(true); setError("");
    try {
      await api(item ? `${endpoint}/${item.id}` : endpoint, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({ state, start_date: startDate, end_date: endDate, notes, ...(item ? { version: item.version } : {}) }),
      });
      await onSaved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось сохранить период");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!item) return;
    setBusy(true); setError("");
    try {
      await api(`${endpoint}/${item.id}?version=${item.version}`, { method: "DELETE" });
      await onSaved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить период");
    } finally { setBusy(false); }
  }

  return <div className="executor-availability-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="executor-availability-dialog" role="dialog" aria-modal="true" aria-labelledby="executor-availability-dialog-title">
      <header>
        <div><span>Доступность исполнителя</span><h2 id="executor-availability-dialog-title">{entry.name || "Исполнитель"}</h2></div>
        <button type="button" aria-label="Закрыть" disabled={busy} onClick={onClose}><Icon name="close" size={18} /></button>
      </header>
      <form onSubmit={save}>
        <div className="executor-availability-dialog__fields">
          <Select label="Статус" value={state} disabled={busy} onChange={(event) => setState(event.target.value as AvailabilityState)}>
            <option value="FREE">Свободен</option><option value="BUSY">Занят</option><option value="UNAVAILABLE">Недоступен</option><option value="VACATION">Отпуск</option>
          </Select>
          <Input label="С" type="date" value={startDate} disabled={busy} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="По" type="date" value={endDate} disabled={busy} onChange={(event) => setEndDate(event.target.value)} />
          <Textarea label="Комментарий" value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
        </div>
        {error && <ErrorState message={error} />}
        <div className="executor-availability-dialog__actions">
          {item && <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>Удалить период</Button>}
          <span />
          <Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Отмена</Button>
          <Button disabled={busy}>{busy ? "Сохраняем…" : item ? "Сохранить" : "Добавить период"}</Button>
        </div>
      </form>
    </section>
  </div>;
}

function ClientOrdersPanel({ summary }: { summary: SummaryData | undefined }) {
  if (!summary) return <LoadingState label="Загрузка заказов" />;
  if (!isClientSummary(summary)) return null;
  return <section className="directory-tab-section">
    <header><div><span className="overline">Заказы клиента</span><h3>Последние заказы</h3></div><Badge tone="info">{summary.order_count}</Badge></header>
    {summary.orders.length ? <div className="directory-record-list">
      {summary.orders.slice(0, 20).map((order) => <Link key={order.id} href={`/admin/orders?open=${order.id}`}>
        <div><span>{order.number}</span><strong>{order.title || "Заказ без названия"}</strong></div>
        <div><Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge><small>{shortDate(order.deadline)}</small></div>
        <i aria-hidden="true">→</i>
      </Link>)}
    </div> : <div className="directory-empty directory-empty--panel"><strong>Заказов пока нет</strong><span>Связанные с клиентом заказы появятся здесь автоматически.</span></div>}
  </section>;
}

function ExecutorWorksPanel({ summary }: { summary: SummaryData | undefined }) {
  if (!summary) return <LoadingState label="Загрузка работ" />;
  if (!isExecutorSummary(summary)) return null;
  return <section className="directory-tab-section">
    <header><div><span className="overline">Назначения исполнителя</span><h3>Работы и расчёты</h3></div><Badge tone="info">{summary.assignments.length}</Badge></header>
    {summary.assignments.length ? <div className="directory-record-list directory-record-list--works">
      {summary.assignments.slice(0, 20).map((assignment) => {
        const work = assignment.work;
        const orderId = work?.order_id;
        const body = <>
          <div>
            <span>{workTypeLabel(work?.service_code || work?.work_type)}</span>
            <strong>{work ? `${work.source_language || "—"} → ${work.target_language || "—"}` : "Работа"}</strong>
            <small>Ставка {rub(assignment.rate)} · Начислено {rub(assignment.cost)}</small>
          </div>
          <div><Badge tone={statusTone(assignment.status)}>{statusLabel(assignment.status)}</Badge><small>{shortDate(assignment.deadline || work?.deadline)}</small></div>
          <i aria-hidden="true">→</i>
        </>;
        return orderId ? <Link key={assignment.id} href={`/admin/orders?open=${orderId}`}>{body}</Link> : <article key={assignment.id}>{body}</article>;
      })}
    </div> : <div className="directory-empty directory-empty--panel"><strong>Назначений пока нет</strong><span>Работы, назначенные этому исполнителю, появятся здесь автоматически.</span></div>}
  </section>;
}

function DirectoryActivity({ id, executor }: { id: string; executor: boolean }) {
  const [data, setData] = useState<{ items: ActivityItem[]; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void api<{ items: ActivityItem[]; pages: number }>(`/api/admin/${executor ? "executors" : "companies"}/${id}/activity?page=${page}`, { signal: controller.signal })
      .then((result) => { setData(result); setError(""); })
      .catch((nextError) => { if (!controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить историю"); });
    return () => controller.abort();
  }, [executor, id, page]);

  return <section className="directory-tab-section">
    <header><div><span className="overline">Журнал изменений</span><h3>История карточки</h3></div></header>
    {error && <ErrorState message={error} />}
    {!data ? <LoadingState label="Загрузка истории" /> : data.items.length ? <ol className="directory-activity">
      {data.items.map((item) => <li key={item.id}>
        <span aria-hidden="true" />
        <div><strong>{operationalActivityLabel(item.action)}</strong><small>{formatActivityDate(item.created_at)}</small></div>
      </li>)}
    </ol> : <div className="directory-empty directory-empty--panel"><strong>Событий пока нет</strong><span>Изменения карточки будут отображаться здесь.</span></div>}
    {data && data.pages > 1 && <div className="pagination pagination--compact">
      <Button variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</Button>
      <span>{page} / {data.pages}</span>
      <Button variant="quiet" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</Button>
    </div>}
  </section>;
}

function DirectoryForm({ entry, executor, endpoint, services, onClose, onSaved }: { entry: Entry | null; executor: boolean; endpoint: string; services: CatalogService[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(entry?.name ?? "");
  const [email, setEmail] = useState(entry?.email ?? "");
  const [phone, setPhone] = useState(entry?.phone ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [kind, setKind] = useState(entry?.kind ?? "company");
  const [taxId, setTaxId] = useState(entry?.tax_id ?? "");
  const [telegram, setTelegram] = useState(entry?.telegram ?? "");
  const [directions, setDirections] = useState(entry?.directions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`${endpoint}${entry ? `/${entry.id}` : ""}`, {
        method: entry ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          email,
          phone,
          notes,
          ...(entry ? { version: entry.version } : {}),
          ...(executor
            ? { telegram, directions: directions.map(({ source_language, target_language, work_type, default_rate, rate_unit }) => ({ source_language, target_language, work_type, default_rate: Number(default_rate || 0), rate_unit: rate_unit || "CONDITIONAL_PAGE" })) }
            : { kind, tax_id: taxId || null, manager_id: entry?.manager_id ?? null }),
        }),
      });
      onSaved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      await api(`${endpoint}/${entry.id}/archive`, {
        method: "POST",
        body: JSON.stringify({ version: entry.version, archived: !entry.archived }),
      });
      onSaved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return <aside className="directory-editor-panel" aria-label={entry ? "Редактирование карточки" : "Создание карточки"}>
    <header className="directory-editor-panel__header">
      <div><span>{entry ? "Редактирование" : "Новая запись"}</span><h2>{entry?.name || (executor ? "Исполнитель" : "Клиент")}</h2></div>
      <button type="button" onClick={onClose} aria-label="Закрыть редактор"><Icon name="close" size={18} /></button>
    </header>

    <form className="directory-editor-panel__form" onSubmit={save}>
      {error && <ErrorState message={error} />}
      <fieldset disabled={busy || Boolean(entry?.archived)} className="directory-editor-fields">
        <Input label={executor ? "Имя исполнителя" : "Имя / название"} hint="Можно заполнить позже" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} />
        {executor ? <Input label="Telegram / другой контакт" value={telegram} onChange={(event) => setTelegram(event.target.value)} maxLength={160} /> : <>
          <Select label="Тип клиента" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="company">Компания</option>
            <option value="individual">Частное лицо</option>
          </Select>
          <Input label="ИНН (необязательно)" value={taxId} onChange={(event) => setTaxId(event.target.value)} maxLength={12} />
        </>}
        <Textarea label="Внутренний комментарий" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} />
      </fieldset>

      {executor && <section className="directory-editor-directions">
        <header><h3>Направления и услуги</h3><span>{directions.length}</span></header>
        {directions.map((direction, index) => <div className="directory-editor-direction" key={index}>
          <LanguageCombobox label={`Язык пары A ${index + 1}`} value={direction.source_language} disabled={busy || entry?.archived} onChange={(value) => setDirections(directions.map((item, itemIndex) => itemIndex === index ? { ...item, source_language: value } : item))} />
          <LanguageCombobox label={`Язык пары B ${index + 1}`} value={direction.target_language} disabled={busy || entry?.archived} onChange={(value) => setDirections(directions.map((item, itemIndex) => itemIndex === index ? { ...item, target_language: value } : item))} />
          <Select label={`Услуга ${index + 1}`} value={direction.work_type} disabled={busy || entry?.archived} onChange={(event) => {
            const service = services.find((item) => item.code === event.target.value);
            setDirections(directions.map((item, itemIndex) => itemIndex === index ? { ...item, work_type: event.target.value, service_name: service?.name, canonical_service: Boolean(service), rate_unit: item.rate_unit || service?.billing_mode || "CONDITIONAL_PAGE" } : item));
          }}>
            {!services.some((service) => service.code === direction.work_type) && direction.work_type && <option value={direction.work_type}>Несопоставленная: {workTypeLabel(direction.work_type, direction.service_name)}</option>}
            {services.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
          </Select>
          <Input label={`Ставка по умолчанию ${index + 1}, ₽`} type="number" min="0" step="0.01" value={String(direction.default_rate ?? 0)} disabled={busy || entry?.archived} onChange={(event) => setDirections(directions.map((item, itemIndex) => itemIndex === index ? { ...item, default_rate: event.target.value } : item))} />
          <Select label={`Единица ставки ${index + 1}`} value={direction.rate_unit || "CONDITIONAL_PAGE"} disabled={busy || entry?.archived} onChange={(event) => setDirections(directions.map((item, itemIndex) => itemIndex === index ? { ...item, rate_unit: event.target.value } : item))}>
            <option value="CONDITIONAL_PAGE">Усл. страница / 1800 знаков</option>
            <option value="PER_1000_CHARS">За 1000 знаков</option>
            <option value="PER_PAGE">За страницу</option>
            <option value="PER_DOCUMENT">За документ</option>
            <option value="PER_MINUTE">За минуту</option>
            <option value="HOURLY">За час</option>
            <option value="FIXED">Фиксированная</option>
            <option value="CUSTOM">Своя единица</option>
          </Select>
          <Button type="button" variant="quiet" disabled={busy || entry?.archived} onClick={() => setDirections(directions.filter((_, itemIndex) => itemIndex !== index))}>Убрать</Button>
        </div>)}
        <Button type="button" variant="secondary" disabled={busy || entry?.archived} onClick={() => { const firstService = services.find((service) => service.code === "written_translation") ?? services[0]; setDirections([...directions, { source_language: "", target_language: "", work_type: firstService?.code || "written_translation", service_name: firstService?.name, canonical_service: Boolean(firstService), default_rate: 0, rate_unit: firstService?.billing_mode || "CONDITIONAL_PAGE" }]); }}>Добавить направление</Button>
      </section>}

      <div className="directory-editor-panel__actions">
        <Button disabled={busy || Boolean(entry?.archived)}>{busy ? "Сохраняем…" : "Сохранить"}</Button>
        {entry && <Button type="button" variant="quiet" disabled={busy} onClick={archive}>{entry.archived ? "Восстановить" : "В архив"}</Button>}
        <Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Отмена</Button>
      </div>
    </form>
  </aside>;
}
