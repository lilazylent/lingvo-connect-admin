"use client";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CrmContacts } from "./crm-contacts";
import { workTypes } from "./crm-orders";
import { CrmHistory } from "./crm-history";
import { api } from "@/lib/api";
import { Badge, Button, ErrorState, Input, LoadingState, Select, Textarea } from "./ui";

type Entry = { id: string; name: string; email: string; phone: string; notes: string; archived: boolean; version: number; manager_id?: string|null; kind?: string; tax_id?: string | null; telegram?: string; directions?: {source_language: string; target_language: string; work_type: string}[] };
type PageData = { items: Entry[]; total: number; page: number; pages: number };

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
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await api<PageData>(`${endpoint}?q=${encodeURIComponent(query)}&archived=${archived}&page=${page}&language=${encodeURIComponent(language)}&work_type=${workType}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить справочник"); }
  }, [endpoint, query, archived, page, language, workType]);
  useEffect(() => {
    // External API synchronization, matching the existing applications workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return <>
    <header className="page-head page-head--compact"><div><span className="overline overline--accent">Рабочий справочник / {executor ? "05" : "03"}</span><h1>{executor ? "Исполнители" : "Клиенты"}</h1><p>{executor ? "Переводчики и подрядчики: контакты и рабочие направления." : "Компании и частные заказчики. Постоянный справочник, независимый от входящих заявок."}</p></div><Button onClick={() => { setSelected(null); setEditing(true); }}>{executor ? "Добавить исполнителя" : "Добавить клиента"} +</Button></header>
    {state?.user.role === "ADMIN" && <p><Link className="text-link" href="/admin/imports">Импортировать XLS / XLSX ↗</Link></p>}
    {error && <ErrorState message={error} />}
    <form className={`crm-toolbar ${executor ? "crm-toolbar--executor" : "crm-toolbar--client"}`} onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search); }}><Input label="Поиск" placeholder="Имя, название или email" value={search} onChange={e => setSearch(e.target.value)} /><Button variant="secondary">Найти</Button>{executor&&<><Input label="Язык исполнителя" value={language} onChange={e=>{setLanguage(e.target.value);setPage(1);}}/><Select label="Специализация" value={workType} onChange={e=>{setWorkType(e.target.value);setPage(1);}}><option value="">Все виды работ</option>{workTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></>}<label className="archive-toggle"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setPage(1); }} /><span className="archive-toggle__box" aria-hidden="true" /><span className="archive-toggle__label">Архив</span></label></form>
    {editing && <DirectoryForm key={selected?.id ?? "new"} entry={selected} executor={executor} endpoint={endpoint} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} />}
    {!data ? <LoadingState /> : <section className="table-surface"><div className="table-caption">Всего: {data.total}</div><div className="table-wrap"><table><thead><tr><th>{executor ? "Исполнитель" : "Клиент"}</th><th>Контакты</th><th>{executor ? "Направления" : "Тип"}</th><th>Статус</th></tr></thead><tbody>{data.items.map(entry => <tr key={entry.id} className="clickable-row"><td><button className="crm-record-link" onClick={() => { setSelected(entry); setEditing(true); }}>{entry.name || (executor ? "Исполнитель без имени" : "Клиент без названия")}</button></td><td><span>{entry.email || "—"}</span><span>{entry.phone}</span></td><td>{executor ? entry.directions?.map(d => `${d.source_language} → ${d.target_language}`).join("; ") || "Не указаны" : entry.kind === "individual" ? "Частное лицо" : "Компания"}</td><td><Badge>{entry.archived ? "В архиве" : "Активен"}</Badge></td></tr>)}</tbody></table></div>{!data.items.length && <p className="crm-empty">Нет записей. Добавьте первую или измените поиск.</p>}<div className="pagination"><Button variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</Button><span>{page} / {data.pages}</span><Button variant="quiet" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Далее →</Button></div></section>}
  </>;
}

function DirectoryForm({ entry, executor, endpoint, onClose, onSaved }: { entry: Entry | null; executor: boolean; endpoint: string; onClose: () => void; onSaved: () => void }) {
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
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`${endpoint}${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", body: JSON.stringify({ name, email, phone, notes, ...(entry ? { version: entry.version } : {}), ...(executor ? { telegram, directions: directions.map(({source_language, target_language, work_type}) => ({source_language, target_language, work_type})) ?? [] } : { kind, tax_id: taxId || null, manager_id: entry?.manager_id ?? null }) }) }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  }
  async function archive() { if (!entry) return; setBusy(true); try { await api(`${endpoint}/${entry.id}/archive`, {method:"POST",body:JSON.stringify({version:entry.version,archived:!entry.archived})}); onSaved(); } catch(e) {setError(e instanceof Error ? e.message : "Ошибка сохранения");} finally {setBusy(false);} }
  return <><form className="crm-editor" onSubmit={save}><header className="crm-section-head"><h2>{entry ? (entry.name || (executor ? "Исполнитель без имени" : "Карточка без названия")) : "Новая запись"}</h2><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Закрыть</Button></header>{error && <ErrorState message={error} />}<fieldset disabled={busy || entry?.archived} className="crm-fields"><Input label={executor ? "Имя исполнителя" : "Имя / название"} hint="Можно заполнить позже" value={name} onChange={e => setName(e.target.value)} maxLength={160} /><Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} /><Input label="Телефон" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} />{!executor && <><Select label="Тип клиента" value={kind} onChange={e => setKind(e.target.value)}><option value="company">Компания</option><option value="individual">Частное лицо</option></Select><Input label="ИНН (необязательно)" value={taxId} onChange={e => setTaxId(e.target.value)} maxLength={12} /></>}<Textarea label="Внутренний комментарий" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} /></fieldset>{executor && <section><Input label="Telegram / другой контакт" value={telegram} disabled={busy||entry?.archived} onChange={e=>setTelegram(e.target.value)}/><h3>Направления и виды работ</h3>{directions.map((d,i)=><div className="crm-direction" key={i}><Input label={`Исходный язык ${i+1}`} value={d.source_language} disabled={busy||entry?.archived} onChange={e=>setDirections(directions.map((x,n)=>n===i?{...x,source_language:e.target.value}:x))}/><Input label={`Язык перевода ${i+1}`} value={d.target_language} disabled={busy||entry?.archived} onChange={e=>setDirections(directions.map((x,n)=>n===i?{...x,target_language:e.target.value}:x))}/><Select label={`Вид работы ${i+1}`} value={d.work_type} disabled={busy||entry?.archived} onChange={e=>setDirections(directions.map((x,n)=>n===i?{...x,work_type:e.target.value}:x))}>{workTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select><Button type="button" variant="quiet" disabled={busy||entry?.archived} onClick={()=>setDirections(directions.filter((_,n)=>n!==i))}>Убрать</Button></div>)}<Button type="button" variant="secondary" disabled={busy||entry?.archived} onClick={()=>setDirections([...directions,{source_language:"",target_language:"",work_type:"written_translation"}])}>Добавить направление</Button></section>}<div className="form-actions"><Button disabled={busy || entry?.archived}>{busy ? "Сохраняем…" : "Сохранить"}</Button>{entry && <Button type="button" variant="quiet" disabled={busy} onClick={archive}>{entry.archived ? "Восстановить" : "В архив"}</Button>}<Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Отмена</Button></div></form>{entry&&!executor&&<CrmContacts clientId={entry.id} disabled={entry.archived}/>} {entry&&<DirectorySummary id={entry.id} executor={executor}/>} {entry&&<CrmHistory id={entry.id} executor={executor}/>}</>;
}


