"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, EmptyState, ErrorState, Input, Select, TableSkeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDate, serviceLabel, serviceOptions, sourceLabels, statusMeta, statusOptions } from "@/lib/applications";
import type { ApplicationList, UserSummary } from "@/lib/types";

export default function ApplicationsPage() {
  return <Suspense fallback={<TableSkeleton rows={7} />}><ApplicationsWorkspace /></Suspense>;
}

function ApplicationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const [data, setData] = useState<ApplicationList | null>(null);
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const suffix = queryKey ? `?${queryKey}` : "";
      const [applications, users] = await Promise.all([
        api<ApplicationList>(`/api/admin/applications${suffix}`),
        api<UserSummary[]>("/api/admin/applications/managers"),
      ]);
      setData(applications); setManagers(users);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить заявки");
    } finally { setLoading(false); }
  }, [queryKey]);

  useEffect(() => {
    // URL query is the source of truth for server-side list state.
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
    <header className="page-head page-head--compact"><div><span className="overline overline--accent">Рабочая очередь / 02</span><h1>Заявки</h1><p>Входящие обращения с сайта и запросы, зарегистрированные менеджерами вручную.</p></div><Link className="button button--primary button-link" href="/admin/applications/new">Добавить обращение <span>+</span></Link></header>

    <details className="workflow-help"><summary>Откуда появляются заявки и что делать дальше?</summary><div><p><strong>С сайта.</strong> Посетитель заполняет форму — обращение поступает в эту очередь.</p><p><strong>По почте или телефону.</strong> Нажмите «Добавить обращение» и запишите данные вручную.</p><p><strong>Дальше.</strong> Откройте заявку, свяжитесь с человеком, уточните задачу и назначьте менеджера. Свяжите заявку с клиентом и создайте заказ: в нём можно назначить исполнителей и отслеживать отдельные работы.</p></div></details>
    <section className="application-toolbar" aria-label="Поиск и фильтры">
      <form className="application-search" onSubmit={submitSearch}><Input label="Поиск" placeholder="Номер, имя, email, телефон, компания" value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="submit" variant="secondary">Найти</Button></form>
      <details className="filter-disclosure" open={activeFilters > 0 ? true : undefined}><summary>Фильтры <span>{activeFilters > 0 ? `Применено: ${activeFilters}` : "Статус, менеджер, источник и дата"}</span></summary><div className="filter-grid">
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
    <section className="table-surface applications-table">
      <div className="table-caption"><span>{loading ? "Загружаем заявки…" : `Заявок: ${data?.total ?? 0}`}</span><span>Страница {data?.page ?? 1} из {data?.pages ?? 1}</span></div>
      {loading ? <TableSkeleton rows={7} /> : data && data.items.length ? <div className="table-wrap"><table><thead><tr><th><button onClick={() => sortBy("number")}>ID {sort === "number" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => sortBy("submitted_at")}>Дата {sort === "submitted_at" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => sortBy("name")}>Контакт {sort === "name" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>Запрос</th><th><button onClick={() => sortBy("desired_date")}>Желаемый срок {sort === "desired_date" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => sortBy("status")}>Статус {sort === "status" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>Ответственный</th><th>Источник</th><th><span className="sr-only">Открыть</span></th></tr></thead><tbody>{data.items.map((item) => { const status = statusMeta(item.status_code); return <tr className="clickable-row" key={item.id} onClick={() => router.push(`/admin/applications/${item.id}`)} ><td data-label="Заявка"><Link className="application-number" href={`/admin/applications/${item.id}`} aria-label={`Открыть заявку ${item.number}`}>{item.number} ↗</Link></td><td data-label="Получена"><strong>{formatDate(item.submitted_at)}</strong></td><td data-label="Кто обратился"><strong>{item.name || "Контакт не указан"}</strong><span>{item.company || "Компания не указана"}</span><span>{item.contact || "Способ связи не указан"}</span></td><td data-label="Запрос"><strong>{serviceLabel(item.requested_service)}</strong><span>{[item.source_language, item.target_language].filter(Boolean).join(" → ") || item.message.slice(0, 52) || "Детали не указаны"}</span></td><td data-label="Желаемый срок"><strong>{item.desired_date ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(`${item.desired_date}T00:00:00`)) : "Не указан"}</strong></td><td data-label="Статус"><Badge tone={status.tone}>{status.label}</Badge></td><td data-label="Менеджер">{item.responsible_manager ? <><strong>{item.responsible_manager.display_name}</strong><span>{item.responsible_manager.email}</span></> : <span className="unassigned">Не назначен</span>}</td><td data-label="Источник"><Badge>{sourceLabels[item.source]}</Badge></td><td className="row-arrow">→</td></tr>; })}</tbody></table></div> : <EmptyState title="Заявок не найдено" text="Измените параметры поиска или зарегистрируйте новую заявку вручную." />}
      {data && data.pages > 1 && <div className="pagination"><Button variant="secondary" disabled={data.page <= 1} onClick={() => updateQuery({ page: String(data.page - 1) })}>← Назад</Button><span>{data.page} / {data.pages}</span><Button variant="secondary" disabled={data.page >= data.pages} onClick={() => updateQuery({ page: String(data.page + 1) })}>Далее →</Button></div>}
    </section>
  </>;
}
