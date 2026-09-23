"use client";

import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import { applyCrmTheme, type CrmThemePreference } from "@/lib/crm-theme";
import { useAuth } from "./auth-provider";
import { LanguageCombobox } from "./language-combobox";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "./ui";

type ServiceDefinition = {
  fields: string[];
  billing_unit: string;
  allowed_billing_units: string[];
  matching_mode: "LANGUAGE_PAIR" | "SOURCE_LANGUAGE" | "SERVICE_ONLY";
};
type Service = {
  id: string;
  code: string;
  name: string;
  billing_mode: string;
  active: boolean;
  sort_order: number;
  notes: string;
  definition?: ServiceDefinition | null;
};
type Tariff = {
  id: string;
  service_code: string;
  source_language: string;
  target_language: string;
  direction: string;
  unit: string;
  amount: string | number;
  min_quantity: string | number;
  urgency_multiplier: string | number;
  native_multiplier: string | number;
  active_from: string | null;
  active_to: string | null;
  active: boolean;
  notes: string;
};
type PricingRule = {
  id: string;
  code: string;
  name: string;
  rule_type: string;
  service_code: string;
  threshold_from: string | number | null;
  threshold_to: string | number | null;
  percent: string | number;
  multiplier: string | number;
  active: boolean;
  notes: string;
};
type OrderStatusOption = {
  code: string;
  name: string;
  color: string;
  board: "MAIN" | "ARCHIVE";
  active: boolean;
  sort_order: number;
};
type Language = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};
const units = [
  ["CONDITIONAL_PAGE", "Усл. страница / 1800 знаков"],
  ["PER_1000_CHARS", "За 1000 знаков"],
  ["PER_PAGE", "За страницу"],
  ["PER_DOCUMENT", "За документ"],
  ["PER_SECOND", "За секунду"],
  ["PER_MINUTE", "За минуту"],
  ["HOURLY", "За час"],
  ["FIXED", "Фиксированная"],
  ["PERCENT_OF_BASE_SERVICE", "% от базовой услуги"],
  ["CUSTOM", "Своя единица"],
];
type SettingsModule =
  "catalogs" | "tariffs" | "rules" | "appearance" | "services" | "orders";
const modules: {
  id: SettingsModule;
  number: string;
  title: string;
  copy: string;
  adminOnly?: boolean;
}[] = [
  { id: "catalogs", number: "01", title: "Справочники", copy: "Языки и базовые справочники, которыми пользуются все рабочие модули CRM.", adminOnly: true },
  { id: "tariffs", number: "02", title: "Тарифы", copy: "Ставки по услугам, языкам и единицам расчёта.", adminOnly: true },
  { id: "rules", number: "03", title: "Скидки и коэффициенты", copy: "Правила расчёта стоимости, скидки и надбавки.", adminOnly: true },
  { id: "appearance", number: "04", title: "Оформление", copy: "Персональная тема рабочего пространства." },
  { id: "services", number: "05", title: "Услуги и единицы", copy: "Единый справочник услуг для заказов, тарифов и возможностей исполнителей.", adminOnly: true },
  { id: "orders", number: "06", title: "Статусы заказов", copy: "Этапы движения заказа и их отображение.", adminOnly: true },
];

function SettingsModuleGlyph({ module }: { module: SettingsModule }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.55,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (module === "catalogs") return <svg {...common}><path d="M5 5.8C5 4.8 8.1 4 12 4s7 .8 7 1.8-3.1 1.8-7 1.8-7-.8-7-1.8Z"/><path d="M5 5.8v5.1c0 1 3.1 1.8 7 1.8s7-.8 7-1.8V5.8"/><path d="M5 10.9V16c0 1 3.1 1.8 7 1.8s7-.8 7-1.8v-5.1"/></svg>;
  if (module === "tariffs") return <svg {...common}><path d="M5 18V9.5"/><path d="M9.7 18V6.5"/><path d="M14.3 18v-5.8"/><path d="M19 18V4.5"/><path d="M4 19.5h16"/></svg>;
  if (module === "rules") return <svg {...common}><path d="M6 7h12"/><path d="M8.5 4.5v5"/><path d="M6 17h12"/><path d="M15.5 14.5v5"/><path d="M12 12h.01"/></svg>;
  if (module === "appearance") return <svg {...common}><path d="M12 4.2v2.2"/><path d="m17.5 6.5-1.6 1.6"/><path d="M19.8 12h-2.2"/><path d="m17.5 17.5-1.6-1.6"/><path d="M12 19.8v-2.2"/><path d="m6.5 17.5 1.6-1.6"/><path d="M4.2 12h2.2"/><path d="m6.5 6.5 1.6 1.6"/><circle cx="12" cy="12" r="3.25"/></svg>;
  if (module === "services") return <svg {...common}><path d="M5 6.5h14"/><path d="M5 12h14"/><path d="M5 17.5h14"/><circle cx="8" cy="6.5" r="1.5"/><circle cx="15.5" cy="12" r="1.5"/><circle cx="10.5" cy="17.5" r="1.5"/></svg>;
  return <svg {...common}><path d="M12 3.8 19 6.5v5.2c0 4.2-2.5 7.2-7 8.5-4.5-1.3-7-4.3-7-8.5V6.5L12 3.8Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/></svg>;
}

