"use client";

import Link from "next/link";
import { ApplicationLinks } from "@/components/crm-application-links";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Badge, Button, EmptyState, ErrorState, FilePicker, Input, LoadingState, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, apiDownloadUrl, ApiError } from "@/lib/api";
import { formatBytes, formatDate, serviceLabel, serviceOptions, sourceLabels, statusMeta, statusOptions } from "@/lib/applications";
import { applicationActivityLabel } from "@/lib/activity-labels";
import type { ApplicationDetail, ApplicationStatus, UserSummary } from "@/lib/types";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();
  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [uploadDraft, setUploadDraft] = useState<File | null>(null);
  const [fields, setFields] = useState({ name: "", contact_method: "email", contact: "", requested_service: "not_sure", message: "", company: "", source_language: "", target_language: "", desired_date: "", internal_summary: "", responsible_user_id: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [application, users] = await Promise.all([
        api<ApplicationDetail>(`/api/admin/applications/${id}`),
        api<UserSummary[]>("/api/admin/applications/managers"),
      ]);
      setItem(application); setManagers(users);
      setFields({
        name: application.name ?? "", contact_method: application.contact_method ?? "email",
        contact: application.contact ?? "", requested_service: application.requested_service ?? "not_sure",
        message: application.message ?? "", company: application.company ?? "", source_language: application.source_language ?? "",
        target_language: application.target_language ?? "", desired_date: application.desired_date ?? "",
        internal_summary: application.internal_summary ?? "", responsible_user_id: application.responsible_manager?.id ?? "",
      });
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить заявку"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    // Detail API is the source of truth for all operational panels.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function changeStatus(status_code: ApplicationStatus) {
    if (!item) return; setSaving(true);
    try { setItem(await api<ApplicationDetail>(`/api/admin/applications/${id}/status`, { method: "POST", body: JSON.stringify({ status_code }) })); notify("Статус заявки изменён"); }
    catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось изменить статус"); }
    finally { setSaving(false); }
  }

  async function saveOverview(event: FormEvent) {
    event.preventDefault(); if (!item) return; setSaving(true); setError("");
    try {
      const updated = await api<ApplicationDetail>(`/api/admin/applications/${id}`, { method: "PATCH", body: JSON.stringify({
        ...fields, company: fields.company || null, source_language: fields.source_language || null,
        target_language: fields.target_language || null, desired_date: fields.desired_date || null,
        internal_summary: fields.internal_summary || null, responsible_user_id: fields.responsible_user_id || null,
        version: item.version,
      }) });
      setItem(updated); notify("Изменения сохранены");
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось сохранить изменения"); }
    finally { setSaving(false); }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault(); if (!comment.trim()) return; setSaving(true);
    try { await api(`/api/admin/applications/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); setItem(await api<ApplicationDetail>(`/api/admin/applications/${id}`)); notify("Комментарий добавлен"); }
    catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось добавить комментарий"); }
    finally { setSaving(false); }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadDraft) return;
    setSaving(true);
    const body = new FormData();
    body.append("upload", uploadDraft);
    try {
      await api(`/api/admin/applications/${id}/files`, { method: "POST", body });
      setUploadDraft(null);
      setItem(await api<ApplicationDetail>(`/api/admin/applications/${id}`));
      notify("Файл загружен");
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить файл"); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingState label="Загружаем рабочую карточку" />;
  if (!item) return <ErrorState message={error || "Заявка не найдена"} />;
  const status = statusMeta(item.status_code);
  const dirty = fields.name !== (item.name ?? "") || fields.contact_method !== (item.contact_method ?? "email")
    || fields.contact !== (item.contact ?? "") || fields.requested_service !== (item.requested_service ?? "not_sure")
    || fields.message !== (item.message ?? "") || fields.company !== (item.company ?? "")
    || fields.source_language !== (item.source_language ?? "") || fields.target_language !== (item.target_language ?? "")
    || fields.desired_date !== (item.desired_date ?? "") || fields.internal_summary !== (item.internal_summary ?? "")
    || fields.responsible_user_id !== (item.responsible_manager?.id ?? "");
  return <>
    <header className="detail-head"><div><Link href="/admin/applications" className="detail-back">← Все заявки</Link><span className="overline overline--accent">Входящее обращение · {sourceLabels[item.source]}</span><h1>Заявка {item.number}</h1><p>{serviceLabel(item.requested_service)} · {formatDate(item.submitted_at)}</p><ApplicationLinks id={item.id}/></div><div className="detail-head__controls"><Badge tone={status.tone}>{status.label}</Badge><Select label="Статус заявки" hint="Сохраняется сразу после выбора" value={item.status_code} disabled={saving} onChange={(event) => void changeStatus(event.target.value as ApplicationStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div></header>
    {error && <ErrorState message={error} />}
    <nav className="detail-sections" aria-label="Разделы заявки"><a href="#request">01 <span>Обращение</span></a><a href="#processing">02 <span>Рабочие данные</span></a><a href="#collaboration">03 <span>Комментарии и файлы</span></a></nav>

    <div className="detail-overview" id="request">
      <section className="detail-panel detail-panel--contact"><div className="panel-title"><div><h2>Кто обратился</h2><p>{item.source === "website" ? "Контакт получен из формы на сайте" : "Обращение зарегистрировано сотрудником"}</p></div></div><div className="contact-identity"><span aria-hidden="true">{(item.name || "?").slice(0, 1).toUpperCase()}</span><div><h3>{item.name || "Контакт не указан"}</h3><p>{item.company || "Компания не указана"}</p></div></div><dl className="data-list"><div><dt>Связаться</dt><dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email} ↗</a> : item.phone ? <a href={`tel:${item.phone}`}>{item.phone} ↗</a> : item.contact || "Контакт не указан"}</dd></div><div><dt>Источник</dt><dd>{sourceLabels[item.source]}</dd></div></dl><p className="context-note">Это контакт по заявке, а не отдельная карточка клиента. Компания указывается менеджером в рабочих данных ниже.</p></section>
      <section className="detail-panel detail-panel--request"><div className="panel-title"><div><h2>Исходный запрос</h2><p>Сообщение сохранено в том виде, в котором поступило</p></div></div><p className="request-message">{item.message || "Описание пока не заполнено."}</p><dl className="data-list data-list--inline"><div><dt>Услуга</dt><dd>{serviceLabel(item.requested_service)}</dd></div><div><dt>Языки</dt><dd>{[item.source_language, item.target_language].filter(Boolean).join(" → ") || "Нужно уточнить"}</dd></div><div><dt>Желаемая дата</dt><dd>{item.desired_date ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(`${item.desired_date}T00:00:00`)) : "Нужно уточнить"}</dd></div></dl></section>
    </div>

    <form id="processing" className="detail-panel operational-form" onSubmit={saveOverview}>
      <div className="panel-title"><span>02</span><div><h2>Рабочие данные</h2><p>Дополните после разговора с заказчиком, затем сохраните изменения.</p></div></div>
      <fieldset disabled={saving} className="operational-fields"><legend className="sr-only">Редактирование заявки</legend>
        <div className="operational-group"><div><h3>Контакт и обращение</h3><p>Любое поле можно оставить пустым и заполнить после уточнения.</p></div><div className="operational-group__fields">
          <Input label="Имя контакта" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} />
          <Select label="Способ связи" value={fields.contact_method} onChange={(event) => setFields((current) => ({ ...current, contact_method: event.target.value }))}><option value="email">Email</option><option value="phone">Телефон</option><option value="messenger">Мессенджер</option></Select>
          <Input label="Контакт" hint="Email, телефон или мессенджер" value={fields.contact} onChange={(event) => setFields((current) => ({ ...current, contact: event.target.value }))} />
          <Input label="Компания по заявке" value={fields.company} onChange={(event) => setFields((current) => ({ ...current, company: event.target.value }))} />
          <Select label="Ответственный менеджер" value={fields.responsible_user_id} onChange={(event) => setFields((current) => ({ ...current, responsible_user_id: event.target.value }))}><option value="">Не назначен</option>{managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.display_name}</option>)}</Select>
        </div></div>
        <div className="operational-group"><div><h3>Что нужно сделать</h3><p>Услугу, языки и дату можно уточнить в любой момент.</p></div><div className="operational-group__fields">
          <Select label="Услуга" value={fields.requested_service} onChange={(event) => setFields((current) => ({ ...current, requested_service: event.target.value }))}>{serviceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select>
          <Input label="Язык оригинала" value={fields.source_language} onChange={(event) => setFields((current) => ({ ...current, source_language: event.target.value }))} />
          <Input label="Язык перевода" value={fields.target_language} onChange={(event) => setFields((current) => ({ ...current, target_language: event.target.value }))} />
          <Input label="Желаемая дата" type="date" value={fields.desired_date} onChange={(event) => setFields((current) => ({ ...current, desired_date: event.target.value }))} />
          <div className="operational-span"><Textarea label="Описание задачи" rows={3} value={fields.message} onChange={(event) => setFields((current) => ({ ...current, message: event.target.value }))} /></div>
        </div></div>
        <div className="operational-group"><div><h3>Внутренняя заметка</h3><p>Краткое резюме и следующий шаг для сотрудников.</p></div><Textarea label="Внутреннее резюме" rows={3} placeholder="Что уточнили и о чём договорились" value={fields.internal_summary} onChange={(event) => setFields((current) => ({ ...current, internal_summary: event.target.value }))} /></div>
      </fieldset>
      <div className="panel-actions"><span role="status">{dirty ? "Есть несохранённые изменения" : "Все рабочие данные сохранены"}</span><Button type="submit" disabled={saving || !dirty}>{saving ? "Сохраняем…" : "Сохранить изменения →"}</Button></div>
    </form>

    <div className="collaboration-grid" id="collaboration">
      <section className="detail-panel"><div className="panel-title"><span>04</span><h2>Комментарии</h2></div><form className="comment-form" onSubmit={addComment}><Textarea label="Новый комментарий" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Только для сотрудников" /><Button type="submit" disabled={saving || !comment.trim()}>Добавить</Button></form>{item.comments.length ? <div className="comment-list">{item.comments.map((entry) => <article key={entry.id}><header><strong>{entry.author.display_name}</strong><time>{formatDate(entry.created_at)}</time></header><p>{entry.body}</p>{entry.edited_at && <small>изменено</small>}</article>)}</div> : <EmptyState title="Комментариев пока нет" text="Зафиксируйте договорённость или следующий шаг." />}</section>
      <section className="detail-panel"><div className="panel-title"><span>05</span><h2>Файлы</h2></div><form className="file-upload file-upload--custom" onSubmit={uploadFile}><FilePicker label="Выбрать файл" hint="PDF, DOCX, XLSX, PPTX, TXT, RTF, PNG, JPG · до 15 МБ" accept=".pdf,.docx,.xlsx,.pptx,.txt,.rtf,.png,.jpg,.jpeg" file={uploadDraft} disabled={saving} onChange={setUploadDraft} onClear={()=>setUploadDraft(null)}/><Button type="submit" variant="secondary" disabled={saving || !uploadDraft}>{saving ? "Загружаем…" : "Загрузить"}</Button></form>{item.files.length ? <div className="file-list">{item.files.map((file) => <a key={file.id} href={apiDownloadUrl(`/api/admin/applications/${id}/files/${file.id}/download`)}><span className="file-mark">DOC</span><span><strong>{file.original_name}</strong><small>{formatBytes(file.size_bytes)} · {file.uploader?.display_name ?? "Прикрепил клиент на сайте"}</small></span><i>Скачать ↓</i></a>)}</div> : <EmptyState title="Файлов пока нет" text="Добавьте исходный материал или техническое задание." />}</section>
      <section className="detail-panel activity-panel"><div className="panel-title"><span>06</span><h2>История</h2></div>{item.activity.length ? <ol className="activity-list">{item.activity.map((event) => <li key={event.id}><span /><div><strong>{applicationActivityLabel(event.event_type)}</strong><small>{event.actor?.display_name ?? "Сайт / система"} · {formatDate(event.created_at)}</small></div></li>)}</ol> : <EmptyState title="История пуста" text="События появятся после изменений заявки." />}</section>
    </div>
  </>;
}
