"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card, ErrorState, LoadingState } from "@/components/ui";
import { api } from "@/lib/api";

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
const rub = (v: string | number) =>
  `${Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
export default function DashboardPage() {
  const { state } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setSummary(await api<Summary>("/api/admin/crm/dashboard"));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить CRM-обзор",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!state) return null;
  const firstName = state.user.display_name.split(" ")[0];
  return (
    <>
      <header className="page-head">
        <div>
          <span className="overline overline--accent">WORKSPACE / 01</span>
          <h1>Добро пожаловать, {firstName}</h1>
          <p>Заказы, сроки, деньги и входящие заявки — одна рабочая картина.</p>
        </div>
        <div className="page-head__meta">
          <span>Уровень доступа</span>
          <Badge tone={state.user.role === "ADMIN" ? "accent" : "neutral"}>
            {state.user.role}
          </Badge>
        </div>
      </header>
      {error && <ErrorState message={error} />}{" "}
      {!summary ? (
        <LoadingState label="Собираем CRM-показатели" />
      ) : (
        <>
          <section className="metric-strip crm-metric-strip">
            <Link href="/admin/applications?status_code=NEW">
              <span>01</span>
              <strong>{summary.new_leads}</strong>
              <p>Новые заявки</p>
              <i>→</i>
            </Link>
            <Link href="/admin/orders">
              <span>02</span>
              <strong>{summary.active_orders}</strong>
              <p>Активные заказы</p>
              <i>→</i>
            </Link>
            <Link href="/admin/orders">
              <span>03</span>
              <strong>{summary.due_today}</strong>
              <p>Сдать сегодня</p>
              <i>→</i>
            </Link>
            <Link href="/admin/orders">
              <span>04</span>
              <strong>{summary.overdue}</strong>
              <p>Просрочено</p>
              <i>→</i>
            </Link>
            <Link href="/admin/orders">
              <span>05</span>
              <strong>{summary.unassigned}</strong>
              <p>Без исполнителя</p>
              <i>→</i>
            </Link>
            <Link href="/admin/orders">
              <span>06</span>
              <strong>{summary.awaiting_payment}</strong>
              <p>Ждут оплаты</p>
              <i>→</i>
            </Link>
          </section>
          <section className="dashboard-finance">
            <div>
              <span>Выручка по заказам</span>
              <strong>{rub(summary.revenue)}</strong>
            </div>
            <div>
              <span>Расходы на исполнителей</span>
              <strong>{rub(summary.executor_cost)}</strong>
            </div>
            <div>
              <span>Расчётная прибыль</span>
              <strong>{rub(summary.profit)}</strong>
            </div>
          </section>
          <div className="dashboard-grid dashboard-grid--phase2">
            <Card className="recent-card">
              <div className="card-head">
                <span className="overline">Последние заказы</span>
                <Link href="/admin/orders" className="inline-link">
                  Открыть все →
                </Link>
              </div>
              <div className="recent-list">
                {summary.recent_orders.map((o) => (
                  <Link href={`/admin/orders?open=${o.id}`} key={o.id}>
                    <span>{o.number}</span>
                    <div>
                      <strong>{o.title || "Заказ без названия"}</strong>
                      <small>
                        {o.deadline ? `Срок ${o.deadline}` : "Без общего срока"}
                      </small>
                    </div>
                    <Badge>
                      {(
                        {
                          NEW: "Новый",
                          ESTIMATING: "В расчёте",
                          APPROVED: "Согласован",
                          IN_PROGRESS: "В работе",
                          REVIEW: "На проверке",
                          READY: "Готов",
                          DELIVERED: "Выдан",
                          COMPLETED: "Завершён",
                          CANCELLED: "Отменён",
                        } as Record<string, string>
                      )[o.status] || o.status}
                    </Badge>
                    <i>→</i>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="security-card">
              <div className="card-head">
                <span className="overline">Контроль работы</span>
                <Badge tone={summary.overdue ? "warning" : "success"}>
                  {summary.overdue
                    ? `${summary.overdue} просроч.`
                    : "Сроки в порядке"}
                </Badge>
              </div>
              <h2>{state.user.display_name}</h2>
              <p className="security-copy">
                Сервер считает финансовые показатели и сохраняет историю
                операций.
              </p>
              <div className="security-rows security-rows--stack">
                <div>
                  <span>Роль</span>
                  <strong>{state.user.role}</strong>
                </div>
                <div>
                  <span>2FA</span>
                  <strong>
                    {state.user.two_factor_enabled ? "Включена" : "Требуется"}
                  </strong>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
