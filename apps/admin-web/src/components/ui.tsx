"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
export { Select } from "./select";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

export function Input({ label, hint, error, id, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helpId = hint || error ? `${fieldId}-help` : undefined;

  return (
    <label className="field" htmlFor={fieldId}>
      <span id={`${fieldId}-label`} className="field__label">{label}</span>
      <input
        id={fieldId}
        aria-labelledby={`${fieldId}-label`}
        className={`input ${error ? "input--error" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        {...props}
      />
      {(hint || error) && <span id={helpId} className={error ? "field__error" : "field__hint"}>{error || hint}</span>}
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
  const helpId = hint || error ? `${fieldId}-help` : undefined;

  return (
    <label className="field" htmlFor={fieldId}>
      <span id={`${fieldId}-label`} className="field__label">{label}</span>
      <textarea
        id={fieldId}
        aria-labelledby={`${fieldId}-label`}
        className={`input textarea ${error ? "input--error" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        {...props}
      />
      {(hint || error) && <span id={helpId} className={error ? "field__error" : "field__hint"}>{error || hint}</span>}
    </label>
  );
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
  return <div className={`file-picker ${file ? "is-selected" : ""} ${className}`.trim()}>
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

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>;
}

export type ActionMenuItem = {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Viewport-aware row/action menu rendered in a portal so table overflow never
 * clips destructive/admin actions.  Positioning is calculated from the trigger
 * and re-evaluated only from real browser events (scroll/resize), not render effects.
 */
export function ActionMenu({
  label,
  items,
  className = "",
}: {
  label: string;
  items: ActionMenuItem[];
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const calculatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const width = 224;
    const estimatedHeight = Math.min(320, items.length * 40 + 12);
    const margin = 8;
    const gap = 6;
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const roomAbove = rect.top - margin;
    const openUp = roomBelow < Math.min(estimatedHeight, 180) && roomAbove > roomBelow;
    const top = openUp
      ? Math.max(margin, rect.top - estimatedHeight - gap)
      : Math.min(window.innerHeight - estimatedHeight - margin, rect.bottom + gap);
    const left = Math.max(
      margin,
      Math.min(rect.right - width, window.innerWidth - width - margin),
    );
    setPosition({ top: Math.max(margin, top), left });
  }, [items.length]);

  const toggle = () => {
    if (!open) calculatePosition();
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const reposition = () => calculatePosition();
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [calculatePosition, open]);

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`action-menu__trigger ${className}`.trim()}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={toggle}
    >
      <span aria-hidden="true">•••</span>
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <div
        ref={menuRef}
        className="action-menu__popover"
        role="menu"
        style={{ top: position.top, left: position.left }}
      >
        {items.map((item) => <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? "is-danger" : ""}
          disabled={item.disabled}
          onClick={() => {
            setOpen(false);
            item.onSelect();
          }}
        >{item.label}</button>)}
      </div>,
      document.body,
    ) : null}
  </>;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={`card ${className}`.trim()} {...props}>{children}</section>;
}

export function LoadingState({ label = "Загрузка данных" }: { label?: string }) {
  return <div className="state state--loading" role="status" aria-live="polite"><span className="state__line" aria-hidden="true" />{label}</div>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="table-skeleton" role="status" aria-label="Загрузка таблицы">{Array.from({ length: rows }, (_, index) => <span key={index} aria-hidden="true" />)}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="notice notice--error" role="alert"><strong>Не удалось продолжить</strong><span>{message}</span></div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty"><span className="empty__mark" aria-hidden="true">—</span><h3>{title}</h3><p>{text}</p></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}
