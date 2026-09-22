"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, apiDownloadUrl } from "@/lib/api";
import {
  Button,
  EmptyState,
  ErrorState,
  FilePicker,
  Input,
  LoadingState,
  Select,
} from "./ui";
import { Icon } from "./icons";

type FileSource = "all" | "order" | "application";
type UploadSource = Exclude<FileSource, "all">;
type FileKind = "all" | "pdf" | "document" | "spreadsheet" | "presentation" | "image" | "other";

type FileRegistryItem = {
  id: string;
  source: UploadSource;
  entity_id: string;
  entity_number: string;
  entity_title: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  character_count: number | null;
  word_count: number | null;
  analysis_status: string;
  analysis_note: string;
  uploaded_at: string;
  extension: string;
  download_path: string;
  preview_path: string;
  entity_path: string;
};

type FileRegistryPage = {
  items: FileRegistryItem[];
  total: number;
  total_bytes: number;
  order_files: number;
  application_files: number;
  page: number;
  pages: number;
};

type UploadTarget = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
};

const kindLabels: Record<FileKind, string> = {
  all: "Все типы",
  pdf: "PDF",
  document: "Документы",
  spreadsheet: "Таблицы",
  presentation: "Презентации",
  image: "Изображения",
  other: "Другие",
};

export function CrmFiles() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<FileSource>("all");
  const [kind, setKind] = useState<FileKind>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FileRegistryPage | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const [selected, setSelected] = useState<FileRegistryItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(draftQuery.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (source !== "all") params.set("source", source);
    if (kind !== "all") params.set("kind", kind);
    return params;
  }, [query, source, kind]);

  const request = useMemo(() => {
    const params = new URLSearchParams(search);
    params.set("page", String(page));
    const queryString = params.toString();
    return {
      key: `${queryString}|${refresh}`,
      path: `/api/admin/files?${queryString}`,
    };
  }, [page, refresh, search]);

  const loading = loadedRequestKey !== request.key;
  const error = loadError?.key === request.key ? loadError.message : "";

  useEffect(() => {
    const controller = new AbortController();
    const requestKey = request.key;

    void api<FileRegistryPage>(request.path, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoadError(null);
        setLoadedRequestKey(requestKey);
        setSelected((current) => current ? next.items.find((item) => item.id === current.id && item.source === current.source) ?? null : null);
      })
      .catch((nextError) => {
        if (controller.signal.aborted) return;
        setLoadError({
          key: requestKey,
          message: nextError instanceof Error ? nextError.message : "Не удалось загрузить файлы",
        });
        setLoadedRequestKey(requestKey);
      });

    return () => controller.abort();
  }, [request]);

  const exportSuffix = search.toString() ? `?${search.toString()}` : "";
  const panelOpen = Boolean(selected || uploadOpen);

  return (
    <section className="files-workspace phase6-files">
      <header className="page-head page-head--compact files-head">
        <div>
          <span className="overline overline--accent">Лингво Коннект / Файлы</span>
          <h1>Файлы</h1>
          <p>Рабочий реестр документов из заявок и заказов: загрузка, поиск, анализ, скачивание и переход к источнику.</p>
        </div>
        <div className="files-head__actions" aria-label="Действия с файлами">
          <a className="button button--secondary" href={apiDownloadUrl(`/api/admin/files/export.csv${exportSuffix}`)}>CSV</a>
          <a className="button button--secondary" href={apiDownloadUrl(`/api/admin/files/export.xlsx${exportSuffix}`)}>XLSX</a>
          <Button onClick={() => { setSelected(null); setUploadOpen(true); }}><Icon name="upload" size={17}/> Загрузить файл</Button>
        </div>
      </header>

      <section className="files-summary" aria-label="Сводка по файлам">
        <article className="files-summary__primary">
          <span>Всего документов</span>
          <strong>{data?.total ?? "—"}</strong>
          <small>{data ? formatFileSize(data.total_bytes) : "Загрузка объёма…"}</small>
        </article>
        <article>
          <span>В заказах</span>
          <strong>{data?.order_files ?? "—"}</strong>
          <small>Рабочие документы и результаты</small>
        </article>
        <article>
          <span>В заявках</span>
          <strong>{data?.application_files ?? "—"}</strong>
          <small>Исходники до создания заказа</small>
        </article>
        <article>
          <span>Текущий фильтр</span>
          <strong>{kind === "all" ? "Все" : kindLabels[kind]}</strong>
          <small>{sourceLabel(source)}</small>
        </article>
      </section>

      <section className="files-toolbar" aria-label="Фильтры файлов">
        <div className="files-toolbar__search">
          <Input
            label="Поиск"
            placeholder="Файл, номер заказа или заявки, название…"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
          />
        </div>
        <Select
          label="Источник"
          hideLabel
          value={source}
          onChange={(selection) => { setSource(selection.target.value as FileSource); setPage(1); }}
        >
          <option value="all">Все источники</option>
          <option value="order">Заказы</option>
          <option value="application">Заявки</option>
        </Select>
        <Select
          label="Тип файла"
          hideLabel
          value={kind}
          onChange={(selection) => { setKind(selection.target.value as FileKind); setPage(1); }}
        >
          {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {(query || source !== "all" || kind !== "all") && (
          <Button
            variant="quiet"
            className="files-toolbar__reset"
            onClick={() => { setDraftQuery(""); setQuery(""); setSource("all"); setKind("all"); setPage(1); }}
          >
            Сбросить
          </Button>
        )}
      </section>

      {error && <ErrorState message={error} />}
      {loading && !data ? <LoadingState label="Загружаем реестр файлов" /> : null}

      {data && data.items.length ? (
        <div className={`lc-split-workspace phase6-files-workspace ${panelOpen ? "has-selection" : ""}`}>
          <section className="files-table-surface">
            <div className="files-table-head" aria-hidden="true">
              <span>Документ</span>
              <span>Источник</span>
              <span>Размер</span>
              <span>Метрики</span>
              <span>Загружен</span>
              <span />
            </div>
            <div className="files-list">
              {data.items.map((item) => <FileRow
                key={`${item.source}-${item.id}`}
                item={item}
                selected={selected?.id === item.id && selected.source === item.source}
                onSelect={() => { setSelected(item); setUploadOpen(false); }}
              />)}
            </div>
          </section>
          {uploadOpen ? <FileUploadPanel
            onClose={() => setUploadOpen(false)}
            onUploaded={() => { setUploadOpen(false); setRefresh((value) => value + 1); }}
          /> : selected ? <FilePreview item={selected} onClose={() => setSelected(null)} /> : null}
        </div>
      ) : data && !loading ? (
        <div className={`phase6-empty-workspace ${uploadOpen ? "has-panel" : ""}`}>
          <EmptyState title="Файлы не найдены" text="Измените фильтр или загрузите документ в заявку или заказ." />
          {uploadOpen && <FileUploadPanel onClose={() => setUploadOpen(false)} onUploaded={() => { setUploadOpen(false); setRefresh((value) => value + 1); }} />}
        </div>
      ) : null}

      {data && data.pages > 1 && (
        <div className="pagination files-pagination">
          <Button variant="quiet" disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Назад</Button>
          <span>Страница {data.page} из {data.pages}</span>
          <Button variant="quiet" disabled={page >= data.pages || loading} onClick={() => setPage((current) => current + 1)}>Дальше →</Button>
        </div>
      )}
    </section>
  );
}

