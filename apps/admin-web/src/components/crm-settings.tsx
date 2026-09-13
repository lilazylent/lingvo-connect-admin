"use client";

import Link from "next/link";
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
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "./ui";

type Service = {
  id: string;
  code: string;
  name: string;
  billing_mode: string;
  active: boolean;
  sort_order: number;
  notes: string;
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
  "catalogs" | "tariffs" | "rules" | "orders" | "users" | "appearance";
const modules: {
  id: SettingsModule;
  number: string;
  title: string;
  copy: string;
  adminOnly?: boolean;
}[] = [
  {
    id: "catalogs",
    number: "01",
    title: "Справочники",
    copy: "Услуги, единицы измерения и базовые сущности CRM.",
    adminOnly: true,
  },
  {
    id: "tariffs",
    number: "02",
    title: "Тарифы",
    copy: "Ставки по услугам, языкам и единицам расчёта.",
    adminOnly: true,
  },
  {
    id: "rules",
    number: "03",
    title: "Скидки и коэффициенты",
    copy: "Правила расчёта стоимости и надбавки.",
    adminOnly: true,
  },
  {
    id: "orders",
    number: "04",
    title: "Заказы и статусы",
    copy: "Этапы движения заказа и их отображение.",
    adminOnly: true,
  },
  {
    id: "users",
    number: "05",
    title: "Пользователи и роли",
    copy: "Доступ сотрудников и распределение ролей.",
    adminOnly: true,
  },
  {
    id: "appearance",
    number: "06",
    title: "Оформление",
    copy: "Персональная тема рабочего пространства.",
  },
];

export function CrmSettings() {
  const { state } = useAuth();
  const admin = state?.user.role === "ADMIN";
  const [tab, setTab] = useState<SettingsModule>(
    admin ? "catalogs" : "appearance",
  );
  const [services, setServices] = useState<Service[] | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
  const [rules, setRules] = useState<PricingRule[] | null>(null);
  const [statuses, setStatuses] = useState<OrderStatusOption[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      if (!admin) return;
      const [s, t, r, os] = await Promise.all([
        api<Service[]>("/api/admin/crm/services"),
        api<Tariff[]>("/api/admin/crm/tariffs"),
        api<PricingRule[]>("/api/admin/crm/pricing-rules"),
        api<OrderStatusOption[]>("/api/admin/crm/order-statuses"),
      ]);
      setServices(s);
      setTariffs(t);
      setRules(r);
      setStatuses(os);
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
  const waiting = admin && (!services || !tariffs || !rules || !statuses);
  const visibleModules = modules.filter((item) => admin || !item.adminOnly);
  const active =
    visibleModules.find((item) => item.id === tab) ?? visibleModules[0];
  return (
    <>
      <header className="page-head page-head--compact">
        <div>
          <span className="overline overline--accent">
            Настройки / {admin ? "A2" : "07"}
          </span>
          <h1>Настройки CRM</h1>
          <p>
            Рабочие справочники, правила и персональное оформление собраны по
            понятным модулям.
          </p>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <div className="settings-layout">
        <nav className="settings-modules" aria-label="Модули настроек">
          {visibleModules.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              <span>{item.number}</span>
              <strong>{item.title}</strong>
              <small>{item.copy}</small>
            </button>
          ))}
        </nav>
        <main className="settings-module">
          <header className="settings-module__intro">
            <span className="overline">Модуль {active.number}</span>
            <h2>{active.title}</h2>
            <p>{active.copy}</p>
          </header>
          {waiting ? (
            <LoadingState />
          ) : tab === "appearance" ? (
            <Appearance />
          ) : tab === "catalogs" && services ? (
            <Services services={services} reload={load} />
          ) : tab === "orders" && statuses ? (
            <Statuses statuses={statuses} reload={load} />
          ) : tab === "tariffs" && services && tariffs ? (
            <Tariffs services={services} tariffs={tariffs} reload={load} />
          ) : tab === "rules" && services && rules ? (
            <Rules services={services} rules={rules} reload={load} />
          ) : tab === "users" ? (
            <section className="settings-surface settings-users-callout">
              <header>
                <div>
                  <span className="overline">Доступ команды</span>
                  <h2>Пользователи и роли</h2>
                </div>
              </header>
              <p>
                Создание сотрудников, роли ADMIN и MANAGER, восстановление
                доступа и архивирование находятся в отдельном защищённом
                разделе.
              </p>
              <Link className="button button--primary" href="/admin/users">
                Открыть пользователей →
              </Link>
            </section>
          ) : null}
        </main>
      </div>
    </>
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

function Statuses({
  statuses,
  reload,
}: {
  statuses: OrderStatusOption[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<OrderStatusOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/api/admin/crm/order-statuses/${editing.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editing.name,
          color: editing.color,
          active: editing.active,
          sort_order: editing.sort_order,
        }),
      });
      setEditing(null);
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
          <h2>{statuses.length} системных статусов</h2>
        </div>
        <p className="settings-head-copy">
          Коды защищены: можно менять подпись, цвет, порядок и доступность.
        </p>
      </header>
      {error && <ErrorState message={error} />}
      {editing && (
        <SettingsDialog
          title="Изменить статус"
          copy="Настройте подпись, семантический цвет и доступность этапа."
          onClose={() => setEditing(null)}
        >
          <form className="crm-editor compact-settings-form" onSubmit={save}>
            <fieldset className="wizard-grid" disabled={busy}>
              <Input
                label="Название"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                required
              />
              <Input label="Системный код" value={editing.code} disabled />
              <Select
                label="Цвет"
                value={editing.color}
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
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
                value={editing.sort_order}
                onChange={(e) =>
                  setEditing({ ...editing, sort_order: Number(e.target.value) })
                }
              />
              <label className="manual-switch">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
                <span>Доступен для выбора</span>
              </label>
            </fieldset>
            <div className="form-actions">
              <Button disabled={busy}>Сохранить статус</Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setEditing(null)}
              >
                Отмена
              </Button>
            </div>
          </form>
        </SettingsDialog>
      )}
      <div className="status-directory">
        {statuses.map((status) => (
          <article
            key={status.code}
            className={`status-directory__row status-color--${status.color}`}
          >
            <i />
            <div>
              <strong>{status.name}</strong>
              <code>{status.code}</code>
            </div>
            <Badge tone={status.active ? "success" : "neutral"}>
              {status.active ? "Активен" : "Отключён"}
            </Badge>
            <Button variant="quiet" onClick={() => setEditing(status)}>
              Изменить
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Services({
  services,
  reload,
}: {
  services: Service[];
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  return (
    <section className="settings-surface">
      <header>
        <div>
          <span className="overline">Справочник услуг</span>
          <h2>{services.length} позиций</h2>
        </div>
        <Button onClick={() => setEditing(null)}>Добавить услугу +</Button>
      </header>
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
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td>
                  <code>{s.code}</code>
                </td>
                <td>
                  {units.find(([v]) => v === s.billing_mode)?.[1] ||
                    s.billing_mode}
                </td>
                <td>
                  <Badge tone={s.active ? "success" : "neutral"}>
                    {s.active ? "Активна" : "Отключена"}
                  </Badge>
                </td>
                <td>
                  <Button variant="quiet" onClick={() => setEditing(s)}>
                    Изменить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
          required
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
  const visible = tariffs.filter((t) => !service || t.service_code === service);
  return (
    <section className="settings-surface">
      <header>
        <div>
          <span className="overline">Тарифы</span>
          <h2>Финансовые правила</h2>
        </div>
        <Button onClick={() => setEditing(null)}>Добавить тариф +</Button>
      </header>
      <div className="tariff-filter">
        <Select
          label="Услуга"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="">Все услуги</option>
          {services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {editing !== undefined && (
        <SettingsDialog
          title={editing ? "Изменить тариф" : "Новый тариф"}
          copy="Настройте направление, единицу, ставку и период действия."
          onClose={() => setEditing(undefined)}
        >
          <TariffForm
            item={editing}
            services={services}
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
              <th>Направление</th>
              <th>Единица</th>
              <th>Тариф</th>
              <th>Срочность</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>
                  {services.find((s) => s.code === t.service_code)?.name ||
                    t.service_code}
                </td>
                <td>
                  {[t.source_language, t.target_language]
                    .filter(Boolean)
                    .join(" → ") || t.direction}
                </td>
                <td>{units.find(([v]) => v === t.unit)?.[1] || t.unit}</td>
                <td>
                  <strong>{Number(t.amount).toLocaleString("ru-RU")} ₽</strong>
                </td>
                <td>×{Number(t.urgency_multiplier)}</td>
                <td>
                  <Badge tone={t.active ? "success" : "neutral"}>
                    {t.active ? "Активен" : "Отключён"}
                  </Badge>
                </td>
                <td>
                  <Button variant="quiet" onClick={() => setEditing(t)}>
                    Изменить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="crm-empty">
          Тарифов пока нет. Архитектура готова: добавляйте только подтверждённые
          значения.
        </p>
      )}
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
    urgency_multiplier: String(item?.urgency_multiplier ?? 1.5),
    native_multiplier: String(item?.native_multiplier ?? 1),
    active_from: item?.active_from || "",
    active_to: item?.active_to || "",
    active: item?.active ?? true,
    notes: item?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
          urgency_multiplier: Number(f.urgency_multiplier),
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
          onChange={(e) => setF({ ...f, service_code: e.target.value })}
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
          {units.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          label="Язык с"
          value={f.source_language}
          onChange={(e) => setF({ ...f, source_language: e.target.value })}
        />
        <Input
          label="Язык на"
          value={f.target_language}
          onChange={(e) => setF({ ...f, target_language: e.target.value })}
        />
        <Input
          label="Направление"
          value={f.direction}
          onChange={(e) => setF({ ...f, direction: e.target.value })}
        />
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
        <Input
          label="Коэф. срочности"
          type="number"
          min="1"
          step="0.01"
          value={f.urgency_multiplier}
          onChange={(e) => setF({ ...f, urgency_multiplier: e.target.value })}
        />
        <Input
          label="Коэф. носителя"
          type="number"
          min="1"
          step="0.01"
          value={f.native_multiplier}
          onChange={(e) => setF({ ...f, native_multiplier: e.target.value })}
        />
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
  const [editing, setEditing] = useState<PricingRule | null | undefined>(
    undefined,
  );
  return (
    <section className="settings-surface">
      <header>
        <div>
          <span className="overline">Правила расчёта</span>
          <h2>Скидки и коэффициенты</h2>
        </div>
        <Button onClick={() => setEditing(null)}>Добавить правило +</Button>
      </header>
      {editing !== undefined && (
        <SettingsDialog
          title={editing ? "Изменить правило" : "Новое правило"}
          copy="Задайте область применения, диапазон и финансовое действие."
          onClose={() => setEditing(undefined)}
        >
          <RuleForm
            item={editing}
            services={services}
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
              <th>Правило</th>
              <th>Услуга</th>
              <th>Диапазон</th>
              <th>Скидка</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <strong>{rule.name}</strong>
                  <br />
                  <code>{rule.code}</code>
                </td>
                <td>
                  {services.find((s) => s.code === rule.service_code)?.name ||
                    rule.service_code ||
                    "Все"}
                </td>
                <td>
                  {rule.threshold_from ?? "—"} — {rule.threshold_to ?? "∞"}
                </td>
                <td>{Number(rule.percent)}%</td>
                <td>
                  <Badge tone={rule.active ? "success" : "neutral"}>
                    {rule.active ? "Активно" : "Отключено"}
                  </Badge>
                </td>
                <td>
                  <Button variant="quiet" onClick={() => setEditing(rule)}>
                    Изменить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
          required
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
