"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, apiDownloadUrl } from "@/lib/api";
import { formatBillingNumber } from "@/lib/billing-format";
import { CrmLookup } from "./crm-lookup";
import { Pictogram, Icon, type IconName } from "./icons";
import { EmptyState, ErrorState, Input, LoadingState, Select } from "./ui";

type Bucket = {
  orders: number;
  works: number;
  pages: number;
  documents: number;
  hours: number;
  revenue: number | string;
  executor_cost: number | string;
  profit: number | string;
};
type Row = Bucket & { name?: string; topic?: string; month?: string; client_id?: string; kind?: string; service_code?: string };
type Statistics = {
  totals: Bucket & { orders_all: number; paid: number | string; debt: number | string; margin_percent: number | string };
  by_service: Row[];
  by_topic: Row[];
  by_client: Row[];
  by_executor: Row[];
  by_month: Row[];
};
type Breakdown = "by_service" | "by_client" | "by_executor" | "by_topic" | "by_month";

const BREAKDOWNS: Array<[Breakdown, string, string]> = [
  ["by_service", "По услугам", "Услуга"],
  ["by_client", "По клиентам", "Клиент"],
  ["by_executor", "По исполнителям", "Исполнитель"],
  ["by_topic", "По тематикам", "Тематика"],
  ["by_month", "По месяцам", "Месяц"],
];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const FILTER_KEYS = ["date_from", "date_to", "client", "executor", "service", "kind"] as const;