function FileRow({ item, selected, onSelect }: { item: FileRegistryItem; selected: boolean; onSelect: () => void }) {
  const metric = item.page_count != null
    ? `${item.page_count} стр.`
    : item.character_count != null
      ? `${item.character_count.toLocaleString("ru-RU")} зн.`
      : item.word_count != null
        ? `${item.word_count.toLocaleString("ru-RU")} слов`
        : "—";
  return (
    <article className={`files-row ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      <div className="files-row__file">
        <span className="files-row__mark" aria-hidden="true">{(item.extension || "FILE").slice(0, 4).toUpperCase()}</span>
        <div title={item.original_name}>
          <strong>{item.original_name}</strong>
          <small>{item.mime_type || "Тип не определён"}</small>
        </div>
      </div>
      <div className="files-row__source">
        <span className={`files-source files-source--${item.source}`}>{item.source === "order" ? "Заказ" : "Заявка"}</span>
        <Link href={item.entity_path} onClick={(event) => event.stopPropagation()}>
          <strong>{item.entity_number || "Без номера"}</strong>
          <small>{item.entity_title || "Без названия"}</small>
        </Link>
      </div>
      <div className="files-row__value" data-label="Размер">
        <strong>{formatFileSize(item.size_bytes)}</strong>
        <small>{item.extension ? item.extension.toUpperCase() : "FILE"}</small>
      </div>
      <div className="files-row__value" data-label="Метрики">
        <strong>{metric}</strong>
        <small>{analysisLabel(item.analysis_status)}</small>
      </div>
      <div className="files-row__value" data-label="Загружен">
        <strong>{formatDate(item.uploaded_at)}</strong>
        <small>{formatTime(item.uploaded_at)}</small>
      </div>
      <a className="files-row__download" href={apiDownloadUrl(item.download_path)} onClick={(event) => event.stopPropagation()} aria-label={`Скачать ${item.original_name}`}>
        <Icon name="download" size={16}/><span>Скачать</span>
      </a>
    </article>
  );
}

function FilePreview({ item, onClose }: { item: FileRegistryItem; onClose: () => void }) {
  return <aside className="lc-detail-panel lc-file-preview phase6-file-preview">
    <header><div><span>{item.source === "order" ? "Файл заказа" : "Файл заявки"}</span><h2 title={item.original_name}>{item.original_name}</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={18} /></button></header>
    <section className="phase6-file-preview__identity"><div className="lc-file-preview__mark">{(item.extension || "FILE").slice(0,4).toUpperCase()}</div><div className="lc-file-preview__summary"><strong>{formatFileSize(item.size_bytes)}</strong><span>{item.mime_type || "Тип не определён"}</span><small>Загружен {formatDate(item.uploaded_at)} в {formatTime(item.uploaded_at)}</small></div></section>
    <section className="lc-detail-data"><div><span>Источник</span><strong>{item.source === "order" ? "Заказ" : "Заявка"}</strong></div><div><span>Номер</span><strong>{item.entity_number || "—"}</strong></div><div><span>Страницы</span><strong>{item.page_count ?? "—"}</strong></div><div><span>Знаки</span><strong>{item.character_count?.toLocaleString("ru-RU") ?? "—"}</strong></div><div><span>Слова</span><strong>{item.word_count?.toLocaleString("ru-RU") ?? "—"}</strong></div><div><span>Анализ</span><strong>{analysisLabel(item.analysis_status)}</strong></div></section>
    {item.analysis_note && <section><div className="lc-detail-section-title"><Icon name="document" size={17}/><strong>Примечание анализа</strong></div><p>{item.analysis_note}</p></section>}
    <div className="phase6-detail-actions">
      {item.preview_path && <a className="button button--secondary" href={apiDownloadUrl(item.preview_path)} target="_blank" rel="noreferrer"><Icon name="document" size={16}/> Просмотреть</a>}
      <a className="button button--primary" href={apiDownloadUrl(item.download_path)}><Icon name="download" size={16}/> Скачать</a>
      <Link className="button button--secondary" href={item.entity_path}>Перейти к источнику <Icon name="arrow-right" size={15}/></Link>
    </div>
  </aside>;
}

function FileUploadPanel({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [source, setSource] = useState<UploadSource>("order");
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<UploadTarget[]>([]);
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const search = query.trim();
      const path = source === "order"
        ? `/api/admin/crm/orders?${new URLSearchParams({ q: search, page: "1", page_size: "12" })}`
        : `/api/admin/applications?${new URLSearchParams({ search, page: "1", page_size: "12" })}`;
      void api<{ items: Array<Record<string, unknown>> }>(path, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setTargets(result.items.map((item) => source === "order" ? {
            id: String(item.id ?? ""),
            number: String(item.number ?? ""),
            title: String(item.title ?? "Без названия"),
            subtitle: String(item.client_name ?? "Заказ"),
          } : {
            id: String(item.id ?? ""),
            number: String(item.number ?? ""),
            title: String(item.company || item.name || "Без названия"),
            subtitle: String(item.email || item.contact || "Заявка"),
          }));
          setError("");
        })
        .catch((nextError) => {
          if (!controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "Не удалось найти источник");
        })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, source]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!target || !file) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("upload", file);
    try {
      await api(source === "order" ? `/api/admin/orders/${target.id}/files` : `/api/admin/applications/${target.id}/files`, {
        method: "POST",
        body,
      });
      onUploaded();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  }

  return <aside className="lc-detail-panel phase6-upload-panel" aria-label="Загрузка файла">
    <header><div><span>Новый документ</span><h2>Загрузить файл</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={18}/></button></header>
    <form className="phase6-upload-panel__form" onSubmit={upload}>
      {error && <ErrorState message={error} />}
      <Select label="Куда прикрепить" value={source} onChange={(event) => { setSource(event.target.value as UploadSource); setTarget(null); setQuery(""); }}>
        <option value="order">К заказу</option>
        <option value="application">К заявке</option>
      </Select>
      <Input label="Найти источник" placeholder={source === "order" ? "Номер, название или клиент" : "Номер, имя, компания или контакт"} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="phase6-upload-targets" role="listbox" aria-label={source === "order" ? "Заказы" : "Заявки"}>
        {searching ? <span className="phase6-upload-targets__state">Ищем…</span> : targets.length ? targets.map((item) => <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={target?.id === item.id}
          className={target?.id === item.id ? "is-selected" : ""}
          onClick={() => setTarget(item)}
        ><strong>{item.number || "Без номера"} · {item.title}</strong><small>{item.subtitle}</small></button>) : <span className="phase6-upload-targets__state">Ничего не найдено</span>}
      </div>
      {target && <div className="phase6-upload-selected"><span>Выбрано</span><strong>{target.number || "Без номера"} · {target.title}</strong></div>}
      <FilePicker label="Выбрать документ" hint="Файл будет сохранён в выбранном источнике" file={file} disabled={busy} onChange={setFile} onClear={() => setFile(null)} />
      <div className="phase6-upload-panel__actions"><Button disabled={busy || !target || !file}>{busy ? "Загружаем…" : "Загрузить файл"}</Button><Button type="button" variant="quiet" onClick={onClose} disabled={busy}>Отмена</Button></div>
    </form>
  </aside>;
}

function sourceLabel(source: FileSource) {
  if (source === "order") return "Только заказы";
  if (source === "application") return "Только заявки";
  return "Заказы + заявки";
}

function analysisLabel(status: string) {
  if (status === "OK") return "Проанализирован";
  if (status === "ERROR") return "Ошибка анализа";
  if (status === "PENDING") return "Анализируется";
  return "Без анализа";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024).toLocaleString("ru-RU")} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ГБ`;
}
