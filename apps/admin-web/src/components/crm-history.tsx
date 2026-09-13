"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatActivityDate, operationalActivityLabel } from "@/lib/activity-labels";
import { Button, ErrorState } from "./ui";

type Item = {
  id: string;
  number?: string;
  title?: string;
  name?: string;
  work_type?: string;
  order_id?: string;
  action?: string;
  created_at?: string;
};

export function CrmHistory({ id, executor }: { id: string; executor: boolean }) {
  return <section className="crm-related crm-history">
    <h3>Связанные записи и история</h3>
    <HistoryList title={executor ? "Работы исполнителя" : "Заказы клиента"} path={executor ? `/api/admin/executors/${id}/works` : `/api/admin/orders?client_id=${id}`} kind={executor ? "works" : "orders"} />
    {!executor && <HistoryList title="Заявки" path={`/api/admin/companies/${id}/applications`} kind="applications" />}
    <HistoryList title="История изменений" path={`/api/admin/${executor ? "executors" : "companies"}/${id}/activity`} kind="activity" />
  </section>;
}

function HistoryList({ title, path, kind }: { title: string; path: string; kind: string }) {
  const [data, setData] = useState<{ items: Item[]; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Item[]; pages: number }>(`${path}${path.includes("?") ? "&" : "?"}page=${page}`, { signal: controller.signal })
      .then((next) => { setData(next); setError(""); })
      .catch((nextError) => { if (!controller.signal.aborted) setError(nextError.message); });
    return () => controller.abort();
  }, [path, page]);

  return <section className="crm-history__group">
    <div className="crm-history__title"><h4>{title}</h4>{data && <span>{data.items.length}</span>}</div>
    {error && <ErrorState message={error} />}

    {kind === "activity" ? (
      data?.items.length ? <ol className="activity-list crm-history__timeline">
        {data.items.map((item) => <li key={item.id}>
          <span aria-hidden="true" />
          <div><strong>{operationalActivityLabel(item.action)}</strong><small>{formatActivityDate(item.created_at)}</small></div>
        </li>)}
      </ol> : data && <p className="context-note">Событий пока нет.</p>
    ) : (
      <div className="crm-history__links">
        {data?.items.map((item) => <Link key={item.id} className="crm-history__link" href={kind === "applications" ? `/admin/applications/${item.id}` : `/admin/orders?open=${item.order_id ?? item.id}`}>
          <span>{item.number ?? item.work_type ?? "Запись"}</span>
          <strong>{item.title ?? item.name ?? "Без названия"}</strong>
          <i aria-hidden="true">→</i>
        </Link>)}
        {data?.items.length === 0 && <p className="context-note">Записей пока нет.</p>}
      </div>
    )}

    {data && data.pages > 1 && <div className="pagination pagination--compact">
      <Button variant="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Button>
      <span>{page} / {data.pages}</span>
      <Button variant="quiet" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</Button>
    </div>}
  </section>;
}
