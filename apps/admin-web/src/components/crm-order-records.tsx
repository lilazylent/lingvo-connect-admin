"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, apiDownloadUrl } from "@/lib/api";
import { formatActivityDate, operationalActivityLabel } from "@/lib/activity-labels";
import { Button, ErrorState, FilePicker } from "./ui";

type FileItem = { id: string; original_name: string; size_bytes: number };
type EventItem = { id: string; action: string; created_at: string };

export function OrderRecords({ id, disabled }: { id: string; disabled: boolean }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filePage, setFilePage] = useState(1);
  const [filePages, setFilePages] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [fileData, eventData] = await Promise.all([
        api<{ items: FileItem[]; pages: number }>(`/api/admin/orders/${id}/files?page=${filePage}`),
        api<{ items: EventItem[]; pages: number }>(`/api/admin/orders/${id}/activity?page=${page}`),
      ]);
      setFiles(fileData.items);
      setFilePages(fileData.pages);
      setEvents(eventData.items);
      setPages(eventData.pages);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить историю");
    }
  }, [id, page, filePage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("upload", file);
      await api(`/api/admin/orders/${id}/files`, { method: "POST", body: form });
      setFile(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  return <section className="order-records">
    {error && <ErrorState message={error} />}

    <section className="order-records__section">
      <div className="order-records__heading">
        <div>
          <span className="overline">Файлы заказа</span>
          <h3>Вложения</h3>
        </div>
        <span className="order-records__count">{files.length}</span>
      </div>

      <form className="order-upload-form" onSubmit={upload}>
        <FilePicker
          label="Выбрать файл"
          hint="PDF, документы и изображения · до 15 МБ"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.png,.jpg,.jpeg"
          file={file}
          disabled={disabled || busy}
          onChange={setFile}
          onClear={() => setFile(null)}
        />
        <Button className="order-upload-form__submit" disabled={disabled || busy || !file}>
          {busy ? "Загружаем…" : "Прикрепить"}
        </Button>
      </form>

      {files.length ? <div className="order-file-list">
        {files.map((item) => <article className="order-file-row" key={item.id}>
          <span className="order-file-row__mark" aria-hidden="true">{fileMark(item.original_name)}</span>
          <div className="order-file-row__copy" title={item.original_name}>
            <strong>{item.original_name}</strong>
            <small>{formatFileSize(item.size_bytes)}</small>
          </div>
          <a className="order-file-row__download" href={apiDownloadUrl(`/api/admin/orders/${id}/files/${item.id}/download`)} aria-label={`Скачать ${item.original_name}`}>
            Скачать <span aria-hidden="true">↓</span>
          </a>
        </article>)}
      </div> : <p className="order-records__empty">Файлов пока нет.</p>}

      {filePages > 1 && <div className="pagination pagination--compact">
        <Button variant="quiet" disabled={filePage === 1} onClick={() => setFilePage(filePage - 1)}>←</Button>
        <span>{filePage} / {filePages}</span>
        <Button variant="quiet" disabled={filePage >= filePages} onClick={() => setFilePage(filePage + 1)}>→</Button>
      </div>}
    </section>

    <section className="order-records__section order-history">
      <div className="order-records__heading">
        <div>
          <span className="overline">История заказа</span>
          <h3>Последние события</h3>
        </div>
      </div>

      {events.length ? <ol className="activity-list activity-list--order">
        {events.map((event) => <li key={event.id}>
          <span aria-hidden="true" />
          <div>
            <strong>{operationalActivityLabel(event.action)}</strong>
            <small>{formatActivityDate(event.created_at)}</small>
          </div>
        </li>)}
      </ol> : <p className="order-records__empty">История пока пуста.</p>}

      {pages > 1 && <div className="pagination pagination--compact">
        <Button variant="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Button>
        <span>{page} / {pages}</span>
        <Button variant="quiet" disabled={page >= pages} onClick={() => setPage(page + 1)}>→</Button>
      </div>}
    </section>
  </section>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

function fileMark(name: string) {
  const extension = name.split(".").pop()?.toUpperCase();
  if (!extension || extension.length > 4) return "FILE";
  return extension;
}
