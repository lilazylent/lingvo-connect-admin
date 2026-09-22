"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ActionMenu, Badge, Button, EmptyState, ErrorState, Input, Select, TableSkeleton } from "@/components/ui";
import { Icon, Pictogram } from "@/components/icons";
import { api, apiDownloadUrl, ApiError } from "@/lib/api";
import { formatBytes, formatDate, serviceLabel, serviceOptions, sourceLabels, statusMeta, statusOptions } from "@/lib/applications";
import type { Application, ApplicationDetail, ApplicationList, UserSummary } from "@/lib/types";

export default function ApplicationsPage() {
  return <Suspense fallback={<TableSkeleton rows={7} />}><ApplicationsWorkspace /></Suspense>;
}

function ApplicationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const [data, setData] = useState<ApplicationList | null>(null);
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [counts, setCounts] = useState({ NEW: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 });
  const [selected, setSelected] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const suffix = queryKey ? `?${queryKey}` : "";
      const [applications, users, newRows, inProgressRows, completedRows, cancelledRows] = await Promise.all([
        api<ApplicationList>(`/api/admin/applications${suffix}`),
        api<UserSummary[]>("/api/admin/applications/managers"),
        api<ApplicationList>("/api/admin/applications?status_code=NEW&page=1"),
        api<ApplicationList>("/api/admin/applications?status_code=IN_PROGRESS&page=1"),
        api<ApplicationList>("/api/admin/applications?status_code=COMPLETED&page=1"),
        api<ApplicationList>("/api/admin/applications?status_code=CANCELLED&page=1"),
      ]);
      setData(applications); setManagers(users);
      setCounts({ NEW: newRows.total, IN_PROGRESS: inProgressRows.total, COMPLETED: completedRows.total, CANCELLED: cancelledRows.total });
      setSelected((current) => current ? applications.items.find((item) => item.id === current.id) ?? null : null);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить заявки");
    } finally { setLoading(false); }
  }, [queryKey]);

  useEffect(() => {
    // URL query remains the source of truth for server-side list state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function updateQuery(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (!("page" in changes)) next.delete("page");
    router.replace(`/admin/applications${next.size ? `?${next}` : ""}`);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateQuery({ search: search.trim() });
  }

  const activeFilters = useMemo(() => ["status_code", "manager_id", "source", "service", "language", "date_from", "date_to", "deadline_from", "deadline_to"].filter((key) => searchParams.has(key)).length, [searchParams]);
  const sort = searchParams.get("sort") ?? "submitted_at";
  const order = searchParams.get("order") ?? "desc";
  function sortBy(field: string) { updateQuery({ sort: field, order: sort === field && order === "desc" ? "asc" : "desc" }); }

  return <>
    <header className="page-head page-head--compact">
      <div><span className="overline overline--accent">Лингво Коннект / Заявки</span><h1>Заявки</h1><p>Входящие запросы на переводы. Обрабатывайте заявки, назначайте ответственных и превращайте их в заказы.</p></div>
      <Link className="button button--primary button-link" href="/admin/applications/new"><Icon name="plus" size={17} /> Новая заявка</Link>
    </header>

    <section className="lc-module-metrics lc-module-metrics--4" aria-label="Состояние очереди заявок">
      <Metric label="Новые" value={counts.NEW} tone="pink" icon="document" onClick={() => updateQuery({ status_code: "NEW" })} />
      <Metric label="В работе" value={counts.IN_PROGRESS} tone="blue" icon="clock" onClick={() => updateQuery({ status_code: "IN_PROGRESS" })} />
      <Metric label="Завершённые" value={counts.COMPLETED} tone="green" icon="shield" onClick={() => updateQuery({ status_code: "COMPLETED" })} />
      <Metric label="Отменённые" value={counts.CANCELLED} tone="orange" icon="hourglass" onClick={() => updateQuery({ status_code: "CANCELLED" })} />
    </section>

    <section className="application-toolbar" aria-label="Поиск и фильтры">
      <form className="application-search" onSubmit={submitSearch}><Input label="Поиск" placeholder="Номер, имя, email, телефон, компания" value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="submit" variant="secondary">Найти</Button></form>
      <details className="filter-disclosure" open={activeFilters > 0 ? true : undefined}><summary><span><Icon name="filter" size={15} /> Фильтры</span><span>{activeFilters > 0 ? `Применено: ${activeFilters}` : "Статус, менеджер, источник и дата"}</span></summary><div className="filter-grid">
        <Select label="Статус" value={searchParams.get("status_code") ?? ""} onChange={(event) => updateQuery({ status_code: event.target.value })}><option value="">Все статусы</option>{statusOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</Select>
        <Select label="Менеджер" value={searchParams.get("manager_id") ?? ""} onChange={(event) => updateQuery({ manager_id: event.target.value })}><option value="">Все менеджеры</option><option value="unassigned">Не назначен</option>{managers.map((item) => <option value={item.id} key={item.id}>{item.display_name}</option>)}</Select>
        <Select label="Источник" value={searchParams.get("source") ?? ""} onChange={(event) => updateQuery({ source: event.target.value })}><option value="">Все источники</option><option value="website">Сайт</option><option value="manual">Вручную</option></Select>
        <Select label="Услуга" value={searchParams.get("service") ?? ""} onChange={(event) => updateQuery({ service: event.target.value })}><option value="">Все услуги</option>{serviceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select>
        <Input label="Язык" placeholder="Русский, английский…" value={searchParams.get("language") ?? ""} onChange={(event) => updateQuery({ language: event.target.value })} />
        <Input label="С даты" type="date" value={searchParams.get("date_from") ?? ""} onChange={(event) => updateQuery({ date_from: event.target.value })} />
        <Input label="По дату" type="date" value={searchParams.get("date_to") ?? ""} onChange={(event) => updateQuery({ date_to: event.target.value })} />
        <Input label="Срок от" type="date" value={searchParams.get("deadline_from") ?? ""} onChange={(event) => updateQuery({ deadline_from: event.target.value })} />
        <Input label="Срок до" type="date" value={searchParams.get("deadline_to") ?? ""} onChange={(event) => updateQuery({ deadline_to: event.target.value })} />
      </div></details>
      {(activeFilters > 0 || searchParams.has("search")) && <button className="clear-filters" onClick={() => { setSearch(""); router.replace("/admin/applications"); }}>Сбросить фильтры · {activeFilters + (searchParams.has("search") ? 1 : 0)}</button>}
    </section>

    {error && <ErrorState message={error} />}
    <div className={`lc-split-workspace ${selected ? "has-selection" : ""}`}>
      <section className="table-surface applications-table">
        <div className="table-caption"><span>{loading ? "Загружаем заявки…" : `Заявок: ${data?.total ?? 0}`}</span><span>Страница {data?.page ?? 1} из {data?.pages ?? 1}</span></div>
        {loading ? <TableSkeleton rows={7} /> : data && data.items.length ? <div className="table-wrap"><table><thead><tr><th><button onClick={() => sortBy("number")}>№ {sort === "number" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => sortBy("name")}>Клиент {sort === "name" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>Услуга / язык</th><th><button onClick={() => sortBy("submitted_at")}>Дата {sort === "submitted_at" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => sortBy("status")}>Статус {sort === "status" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>Ответственный</th><th><span className="sr-only">Меню</span></th></tr></thead><tbody>{data.items.map((item) => { const status = statusMeta(item.status_code); return <tr
          className={`clickable-row ${selected?.id === item.id ? "is-selected" : ""}`}
          key={item.id}
          tabIndex={0}
          aria-selected={selected?.id === item.id}
          onClick={() => setSelected(item)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            setSelected(item);
          }}
        ><td data-label="Заявка"><strong>{item.number}</strong></td><td data-label="Клиент"><strong>{item.company || item.name || "Контакт не указан"}</strong><span>{item.name && item.company ? item.name : item.contact || "—"}</span></td><td data-label="Запрос"><strong>{serviceLabel(item.requested_service)}</strong><span>{[item.source_language, item.target_language].filter(Boolean).join(" → ") || "Языки не указаны"}</span></td><td data-label="Получена"><strong>{formatDate(item.submitted_at)}</strong></td><td data-label="Статус"><Badge tone={status.tone}>{status.label}</Badge></td><td data-label="Менеджер">{item.responsible_manager ? <><strong>{item.responsible_manager.display_name}</strong><span>{item.responsible_manager.email}</span></> : <span className="unassigned">Не назначен</span>}</td><td className="row-arrow" onClick={(event) => event.stopPropagation()}><ActionMenu label={`Действия для заявки ${item.number}`} items={[{ label: "Показать карточку", onSelect: () => setSelected(item) }, { label: "Открыть заявку", onSelect: () => router.push(`/admin/applications/${item.id}`) }]} /></td></tr>; })}</tbody></table></div> : <EmptyState title="Заявок не найдено" text="Измените параметры поиска или зарегистрируйте новую заявку вручную." />}
        {data && data.pages > 1 && <div className="pagination"><Button variant="secondary" disabled={data.page <= 1} onClick={() => updateQuery({ page: String(data.page - 1) })}>←</Button><span>{data.page} / {data.pages}</span><Button variant="secondary" disabled={data.page >= data.pages} onClick={() => updateQuery({ page: String(data.page + 1) })}>→</Button></div>}
      </section>
      {selected && <ApplicationPreview key={selected.id} application={selected} onClose={() => setSelected(null)} />}
    </div>
  </>;
}

function Metric({ label, value, tone, icon, onClick }: { label: string; value: number; tone: string; icon: Parameters<typeof Icon>[0]["name"]; onClick: () => void }) {
  return <button type="button" className={`lc-module-metric lc-module-metric--${tone} is-navigable`} onClick={onClick}><span><Pictogram name={icon} size={19} /></span><strong>{value}</strong><b>{label}</b><i><Icon name="arrow-right" size={14} /></i></button>;
}

type ApplicationPreviewTab = "info" | "contacts" | "files";

function ApplicationPreview({ application, onClose }: { application: Application; onClose: () => void }) {
  const [tab, setTab] = useState<ApplicationPreviewTab>("info");
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<ApplicationDetail>(`/api/admin/applications/${application.id}`, { signal: controller.signal })
      .then((next) => setDetail(next))
      .catch((nextError) => {
        if (!controller.signal.aborted) setDetailError(nextError instanceof Error ? nextError.message : "Не удалось загрузить детали заявки");
      })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [application.id]);

  const current = detail ?? application;
  const meta = statusMeta(current.status_code);
  const tabId = (name: ApplicationPreviewTab) => `application-preview-${application.id}-${name}`;

  return <aside className="lc-detail-panel lc-application-preview" aria-busy={detailLoading}>
    <header><div><span>Заявка</span><h2>{current.number}</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={18} /></button></header>
    <div className="lc-detail-tabs" role="tablist" aria-label="Разделы выбранной заявки">
      <button type="button" role="tab" id={`${tabId("info")}-tab`} aria-controls={tabId("info")} aria-selected={tab === "info"} className={tab === "info" ? "is-active" : ""} onClick={() => setTab("info")}>Информация</button>
      <button type="button" role="tab" id={`${tabId("contacts")}-tab`} aria-controls={tabId("contacts")} aria-selected={tab === "contacts"} className={tab === "contacts" ? "is-active" : ""} onClick={() => setTab("contacts")}>Контакты</button>
      <button type="button" role="tab" id={`${tabId("files")}-tab`} aria-controls={tabId("files")} aria-selected={tab === "files"} className={tab === "files" ? "is-active" : ""} onClick={() => setTab("files")}>Файлы{detail ? ` · ${detail.files.length}` : ""}</button>
    </div>

    {tab === "info" && <div id={tabId("info")} role="tabpanel" aria-labelledby={`${tabId("info")}-tab`}>
      <section><div className="lc-detail-section-title"><Icon name="clients" size={17} /><strong>Клиент</strong><Badge tone={meta.tone}>{meta.label}</Badge></div><h3>{current.company || current.name || "Контакт не указан"}</h3><p>{current.name && current.company ? current.name : current.contact || "Контактные данные не указаны"}</p></section>
      <section className="lc-detail-data"><div><span>Услуга</span><strong>{serviceLabel(current.requested_service)}</strong></div><div><span>Языки</span><strong>{[current.source_language, current.target_language].filter(Boolean).join(" → ") || "—"}</strong></div><div><span>Получена</span><strong>{formatDate(current.submitted_at)}</strong></div><div><span>Источник</span><strong>{sourceLabels[current.source]}</strong></div><div><span>Желаемый срок</span><strong>{current.desired_date || "Не указан"}</strong></div><div><span>Ответственный</span><strong>{current.responsible_manager?.display_name || "Не назначен"}</strong></div></section>
      {current.message && <section><div className="lc-detail-section-title"><Icon name="document" size={17} /><strong>Текст обращения</strong></div><p className="lc-detail-message">{current.message}</p></section>}
    </div>}

    {tab === "contacts" && <div id={tabId("contacts")} role="tabpanel" aria-labelledby={`${tabId("contacts")}-tab`}>
      <section><div className="lc-detail-section-title"><Icon name="clients" size={17} /><strong>Контактные данные</strong><Badge tone={meta.tone}>{meta.label}</Badge></div><h3>{current.company || current.name || "Контакт не указан"}</h3><p>{current.name && current.company ? current.name : "Контакт по заявке"}</p></section>
      <section className="lc-detail-data lc-detail-data--contacts">
        <div><span>Email</span><strong>{current.email || "Не указан"}</strong></div>
        <div><span>Телефон</span><strong>{current.phone || "Не указан"}</strong></div>
        <div><span>Предпочтительный канал</span><strong>{contactMethodLabel(current.contact_method)}</strong></div>
        <div><span>Контакт</span><strong>{current.contact || "Не указан"}</strong></div>
        <div><span>Компания</span><strong>{current.company || "Не указана"}</strong></div>
        <div><span>Ответственный</span><strong>{current.responsible_manager?.display_name || "Не назначен"}</strong></div>
      </section>
    </div>}

    {tab === "files" && <div id={tabId("files")} role="tabpanel" aria-labelledby={`${tabId("files")}-tab`}>
      <section><div className="lc-detail-section-title"><Icon name="files" size={17} /><strong>Файлы заявки</strong></div>
        {detailLoading && <p className="lc-detail-state" role="status">Загружаем файлы…</p>}
        {!detailLoading && detailError && <p className="lc-detail-state lc-detail-state--error" role="alert">{detailError}</p>}
        {!detailLoading && !detailError && detail && detail.files.length > 0 && <div className="lc-preview-files">{detail.files.map((file) => <a key={file.id} href={apiDownloadUrl(`/api/admin/applications/${application.id}/files/${file.id}/download`)}><span className="lc-preview-files__mark" aria-hidden="true">DOC</span><span><strong>{file.original_name}</strong><small>{formatBytes(file.size_bytes)}</small></span><Icon name="arrow-right" size={14} /></a>)}</div>}
        {!detailLoading && !detailError && detail && detail.files.length === 0 && <p className="lc-detail-state">К заявке пока не прикреплены файлы.</p>}
      </section>
    </div>}

    <Link className="button button--primary lc-detail-primary" href={`/admin/applications/${application.id}`}>Открыть заявку <Icon name="arrow-right" size={16} /></Link>
  </aside>;
}

function contactMethodLabel(value: string) {
  if (value === "email") return "Email";
  if (value === "phone") return "Телефон";
  if (value === "messenger") return "Мессенджер";
  return value || "Не указан";
}
