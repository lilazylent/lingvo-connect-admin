"use client";

import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
export { Select } from "./select";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" }) {
  return <button className={`button button--${variant} ${className}`} {...props} />;
}

export function Input({ label, hint, error, id, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <label className="field">
      <span id={`${fieldId}-label`} className="field__label">{label}</span>
      <input id={fieldId} aria-labelledby={`${fieldId}-label`} className={`input ${error ? "input--error" : ""} ${className}`} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${fieldId}-help` : undefined} {...props} />
      {(hint || error) && <span id={`${fieldId}-help`} className={error ? "field__error" : "field__hint"}>{error || hint}</span>}
    </label>
  );
}

export function Textarea({ label, hint, error, id, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <label className="field"><span className="field__label">{label}</span><textarea id={fieldId} className={`input textarea ${error ? "input--error" : ""} ${className}`} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${fieldId}-help` : undefined} {...props} />{(hint || error) && <span id={`${fieldId}-help`} className={error ? "field__error" : "field__hint"}>{error || hint}</span>}</label>;
}

export function FilePicker({
  label = "Выбрать файл",
  hint,
  file,
  accept,
  disabled = false,
  onChange,
  onClear,
  className = "",
}: {
  label?: string;
  hint?: string;
  file: File | null;
  accept?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  onClear?: () => void;
  className?: string;
}) {
  const id = useId();
  const size = file ? formatFileSize(file.size) : "";
  return <div className={`file-picker ${file ? "is-selected" : ""} ${className}`}>
    <label htmlFor={id} className="file-picker__surface" aria-disabled={disabled}>
      <span className="file-picker__icon" aria-hidden="true">↥</span>
      <span className="file-picker__copy">
        <strong>{file ? file.name : label}</strong>
        <small>{file ? size : (hint || "Выберите файл с устройства")}</small>
      </span>
      <span className="file-picker__action">{file ? "Заменить" : "Выбрать"}</span>
      <input id={id} className="sr-only" type="file" accept={accept} disabled={disabled} onChange={(event)=>{
        const next = event.target.files?.[0] ?? null;
        onChange(next);
        event.currentTarget.value = "";
      }}/>
    </label>
    {file && onClear && <button type="button" className="file-picker__clear" onClick={onClear} disabled={disabled} aria-label={`Убрать файл ${file.name}`}>×</button>}
  </div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function LoadingState({ label = "Загрузка данных" }: { label?: string }) {
  return <div className="state state--loading"><span className="state__line" />{label}</div>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="table-skeleton" aria-label="Загрузка таблицы">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="notice notice--error" role="alert"><strong>Не удалось продолжить</strong><span>{message}</span></div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty"><span className="empty__mark">—</span><h3>{title}</h3><p>{text}</p></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}