export function CrmSettings() {
  const { state } = useAuth();
  const admin = state?.user.role === "ADMIN" || Boolean(state?.user.permissions.includes("SETTINGS_MANAGE"));
  const [tab, setTab] = useState<SettingsModule>(
    admin ? "catalogs" : "appearance",
  );
  const [services, setServices] = useState<Service[] | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
  const [rules, setRules] = useState<PricingRule[] | null>(null);
  const [statuses, setStatuses] = useState<OrderStatusOption[] | null>(null);
  const [languages, setLanguages] = useState<Language[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      if (!admin) return;
      const [s, t, r, os, languageResult] = await Promise.all([
        api<Service[]>("/api/admin/crm/services"),
        api<Tariff[]>("/api/admin/crm/tariffs"),
        api<PricingRule[]>("/api/admin/crm/pricing-rules"),
        api<OrderStatusOption[]>("/api/admin/crm/order-statuses"),
        api<{ items: Language[] }>("/api/admin/crm/languages?include_inactive=true"),
      ]);
      setServices(s);
      setTariffs(t);
      setRules(r);
      setStatuses(os);
      setLanguages(languageResult.items);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить настройки CRM",
      );
    }
  }, [admin]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const waiting = admin && (!services || !tariffs || !rules || !statuses || !languages);
  const visibleModules = modules.filter((item) => admin || !item.adminOnly);
  const active =
    visibleModules.find((item) => item.id === tab) ?? visibleModules[0];
  return (
    <div className="phase6-settings">
      <header className="page-head page-head--compact">
        <div>
          <span className="overline overline--accent">Лингво Коннект / Настройки</span>
          <h1>Настройки CRM</h1>
          <p>
            Гибко настраивайте CRM под процессы переводческой компании. Все ключевые параметры собраны в одном месте.
          </p>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <div className="settings-layout">
        <nav className="settings-modules settings-module-dock" aria-label="Модули настроек">
          {visibleModules.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "settings-module-card is-active" : "settings-module-card"}
              aria-current={tab === item.id ? "page" : undefined}
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              <span className="settings-module-card__visual"><SettingsModuleGlyph module={item.id} /></span>
              <span className="settings-module-card__body">
                <span className="settings-modules__number">{item.number}</span>
                <strong>{item.title}</strong>
              </span>
            </button>
          ))}
        </nav>
        <div className="settings-module-select">
          <Select
            label="Раздел настроек"
            value={tab}
            onChange={(event) => setTab(event.target.value as SettingsModule)}
          >
            {visibleModules.map((item) => (
              <option key={item.id} value={item.id}>{item.number} · {item.title}</option>
            ))}
          </Select>
        </div>
        <main className="settings-module" id={`settings-module-${active.id}`}>
          <header className="settings-module__intro">
            <span className="settings-module__intro-icon"><SettingsModuleGlyph module={active.id} /></span>
            <div>
              <span className="overline">Модуль {active.number}</span>
              <h2>{active.title}</h2>
              <p>{active.copy}</p>
            </div>
          </header>
          {waiting ? (
            <LoadingState />
          ) : tab === "appearance" ? (
            <Appearance />
          ) : tab === "catalogs" && languages ? (
            <Languages languages={languages} reload={load} />
          ) : tab === "services" && services ? (
            <Services services={services} reload={load} />
          ) : tab === "orders" && statuses ? (
            <Statuses statuses={statuses} reload={load} />
          ) : tab === "tariffs" && services && tariffs ? (
            <Tariffs services={services} tariffs={tariffs} reload={load} />
          ) : tab === "rules" && services && rules ? (
            <Rules services={services} rules={rules} reload={load} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SettingsDialog({
  title,
  copy,
  onClose,
  children,
}: {
  title: string;
  copy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="settings-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        <header>
          <div>
            <span className="overline">Редактирование</span>
            <h2 id="settings-dialog-title">{title}</h2>
            <p>{copy}</p>
          </div>
          <button
            type="button"
            className="settings-dialog__close"
            aria-label="Закрыть окно"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Appearance() {
  const [theme, setTheme] = useState<CrmThemePreference>(
    () =>
      (typeof window !== "undefined"
        ? (window.localStorage.getItem(
            "lc-crm-theme",
          ) as CrmThemePreference | null)
        : null) ?? "system",
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const interacted = useRef(false);
  useEffect(() => {
    api<{ interface_theme: CrmThemePreference }>(
      "/api/admin/users/me/preferences",
    )
      .then((value) => {
        if (!interacted.current) {
          setTheme(value.interface_theme);
          applyCrmTheme(value.interface_theme);
        }
      })
      .catch(() => undefined);
  }, []);
  async function choose(next: CrmThemePreference) {
    interacted.current = true;
    setTheme(next);
    setSaved(false);
    applyCrmTheme(next);
    setBusy(true);
    try {
      await api("/api/admin/users/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ interface_theme: next }),
      });
      setSaved(true);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить оформление",
      );
    } finally {
      setBusy(false);
    }
  }
  const options: [CrmThemePreference, string, string][] = [
    ["system", "Как в системе", "CRM следует настройке устройства"],
    ["light", "Светлая", "Светлый рабочий холст"],
    ["dark", "Тёмная", "Контрастная тема для вечерней работы"],
  ];
  return (
    <section className="settings-surface appearance-settings">
      <header>
        <div>
          <span className="overline">Персональные настройки</span>
          <h2>Оформление рабочего пространства</h2>
        </div>
        {saved && <Badge tone="success">Сохранено</Badge>}
      </header>
      {error && <ErrorState message={error} />}
      <div
        className="theme-picker"
        role="radiogroup"
        aria-label="Тема интерфейса"
      >
        {options.map(([value, title, copy]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            disabled={busy}
            className={
              theme === value ? "theme-option is-active" : "theme-option"
            }
            onClick={() => void choose(value)}
          >
            <span className={`theme-preview theme-preview--${value}`}>
              <i />
              <i />
              <i />
            </span>
            <strong>{title}</strong>
            <small>{copy}</small>
            <b>{theme === value ? "Выбрано" : "Выбрать"}</b>
          </button>
        ))}
      </div>
      <p className="settings-help">
        Настройка привязана к вашей учётной записи и не меняет интерфейс других
        сотрудников.
      </p>
    </section>
  );
}

function Languages({ languages, reload }: { languages: Language[]; reload: () => void }) {
  const [editing, setEditing] = useState<Language | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = languages.filter((language) => !needle || language.name.toLocaleLowerCase("ru-RU").includes(needle));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return <section className="settings-surface phase6-language-settings">
    <header><div><span className="overline">Единый справочник</span><h2>Языки</h2></div><Button onClick={() => setEditing(null)}>Добавить язык +</Button></header>
    <p className="settings-head-copy">Один справочник используется тарифами, работами заказа и языковыми парами исполнителей.</p>
    <div className="settings-catalog-tools">
      <Input label="Поиск" placeholder="Название языка" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      <PageSizeControl value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} />
    </div>
    {editing !== undefined && <SettingsDialog title={editing ? "Изменить язык" : "Новый язык"} copy="Название будет доступно во всех языковых полях CRM." onClose={() => setEditing(undefined)}>
      <LanguageForm item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />
    </SettingsDialog>}
    <div className="table-wrap"><table><thead><tr><th>Язык</th><th>Порядок</th><th>Статус</th><th /></tr></thead><tbody>
      {visible.map((language) => <tr key={language.id}><td><strong>{language.name}</strong></td><td>{language.sort_order}</td><td><Badge tone={language.active ? "success" : "neutral"}>{language.active ? "Активен" : "Отключён"}</Badge></td><td><Button variant="quiet" onClick={() => setEditing(language)}>Изменить</Button></td></tr>)}
    </tbody></table></div>
    {!visible.length && <p className="crm-empty">Языки по этому запросу не найдены.</p>}
    <SettingsPager page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
  </section>;
}

function LanguageForm({ item, onClose, onSaved }: { item: Language | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? 100));
  const [active, setActive] = useState(item?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/admin/crm/languages${item ? `/${item.id}` : ""}`, { method: item ? "PATCH" : "POST", body: JSON.stringify({ name: name.trim(), active, sort_order: Number(sortOrder || 0) }) });
      onSaved();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Не удалось сохранить язык"); } finally { setBusy(false); }
  }
  return <form className="crm-editor compact-settings-form" onSubmit={save}>
    {error && <ErrorState message={error} />}
    <fieldset className="wizard-grid" disabled={busy}>
      <Input label="Название языка" hint={item ? "Название — стабильный ключ. Для нового названия создайте отдельный язык." : undefined} value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} disabled={Boolean(item)} />
      <Input label="Порядок" type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
      <label className="manual-switch"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>Доступен для выбора</span></label>
    </fieldset>
    <div className="form-actions"><Button disabled={busy}>{busy ? "Сохраняем…" : "Сохранить язык"}</Button><Button type="button" variant="quiet" onClick={onClose}>Отмена</Button></div>
  </form>;
}

function Statuses({
  statuses,
  reload,
}: {
  statuses: OrderStatusOption[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<OrderStatusOption | null>(null);
  const [creating, setCreating] = useState<OrderStatusOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = editing ?? creating;
  const groups = [
    {
      board: "MAIN" as const,
      title: "Основная воронка",
      copy: "Рабочие этапы, которые видны в обычном Kanban и карточке заказа.",
    },
    {
      board: "ARCHIVE" as const,
      title: "Архивная воронка",
      copy: "Причины и этапы архива. По умолчанию заказ попадает в «Отменён». ",
    },
  ];

  function startCreate() {
    setError("");
    setEditing(null);
    setCreating({
      code: "",
      name: "",
      color: "slate",
      board: "MAIN",
      active: true,
      sort_order: Math.max(0, ...statuses.map((status) => status.sort_order)) + 10,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({
        name: draft.name,
        color: draft.color,
        board: draft.board,
        active: draft.active,
        sort_order: draft.sort_order,
      });
      if (creating) {
        await api("/api/admin/crm/order-statuses", {
          method: "POST",
          body,
        });
      } else {
        await api(`/api/admin/crm/order-statuses/${draft.code}`, {
          method: "PATCH",
          body,
        });
      }
      setEditing(null);
      setCreating(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить статус");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-surface">
      <header>
        <div>
          <span className="overline">Этапы заказа</span>
          <h2>{statuses.length} этапов</h2>
        </div>
        <p className="settings-head-copy">
          Каждый этап относится либо к основной, либо к архивной воронке. Поэтому архивные причины не смешиваются с рабочими статусами.
        </p>
        <Button type="button" variant="secondary" onClick={startCreate}>
          Добавить этап
        </Button>
      </header>
      {error && <ErrorState message={error} />}
      {draft && (
        <SettingsDialog
          title={creating ? "Новый этап" : "Изменить этап"}
          copy="Задайте название, цвет, порядок и воронку. Архивные этапы показываются только в архиве."
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
        >
          <form className="crm-editor compact-settings-form" onSubmit={save}>
            <fieldset className="wizard-grid" disabled={busy}>
              <Input
                label="Название"
                value={draft.name}
                onChange={(e) => {
                  const next = { ...draft, name: e.target.value };
                  if (creating) setCreating(next);
                  else setEditing(next);
                }}
                required
              />
              {!creating && <Input label="Системный код" value={draft.code} disabled />}
              <Select
                label="Воронка"
                value={draft.board}
                disabled={!creating && !draft.code.startsWith("CUSTOM_")}
                onChange={(e) => {
                  const next = { ...draft, board: e.target.value as OrderStatusOption["board"] };
                  if (creating) setCreating(next);
                  else setEditing(next);
                }}
              >
                <option value="MAIN">Основная</option>
                <option value="ARCHIVE">Архив</option>
              </Select>
              <Select
                label="Цвет"
                value={draft.color}
                onChange={(e) => {
                  const next = { ...draft, color: e.target.value };
                  if (creating) setCreating(next);
                  else setEditing(next);
                }}
              >
                <option value="slate">Графитовый</option>
                <option value="blue">Синий</option>
                <option value="violet">Фиолетовый</option>
                <option value="amber">Янтарный</option>
                <option value="cyan">Бирюзовый</option>
                <option value="green">Зелёный</option>
                <option value="rose">Бордовый</option>
              </Select>
              <Input
                label="Порядок"
                type="number"
                min="0"
                value={draft.sort_order}
                onChange={(e) => {
                  const next = { ...draft, sort_order: Number(e.target.value) };
                  if (creating) setCreating(next);
                  else setEditing(next);
                }}
              />
              <label className="manual-switch">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => {
                    const next = { ...draft, active: e.target.checked };
                    if (creating) setCreating(next);
                    else setEditing(next);
                  }}
                />
                <span>Доступен для выбора</span>
              </label>
            </fieldset>
            <div className="form-actions">
              <Button disabled={busy}>{busy ? "Сохраняем…" : creating ? "Добавить этап" : "Сохранить этап"}</Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setEditing(null);
                  setCreating(null);
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        </SettingsDialog>
      )}
      <div className="status-directory status-directory--grouped">
        {groups.map((group) => {
          const rows = statuses
            .filter((status) => status.board === group.board)
            .sort((a, b) => a.sort_order - b.sort_order);
          return (
            <section key={group.board} className="status-directory__group">
              <header className="status-directory__group-head">
                <div>
                  <strong>{group.title}</strong>
                  <small>{group.copy}</small>
                </div>
                <Badge tone={group.board === "ARCHIVE" ? "warning" : "info"}>{rows.length}</Badge>
              </header>
              <div className="status-directory__rows">
                {rows.map((status) => (
                  <article
                    key={status.code}
                    className={`status-directory__row status-color--${status.color}`}
                  >
                    <i />
                    <div>
                      <strong>{status.name}</strong>
                      <code>{status.code}</code>
                    </div>
                    <div className="status-directory__meta">
                      <Badge tone={status.board === "ARCHIVE" ? "warning" : "info"}>
                        {status.board === "ARCHIVE" ? "Архив" : "Основная"}
                      </Badge>
                      <Badge tone={status.active ? "success" : "neutral"}>
                        {status.active ? "Активен" : "Отключён"}
                      </Badge>
                    </div>
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setCreating(null);
                        setEditing(status);
                      }}
                    >
                      Изменить
                    </Button>
                  </article>
                ))}
                {!rows.length && <p className="crm-empty">Этапы ещё не добавлены.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function PageSizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <fieldset className="settings-page-size" aria-label="Количество строк на странице">
    <legend>На странице</legend>
    <div role="group" aria-label="Количество строк">
      {[8, 12, 20].map((size) => (
        <button
          key={size}
          type="button"
          className={value === size ? "is-active" : ""}
          aria-pressed={value === size}
          onClick={() => onChange(size)}
        >
          {size}
        </button>
      ))}
    </div>
  </fieldset>;
}

function SettingsPager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return <div className="settings-pagination" aria-label="Пагинация справочника">
    <span>Всего: {total}</span>
    <div>
      <Button type="button" variant="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Назад</Button>
      <strong>{page} / {pages}</strong>
      <Button type="button" variant="quiet" disabled={page >= pages} onClick={() => onPage(page + 1)}>Далее →</Button>
    </div>
  </div>;
}

function Services({
  services,
  reload,
}: {
  services: Service[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = services.filter((service) => {
    if (!needle) return true;
    const unit = units.find(([value]) => value === service.billing_mode)?.[1] || service.billing_mode;
    return `${service.name} ${service.code} ${unit}`.toLocaleLowerCase("ru-RU").includes(needle);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <section className="settings-surface">
      <header>
        <div>
          <span className="overline">Справочник услуг</span>
          <h2>{services.length} позиций</h2>
        </div>
        <Button onClick={() => setEditing(null)}>Добавить услугу +</Button>
      </header>
      <div className="settings-catalog-tools">
        <Input label="Поиск" placeholder="Услуга, код или единица" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <PageSizeControl value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>
      {editing !== undefined && (
        <SettingsDialog
          title={editing ? "Изменить услугу" : "Новая услуга"}
          copy="Название, код и единица используются во всех заказах и тарифах."
          onClose={() => setEditing(undefined)}
        >
          <ServiceForm
            item={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              reload();
            }}
          />
        </SettingsDialog>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Код</th>
              <th>Единица</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((service) => (
              <tr key={service.id}>
                <td><strong>{service.name}</strong></td>
                <td><code>{service.code}</code></td>
                <td>{units.find(([value]) => value === service.billing_mode)?.[1] || service.billing_mode}</td>
                <td><Badge tone={service.active ? "success" : "neutral"}>{service.active ? "Активна" : "Отключена"}</Badge></td>
                <td><Button variant="quiet" onClick={() => setEditing(service)}>Изменить</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p className="crm-empty">Услуги по этому запросу не найдены.</p>}
      <SettingsPager page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
    </section>
  );
}

function ServiceForm({
  item,
  onClose,
  onSaved,
}: {
  item: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    code: item?.code || "",
    name: item?.name || "",
    billing_mode: item?.billing_mode || "CUSTOM",
    active: item?.active ?? true,
    sort_order: String(item?.sort_order ?? 100),
    notes: item?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/admin/crm/services${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({ ...f, sort_order: Number(f.sort_order) }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="crm-editor compact-settings-form" onSubmit={save}>
      {error && <ErrorState message={error} />}
      <fieldset className="wizard-grid" disabled={busy}>
        <Input
          label="Название *"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <Input
          label="Код *"
          hint={item ? "Системный код связан с тарифами, заказами и возможностями исполнителей." : "Латиница, цифры и подчёркивания"}
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
          required
          disabled={Boolean(item)}
        />
        <Select
          label="Единица по умолчанию"
          value={f.billing_mode}
          onChange={(e) => setF({ ...f, billing_mode: e.target.value })}
        >
          {units.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          label="Порядок"
          type="number"
          value={f.sort_order}
          onChange={(e) => setF({ ...f, sort_order: e.target.value })}
        />
        <label className="manual-switch">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          <span>Активна</span>
        </label>
        <Textarea
          label="Комментарий"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </fieldset>
      <div className="form-actions">
        <Button disabled={busy}>Сохранить</Button>
        <Button type="button" variant="quiet" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function Tariffs({
  services,
  tariffs,
  reload,
}: {
  services: Service[];
  tariffs: Tariff[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Tariff | null | undefined>(undefined);
  const [service, setService] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const filtered = tariffs.filter((tariff) => !service || tariff.service_code === service);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <section className="settings-surface">
      <header>
        <div><span className="overline">Тарифы</span><h2>Финансовые правила</h2></div>
        <Button onClick={() => setEditing(null)}>Добавить тариф +</Button>
      </header>
      <div className="settings-catalog-tools settings-catalog-tools--filters">
        <Select label="Услуга" value={service} onChange={(event) => { setService(event.target.value); setPage(1); }}>
          <option value="">Все услуги</option>
          {services.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </Select>
        <PageSizeControl value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>
      {editing !== undefined && (
        <SettingsDialog title={editing ? "Изменить тариф" : "Новый тариф"} copy="Настройте направление, единицу, ставку и период действия." onClose={() => setEditing(undefined)}>
          <TariffForm item={editing} services={services} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />
        </SettingsDialog>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Услуга</th><th>Направление</th><th>Единица</th><th>Тариф</th><th>Статус</th><th /></tr></thead>
          <tbody>{visible.map((tariff) => <tr key={tariff.id}>
            <td>{services.find((item) => item.code === tariff.service_code)?.name || tariff.service_code}</td>
            <td>{[tariff.source_language, tariff.target_language].filter(Boolean).join(" → ") || tariff.direction}</td>
            <td>{units.find(([value]) => value === tariff.unit)?.[1] || tariff.unit}</td>
            <td><strong>{Number(tariff.amount).toLocaleString("ru-RU")} ₽</strong></td>
            <td><Badge tone={tariff.active ? "success" : "neutral"}>{tariff.active ? "Активен" : "Отключён"}</Badge></td>
            <td><Button variant="quiet" onClick={() => setEditing(tariff)}>Изменить</Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visible.length && <p className="crm-empty">Тарифов пока нет. Архитектура готова: добавляйте только подтверждённые значения.</p>}
      <SettingsPager page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
    </section>
  );
}

function TariffForm({
  item,
  services,
  onClose,
  onSaved,
}: {
  item: Tariff | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    service_code: item?.service_code || services[0]?.code || "",
    source_language: item?.source_language || "",
    target_language: item?.target_language || "",
    direction: item?.direction || "ANY",
    unit: item?.unit || "CONDITIONAL_PAGE",
    amount: String(item?.amount ?? 0),
    min_quantity: String(item?.min_quantity ?? 0),
    native_multiplier: String(item?.native_multiplier ?? 1),
    active_from: item?.active_from || "",
    active_to: item?.active_to || "",
    active: item?.active ?? true,
    notes: item?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedService = services.find((service) => service.code === f.service_code);
  const definition = selectedService?.definition;
  const languageMode = definition?.matching_mode ?? "LANGUAGE_PAIR";
  const showSourceLanguage = languageMode === "LANGUAGE_PAIR" || languageMode === "SOURCE_LANGUAGE";
  const showTargetLanguage = languageMode === "LANGUAGE_PAIR";
  const showDirection = languageMode === "LANGUAGE_PAIR";
  const showNativeMultiplier = Boolean(definition?.fields.includes("translator_type"));
  const allowedUnits = definition?.allowed_billing_units?.length
    ? definition.allowed_billing_units
    : units.map(([value]) => value);
  const unitOptions = units.filter(([value]) => allowedUnits.includes(value));

  function selectService(serviceCode: string) {
    const nextService = services.find((service) => service.code === serviceCode);
    const nextDefinition = nextService?.definition;
    const nextUnit = nextDefinition?.billing_unit || nextService?.billing_mode || f.unit;
    setF({
      ...f,
      service_code: serviceCode,
      unit: nextUnit,
      source_language: nextDefinition?.matching_mode === "SERVICE_ONLY" ? "" : f.source_language,
      target_language: nextDefinition?.matching_mode === "LANGUAGE_PAIR" ? f.target_language : "",
      direction: nextDefinition?.matching_mode === "LANGUAGE_PAIR" ? f.direction : "ANY",
      native_multiplier: nextDefinition?.fields.includes("translator_type") ? f.native_multiplier : "1",
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/admin/crm/tariffs${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({
          ...f,
          amount: Number(f.amount),
          min_quantity: Number(f.min_quantity),
          urgency_multiplier: 1,
          native_multiplier: Number(f.native_multiplier),
          active_from: f.active_from || null,
          active_to: f.active_to || null,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="crm-editor compact-settings-form" onSubmit={save}>
      {error && <ErrorState message={error} />}
      <fieldset className="wizard-grid" disabled={busy}>
        <Select
          label="Услуга *"
          value={f.service_code}
          onChange={(e) => selectService(e.target.value)}
        >
          {services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          label="Единица"
          value={f.unit}
          onChange={(e) => setF({ ...f, unit: e.target.value })}
        >
          {unitOptions.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        {showSourceLanguage && <LanguageCombobox label="Язык с" value={f.source_language} disabled={busy} onChange={(value) => setF({ ...f, source_language: value })} />}
        {showTargetLanguage && <LanguageCombobox label="Язык на" value={f.target_language} disabled={busy} onChange={(value) => setF({ ...f, target_language: value })} />}
        {showDirection && <Select label="Направление" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>
          <option value="ANY">Любое / без направления</option>
          <option value="TO_RUSSIAN">На русский</option>
          <option value="FROM_RUSSIAN">С русского</option>
          <option value="NATIVE_SPEAKER">Носитель языка</option>
        </Select>}
        <Input
          label="Тариф, ₽"
          type="number"
          min="0"
          step="0.01"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value })}
        />
        <Input
          label="Мин. количество"
          type="number"
          min="0"
          step="0.01"
          value={f.min_quantity}
          onChange={(e) => setF({ ...f, min_quantity: e.target.value })}
        />
        {showNativeMultiplier && <Input
          label="Коэф. носителя"
          type="number"
          min="1"
          step="0.01"
          value={f.native_multiplier}
          onChange={(e) => setF({ ...f, native_multiplier: e.target.value })}
        />}
        <Input
          label="Действует с"
          type="date"
          value={f.active_from}
          onChange={(e) => setF({ ...f, active_from: e.target.value })}
        />
        <Input
          label="Действует до"
          type="date"
          value={f.active_to}
          onChange={(e) => setF({ ...f, active_to: e.target.value })}
        />
        <label className="manual-switch">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          <span>Активен</span>
        </label>
        <Textarea
          label="Комментарий"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </fieldset>
      <div className="form-actions">
        <Button disabled={busy}>Сохранить тариф</Button>
        <Button type="button" variant="quiet" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function Rules({
  services,
  rules,
  reload,
}: {
  services: Service[];
  rules: PricingRule[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<PricingRule | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = rules.filter((rule) => !needle || `${rule.name} ${rule.code} ${rule.service_code}`.toLocaleLowerCase("ru-RU").includes(needle));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <section className="settings-surface">
      <header>
        <div><span className="overline">Правила расчёта</span><h2>Скидки и коэффициенты</h2></div>
        <Button onClick={() => setEditing(null)}>Добавить правило +</Button>
      </header>
      <div className="settings-catalog-tools">
        <Input label="Поиск" placeholder="Название, код или услуга" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <PageSizeControl value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>
      {editing !== undefined && (
        <SettingsDialog title={editing ? "Изменить правило" : "Новое правило"} copy="Задайте область применения, диапазон и финансовое действие." onClose={() => setEditing(undefined)}>
          <RuleForm item={editing} services={services} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />
        </SettingsDialog>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Правило</th><th>Услуга</th><th>Диапазон</th><th>Скидка</th><th>Статус</th><th /></tr></thead>
          <tbody>{visible.map((rule) => <tr key={rule.id}>
            <td><strong>{rule.name}</strong><br /><code>{rule.code}</code></td>
            <td>{services.find((item) => item.code === rule.service_code)?.name || rule.service_code || "Все"}</td>
            <td>{rule.threshold_from ?? "—"} — {rule.threshold_to ?? "∞"}</td>
            <td>{Number(rule.percent)}%</td>
            <td><Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Активно" : "Отключено"}</Badge></td>
            <td><Button variant="quiet" onClick={() => setEditing(rule)}>Изменить</Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visible.length && <p className="crm-empty">Правила по этому запросу не найдены.</p>}
      <SettingsPager page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
    </section>
  );
}

function RuleForm({
  item,
  services,
  onClose,
  onSaved,
}: {
  item: PricingRule | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    code: item?.code || "",
    name: item?.name || "",
    rule_type: item?.rule_type || "VOLUME_DISCOUNT",
    service_code: item?.service_code || "written_translation",
    threshold_from:
      item?.threshold_from == null ? "" : String(item.threshold_from),
    threshold_to: item?.threshold_to == null ? "" : String(item.threshold_to),
    percent: String(item?.percent ?? 0),
    multiplier: String(item?.multiplier ?? 1),
    active: item?.active ?? true,
    notes: item?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/crm/pricing-rules${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({
          ...f,
          threshold_from: f.threshold_from ? Number(f.threshold_from) : null,
          threshold_to: f.threshold_to ? Number(f.threshold_to) : null,
          percent: Number(f.percent),
          multiplier: Number(f.multiplier),
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="crm-editor compact-settings-form" onSubmit={save}>
      {error && <ErrorState message={error} />}
      <fieldset className="wizard-grid" disabled={busy}>
        <Input
          label="Название *"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <Input
          label="Код *"
          hint={item ? "Системный код связан с тарифами, заказами и возможностями исполнителей." : "Латиница, цифры и подчёркивания"}
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
          required
          disabled={Boolean(item)}
        />
        <Select
          label="Услуга"
          value={f.service_code}
          onChange={(e) => setF({ ...f, service_code: e.target.value })}
        >
          <option value="">Все услуги</option>
          {services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          label="Тип правила"
          value={f.rule_type}
          onChange={(e) => setF({ ...f, rule_type: e.target.value })}
        >
          <option value="VOLUME_DISCOUNT">Скидка от объёма</option>
          <option value="SURCHARGE">Коэффициент / надбавка</option>
          <option value="CUSTOM">Другое</option>
        </Select>
        <Input
          label="От"
          type="number"
          min="0"
          step="0.01"
          value={f.threshold_from}
          onChange={(e) => setF({ ...f, threshold_from: e.target.value })}
        />
        <Input
          label="До"
          type="number"
          min="0"
          step="0.01"
          value={f.threshold_to}
          onChange={(e) => setF({ ...f, threshold_to: e.target.value })}
        />
        <Input
          label="Скидка, %"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={f.percent}
          onChange={(e) => setF({ ...f, percent: e.target.value })}
        />
        <Input
          label="Множитель"
          type="number"
          min="0"
          step="0.01"
          value={f.multiplier}
          onChange={(e) => setF({ ...f, multiplier: e.target.value })}
        />
        <label className="manual-switch">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          <span>Активно</span>
        </label>
        <Textarea
          label="Комментарий"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </fieldset>
      <div className="form-actions">
        <Button disabled={busy}>Сохранить правило</Button>
        <Button type="button" variant="quiet" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
