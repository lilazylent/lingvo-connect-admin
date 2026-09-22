"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { Icon, Pictogram, type IconName } from "@/components/icons";
import { api } from "@/lib/api";
import type { ApplicationList } from "@/lib/types";
import { formatDate, statusMeta } from "@/lib/applications";

type Summary = {
  new_leads: number;
  active_orders: number;
  due_today: number;
  overdue: number;
  unassigned: number;
  awaiting_payment: number;
  revenue: string | number;
  executor_cost: string | number;
  profit: string | number;
  recent_orders: {
    id: string;
    number: string;
    title: string;
    deadline: string | null;
    status: string;
  }[];
};

const rub = (value: string | number) => `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

const orderStatus: Record<string, string> = {
  NEW: "Новый",
  ESTIMATING: "В расчёте",
  APPROVED: "Согласован",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  READY: "Готов",
  DELIVERED: "Выдан",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export default function DashboardPage() {
  const { state } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [applications, setApplications] = useState<ApplicationList | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [dashboard, recentApplications] = await Promise.all([
        api<Summary>("/api/admin/crm/dashboard"),
        api<ApplicationList>("/api/admin/applications?page=1&sort=submitted_at&order=desc"),
      ]);
      setSummary(dashboard);
      setApplications(recentApplications);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить CRM-обзор");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!state) return null;
  const firstName = (state.user.display_name || state.user.email.split("@")[0]).split(" ")[0];

  if (!summary) {
    return <><DashboardHeader firstName={firstName} /><ErrorStateOrNothing error={error} /><LoadingState label="Собираем CRM-показатели" /></>;
  }

  const metrics: Array<{ label: string; value: number; icon: IconName; tone: string; href: string }> = [
    { label: "Новые заявки", value: summary.new_leads, icon: "document", tone: "wine", href: "/admin/applications?status_code=NEW" },
    { label: "Активные заказы", value: summary.active_orders, icon: "folder", tone: "slate", href: "/admin/orders" },
    { label: "Сдать сегодня", value: summary.due_today, icon: "clock", tone: "amber", href: "/admin/orders" },
    { label: "Просрочено", value: summary.overdue, icon: "hourglass", tone: "red", href: "/admin/orders" },
    { label: "Без исполнителя", value: summary.unassigned, icon: "executors", tone: "teal", href: "/admin/orders" },
    { label: "Ждут оплаты", value: summary.awaiting_payment, icon: "wallet", tone: "gold", href: "/admin/orders" },
  ];

  return (
    <div className="lc-dashboard">
      <DashboardHeader firstName={firstName} />
      <ErrorStateOrNothing error={error} />

      <section className="lc-metric-grid" aria-label="Ключевые показатели">
        {metrics.map((metric) => (
          <Link href={metric.href} className={`lc-metric-card lc-metric-card--${metric.tone}`} key={metric.label}>
            <span className="lc-metric-card__icon"><Pictogram name={metric.icon} size={20} /></span>
            <div className="lc-metric-card__value">{metric.value}</div>
            <div className="lc-metric-card__label">{metric.label}</div>
            <span className="lc-circle-arrow" aria-hidden="true"><Icon name="arrow-right" size={14} /></span>
          </Link>
        ))}
      </section>

      <section className="lc-finance-strip" aria-label="Финансовая сводка">
        <FinanceCell label="Выручка по заказам" value={rub(summary.revenue)} />
        <FinanceCell label="Расходы на исполнителей" value={rub(summary.executor_cost)} />
        <FinanceCell label="Расчётная прибыль" value={rub(summary.profit)} />
      </section>

      <section className="lc-dashboard-main-grid">
        <div className="lc-dashboard-lists">
          <section className="lc-surface lc-table-card">
            <div className="lc-card-title"><span><Icon name="orders" />Последние заказы</span><Link href="/admin/orders">Открыть все <Icon name="arrow-right" size={15} /></Link></div>
            <div className="lc-compact-table lc-orders-table">
              <div className="lc-compact-table__head"><span>№</span><span>Название</span><span>Срок</span><span>Статус</span><span /></div>
              {summary.recent_orders.slice(0, 4).map((order) => (
                <Link href={`/admin/orders?open=${order.id}`} className="lc-compact-table__row" key={order.id}>
                  <span>{order.number}</span>
                  <strong>{order.title || "Заказ без названия"}</strong>
                  <span>{order.deadline || "—"}</span>
                  <Badge tone={order.status === "COMPLETED" ? "success" : order.status === "CANCELLED" ? "warning" : "neutral"}>{orderStatus[order.status] || order.status}</Badge>
                  <span className="lc-more" aria-hidden="true"><Icon name="arrow-right" size={15} /></span>
                </Link>
              ))}
              {!summary.recent_orders.length && <div className="lc-compact-empty">Пока нет заказов.</div>}
            </div>
          </section>

          <section className="lc-surface lc-table-card">
            <div className="lc-card-title"><span><Icon name="applications" />Последние заявки</span><Link href="/admin/applications">Открыть все <Icon name="arrow-right" size={15} /></Link></div>
            <div className="lc-compact-table lc-applications-table">
              <div className="lc-compact-table__head"><span>№</span><span>Клиент</span><span>Язык</span><span>Дата</span><span>Статус</span></div>
              {applications?.items.slice(0, 4).map((application) => {
                const meta = statusMeta(application.status_code);
                return (
                  <Link href={`/admin/applications/${application.id}`} className="lc-compact-table__row" key={application.id}>
                    <span>{application.number}</span>
                    <strong>{application.company || application.name || "Контакт"}</strong>
                    <span>{[application.source_language, application.target_language].filter(Boolean).join(" → ") || "—"}</span>
                    <span>{formatDate(application.submitted_at)}</span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </Link>
                );
              })}
              {!applications?.items.length && <div className="lc-compact-empty">Пока нет заявок.</div>}
            </div>
          </section>
        </div>

        <aside className="lc-dashboard-aside">
          <section className="lc-surface lc-quick-actions">
            <div className="lc-card-title"><span><Icon name="bolt" />Быстрые действия</span></div>
            <div>
              <Link className="lc-quick-action lc-quick-action--primary" href="/admin/applications/new"><Icon name="plus" />Новая заявка</Link>
              <Link className="lc-quick-action" href="/admin/orders"><Icon name="plus" />Новый заказ</Link>
              <Link className="lc-quick-action" href="/admin/files"><Icon name="upload" />Загрузить файлы</Link>
              <Link className="lc-quick-action" href="/admin/clients"><Icon name="users" />Добавить клиента</Link>
            </div>
          </section>
          <section className="lc-surface lc-system-card">
            <div className="lc-card-title"><span><Icon name="database" />Сервер и система</span><span className="lc-health"><i />Работает штатно</span></div>
            <strong>Лингво Коннект</strong>
            <p>CRM для бюро переводов. Стабильная работа и сохранность ваших данных.</p>
            <div className="lc-system-grid"><div><small>Роль</small><b>{state.user.role}</b></div><div><small>Двухфакторная аутентификация</small><b className={state.user.two_factor_enabled ? "is-ok" : "is-warn"}>{state.user.two_factor_enabled ? "Включена" : "Требуется"}</b></div></div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function DashboardHeader({ firstName }: { firstName: string }) {
  return (
    <header className="lc-page-hero lc-dashboard-hero">
      <div>
        <div className="lc-breadcrumbs"><span>Лингво Коннект</span><i>/</i><strong>Обзор</strong></div>
        <h1>Добро пожаловать, {firstName}!</h1>
        <p>Заказы, сроки, финансы и команда — вся ключевая информация на одной странице.</p>
      </div>
      <div className="lc-hero-banner"><span>Слова соединяют мир.</span><div className="lc-translation-art" aria-hidden="true"><i className="lc-translation-art__line"/><b>文</b><b>A</b><i className="lc-translation-art__page"/></div></div>
    </header>
  );
}

function FinanceCell({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong><i className="lc-finance-bars" aria-hidden="true"><b /><b /><b /><b /></i></div>;
}

function ErrorStateOrNothing({ error }: { error: string }) {
  return error ? <ErrorState message={error} /> : null;
}
