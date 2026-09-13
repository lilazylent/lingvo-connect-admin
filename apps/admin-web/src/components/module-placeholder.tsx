import Link from "next/link";
import { EmptyState } from "@/components/ui";

export function ModulePlaceholder({ index, title, description, phase = "следующей фазе" }: { index: string; title: string; description: string; phase?: string }) {
  return <><header className="page-head"><div><span className="overline overline--accent">MODULE / {index}</span><h1>{title}</h1><p>{description}</p></div></header><section className="placeholder-surface"><EmptyState title="Модуль запланирован" text={`Реализация появится в ${phase}. Здесь нет фиктивных клиентов, заказов или показателей.`} /><Link className="text-link" href="/admin">← Вернуться к обзору</Link></section></>;
}
