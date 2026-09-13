"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LookupItem = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  telegram?: string;
  directions?: { source_language?: string; target_language?: string; work_type?: string }[];
};

type LookupPage = { items: LookupItem[] };

/** Debounced server-side autocomplete. Typing never changes the selected record. */
export function CrmLookup({ label, path, value, onChange, disabled = false, placeholder }: {
  label: string;
  path: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LookupItem[]>([]);
  const [selected, setSelected] = useState<LookupItem | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api<LookupPage>(`${path}${path.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}&page_size=20`, { signal: controller.signal })
        .then(result => {
          setItems(result.items);
          setSelected(current => result.items.find(item => item.id === value) ?? current);
          setError("");
          setActiveIndex(result.items.length ? 0 : -1);
        })
        .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось выполнить поиск"); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [path, query, value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!value) setSelected(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [value]);

  const selectedLabel = useMemo(() => selected?.name || (value ? `Запись ${value.slice(0, 8)}` : ""), [selected, value]);
  const secondary = (item: LookupItem) => {
    const direction = item.directions?.[0];
    return [item.position, item.email, item.phone, item.telegram, direction ? `${direction.source_language || "?"} → ${direction.target_language || "?"}` : ""].filter(Boolean).slice(0, 2).join(" · ");
  };
  const choose = (item: LookupItem) => {
    setSelected(item);
    onChange(item.id);
    setQuery("");
    setOpen(false);
  };

  return <div className={`crm-lookup crm-combobox ${disabled ? "is-disabled" : ""}`}>
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <div className={`crm-combobox__control ${open ? "is-open" : ""}`}>
        <input
          id={id}
          className="input crm-combobox__input"
          value={query}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          placeholder={selectedLabel || placeholder || `Имя, телефон или email`}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActiveIndex(i => Math.min(items.length - 1, Math.max(0, i + 1))); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && open && activeIndex >= 0 && items[activeIndex]) { e.preventDefault(); choose(items[activeIndex]); }
            else if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && <button type="button" className="crm-combobox__clear" aria-label={`Очистить поле ${label}`} onClick={() => { onChange(""); setSelected(null); setQuery(""); setOpen(false); }}>×</button>}
      </div>
      {selectedLabel && <span className="crm-combobox__selected">Выбрано: <strong>{selectedLabel}</strong></span>}
      {error && <span className="field__error">{error}</span>}
    </label>
    {open && !disabled && <div id={`${id}-listbox`} className="crm-combobox__menu" role="listbox" onMouseDown={e => e.preventDefault()}>
      {loading ? <div className="crm-combobox__state">Ищем…</div> : items.length ? items.map((item, index) => <button
        key={item.id}
        id={`${id}-option-${index}`}
        type="button"
        role="option"
        aria-selected={item.id === value}
        className={`crm-combobox__option ${index === activeIndex ? "is-active" : ""} ${item.id === value ? "is-selected" : ""}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(item)}
      ><strong>{item.name || "Без названия"}</strong>{secondary(item) && <small>{secondary(item)}</small>}</button>) : <div className="crm-combobox__state">Совпадений не найдено</div>}
    </div>}
  </div>;
}