function rub(value: string | number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function rowLabel(row: Row) {
  if (row.month) {
    const [year, month] = row.month.split("-");
    return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
  }
  return row.topic || row.name || "—";
}

export function CrmStatistics() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // filters live in the URL so a client/executor card can link straight to its statistics
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ""])) as Record<(typeof FILTER_KEYS)[number], string>;
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [services, setServices] = useState<Array<{ code: string; name: string; active: boolean }>>([]);
  const [breakdown, setBreakdown] = useState<Breakdown>(filters.client ? "by_month" : "by_service");

  const apiParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    if (filters.client) params.set("client_id", filters.client);
    if (filters.executor) params.set("executor_id", filters.executor);
    if (filters.service) params.set("service_code", filters.service);
    if (filters.kind) params.set("kind", filters.kind);
    return params.toString();
  }, [filters.client, filters.date_from, filters.date_to, filters.executor, filters.kind, filters.service]);

  useEffect(() => {
    const controller = new AbortController();
    void api<Statistics>(`/api/admin/crm/statistics?${apiParams}`, { signal: controller.signal })
      .then((result) => { setData(result); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить статистику"); });
    return () => controller.abort();
  }, [apiParams]);

  useEffect(() => {
    const controller = new AbortController();
    void api<Array<{ code: string; name: string; active: boolean }>>("/api/admin/crm/services?active=true", { signal: controller.signal })
      .then((rows) => setServices(rows.filter((row) => row.active)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setPreset(preset: "month" | "quarter" | "year" | "all") {
    const next = new URLSearchParams(searchParams.toString());
    const today = new Date();
    const iso = (d: Date) => d.toLocaleDateString("sv-SE");
    const start = preset === "month" ? new Date(today.getFullYear(), today.getMonth(), 1)
      : preset === "quarter" ? new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
        : new Date(today.getFullYear(), 0, 1);
    if (preset === "all") { next.delete("date_from"); next.delete("date_to"); } else { next.set("date_from", iso(start)); next.set("date_to", iso(today)); }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const totals = data?.totals;
  const tiles: Array<[IconName, string, string, string]> = totals ? [
    ["orders", "pink", String(totals.orders), "Принятых заказов"],
    ["trend", "blue", rub(totals.revenue), "Выручка"],
    ["wallet", "green", rub(totals.paid), "Оплачено"],
    ["hourglass", "orange", rub(totals.debt), "Остаток к оплате"],
    ["executors", "violet", rub(totals.executor_cost), "Выплаты исполнителям"],
    ["shield", "green", rub(totals.profit), "Прибыль"],
    ["bolt", "blue", `${formatBillingNumber(totals.margin_percent)} %`, "Маржинальность"],
    ["document", "pink", formatBillingNumber(totals.pages), "Страниц переведено"],
  ] : [];
  const rows = data?.[breakdown] ?? [];
  const [, , firstColumn] = BREAKDOWNS.find(([id]) => id === breakdown) ?? BREAKDOWNS[0];

  return <div className="crm-statistics">
    <header className="page-head page-head--compact crm-orders-head">
      <div>
        <span className="overline overline--accent">Лингво Коннект / Статистика</span>
        <h1>Статистика</h1>
        <p>Заказы, выручка, выплаты исполнителям и прибыль по периодам, клиентам, исполнителям и услугам. Учитываются принятые заказы; рассчитанные и отменённые — нет.</p>
      </div>
      <a className="button button--primary" href={apiDownloadUrl(`/api/admin/crm/statistics/export.xlsx?${apiParams}`)}>
        <Icon name="download" size={17} /> Выгрузить в Excel
      </a>
    </header>

    <section className="phase5-orders-command crm-statistics__filters" aria-label="Фильтры статистики">
      <div className="crm-statistics__filter-grid">
        <Input label="Период с" type="date" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} />
        <Input label="по" type="date" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} />
        <CrmLookup label="Клиент" path="/api/admin/companies" value={filters.client} onChange={(id) => setFilter("client", id)} placeholder="Все клиенты" />
        <CrmLookup label="Исполнитель" path="/api/admin/executors?archived=false" value={filters.executor} onChange={(id) => setFilter("executor", id)} placeholder="Все исполнители" />
        <Select label="Услуга" value={filters.service} onChange={(e) => setFilter("service", e.target.value)}>
          <option value="">Все услуги</option>
          {services.map((service) => <option key={service.code} value={service.code}>{service.name}</option>)}
        </Select>
        <Select label="Тип клиента" value={filters.kind} onChange={(e) => setFilter("kind", e.target.value)}>
          <option value="">Все клиенты</option>
          <option value="company">Компании</option>
          <option value="individual">Частные лица</option>
        </Select>
      </div>
      <div className="phase5-orders-viewbar crm-statistics__presets">
        <div className="view-switch" role="group" aria-label="Быстрый период">
          <button type="button" onClick={() => setPreset("month")}>Этот месяц</button>
          <button type="button" onClick={() => setPreset("quarter")}>Квартал</button>
          <button type="button" onClick={() => setPreset("year")}>Этот год</button>
          <button type="button" onClick={() => setPreset("all")}>Весь период</button>
        </div>
        {FILTER_KEYS.some((key) => filters[key]) && <button type="button" className="button button--quiet" onClick={() => router.replace(pathname, { scroll: false })}>Сбросить фильтры</button>}
      </div>
    </section>

    {error && <ErrorState message={error} />}
    {!data && !error ? <LoadingState label="Считаем статистику" /> : data && <>
      <section className="lc-module-metrics lc-module-metrics--4 crm-statistics__tiles" aria-label="Итоги">
        {tiles.map(([icon, tone, value, label]) => <div key={label} className={`lc-module-metric lc-module-metric--${tone}`}>
          <span><Pictogram name={icon} size={19} /></span>
          <strong>{value}</strong>
          <b>{label}</b>
        </div>)}
      </section>

      <section className="table-surface crm-statistics__table" aria-label="Разбивка статистики">
        <div className="table-caption crm-statistics__caption">
          <div className="view-switch" role="tablist" aria-label="Разбивка">
            {BREAKDOWNS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={breakdown === id} className={breakdown === id ? "is-active" : ""} onClick={() => setBreakdown(id)}>{label}</button>)}
          </div>
          <span>Всего заказов в выборке, включая рассчитанные: {data.totals.orders_all}</span>
        </div>
        {rows.length ? <div className="table-wrap">
          <table>
            <thead><tr><th>{firstColumn}</th><th>Заказов</th><th>Работ</th><th>Страниц</th><th>Документов</th><th>Выручка</th><th>Выплаты</th><th>Прибыль</th></tr></thead>
            <tbody>
              {rows.map((row, index) => <tr
                key={`${rowLabel(row)}-${index}`}
                className={breakdown === "by_client" && row.client_id ? "clickable-row" : ""}
                onClick={breakdown === "by_client" && row.client_id ? () => { setFilter("client", row.client_id ?? ""); setBreakdown("by_month"); } : undefined}
              >
                <td><strong>{rowLabel(row)}</strong>{row.kind && <span>{row.kind === "individual" ? "Частное лицо" : "Компания"}</span>}</td>
                <td>{row.orders}</td>
                <td>{row.works}</td>
                <td>{formatBillingNumber(row.pages)}</td>
                <td>{formatBillingNumber(row.documents)}</td>
                <td>{rub(row.revenue)}</td>
                <td>{rub(row.executor_cost)}</td>
                <td><strong>{rub(row.profit)}</strong></td>
              </tr>)}
            </tbody>
          </table>
        </div> : <EmptyState title="Нет данных" text="За выбранный период и с этими фильтрами принятых заказов нет." />}
      </section>
    </>}
  </div>;
}
