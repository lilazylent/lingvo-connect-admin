"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";

export function LanguageCombobox({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<{id:string;name:string}[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value), 0);
    return () => window.clearTimeout(timer);
  }, [value]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api<{items:{id:string;name:string}[]}>(`/api/admin/crm/languages?q=${encodeURIComponent(query)}`, {signal: controller.signal})
        .then(result => { setItems(result.items); setActive(result.items.length ? 0 : -1); })
        .catch(() => setItems([]))
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 160);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const choose = (next: string) => { setQuery(next); onChange(next); setOpen(false); };
  return <div className="crm-combobox language-combobox">
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <div className={`crm-combobox__control ${open ? "is-open" : ""}`}>
        <input id={id} className="input crm-combobox__input" value={query} disabled={disabled} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-listbox`} placeholder="Выберите из справочника" aria-autocomplete="list" onFocus={()=>setOpen(true)} onBlur={()=>window.setTimeout(()=>{setOpen(false);setQuery(value);},100)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{
          if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);setActive(i=>Math.min(items.length-1,Math.max(0,i+1)));}
          else if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(0,i-1));}
          else if(e.key==="Enter"&&open&&active>=0&&items[active]){e.preventDefault();choose(items[active].name);}
          else if(e.key==="Escape")setOpen(false);
        }}/>
        {query && !disabled && <button type="button" className="crm-combobox__clear" aria-label={`Очистить ${label}`} onClick={()=>choose("")}>×</button>}
      </div>
    </label>
    {open&&!disabled&&<div id={`${id}-listbox`} className="crm-combobox__menu" role="listbox" onMouseDown={e=>e.preventDefault()}>{loading?<div className="crm-combobox__state">Загрузка языков…</div>:items.length?items.map((item,index)=><button key={item.id} type="button" role="option" aria-selected={item.name===value} className={`crm-combobox__option ${index===active?"is-active":""}`} onMouseEnter={()=>setActive(index)} onClick={()=>choose(item.name)}><strong>{item.name}</strong></button>):<div className="crm-combobox__state">Язык не найден в справочнике</div>}</div>}
  </div>;
}