function DirectorySummary({id,executor}:{id:string;executor:boolean}) {
  type OrderRow={id:string;number:string;title:string;status:string;deadline:string|null};
  type ClientSummary={order_count:number;active_orders:number;revenue:string|number;debt:string|number;last_order:OrderRow|null;orders:OrderRow[]};
  type ExecutorSummary={active_works:number;completed_works:number;amount_due:string|number;amount_paid:string|number;owed:string|number;works:{id:string;order_id:string;service_code:string;status:string;deadline:string|null}[]};
  const [data,setData]=useState<ClientSummary|ExecutorSummary|null>(null);
  useEffect(()=>{let live=true;api<ClientSummary|ExecutorSummary>(`/api/admin/crm/${executor?"executors":"clients"}/${id}/summary`).then(result=>{if(live)setData(result);}).catch(()=>{});return()=>{live=false;};},[id,executor]);
  const rub=(value:string|number)=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(value||0));
  if(!data)return null;
  if(executor){const value=data as ExecutorSummary;return <section className="directory-summary"><header><span className="overline">CRM-показатели</span><h3>Работа с исполнителем</h3></header><div className="directory-summary__metrics"><div><span>Активные работы</span><strong>{value.active_works}</strong></div><div><span>Завершено</span><strong>{value.completed_works}</strong></div><div><span>Начислено</span><strong>{rub(value.amount_due)}</strong></div><div><span>Выплачено</span><strong>{rub(value.amount_paid)}</strong></div><div><span>К выплате</span><strong>{rub(value.owed)}</strong></div></div><div className="directory-summary__orders">{value.works.slice(0,6).map(work=><Link key={work.id} href={`/admin/orders?open=${work.order_id}`}><span>{work.service_code}</span><strong>{work.status}</strong><small>{work.deadline||"Без срока"}</small></Link>)}</div></section>}
  const value=data as ClientSummary;return <section className="directory-summary"><header><span className="overline">CRM-показатели</span><h3>История заказчика</h3></header><div className="directory-summary__metrics"><div><span>Всего заказов</span><strong>{value.order_count}</strong></div><div><span>Активные</span><strong>{value.active_orders}</strong></div><div><span>Выручка</span><strong>{rub(value.revenue)}</strong></div><div><span>Задолженность</span><strong>{rub(value.debt)}</strong></div></div><div className="directory-summary__orders">{value.orders.slice(0,6).map(order=><Link key={order.id} href={`/admin/orders?open=${order.id}`}><span>{order.number}</span><strong>{order.title || "Заказ без названия"}</strong><small>{order.deadline||"Без срока"}</small></Link>)}{!value.orders.length&&<p className="crm-empty">Заказов у клиента ещё нет.</p>}</div></section>;
}
