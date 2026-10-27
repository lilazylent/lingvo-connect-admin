"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatRate, formatRateUnit } from "@/lib/billing-format";
import { Badge, Button, Input, LoadingState, Select } from "./ui";
import { Icon } from "./icons";
import { LanguageCombobox } from "./language-combobox";

type Money = string | number;
type ServiceDefinition = {
  fields: string[];
  billing_unit: string;
  default_variant?: string;
  variant_label?: string;
  variants?: Record<string, { label: string; billing_unit: string; fields: string[] }>;
};
type Service = { code: string; name: string; billing_mode: string; active: boolean; definition?: ServiceDefinition | null };
type ClientTariff = {
  id: string;
  service_code: string;
  variant: string;
  source_language: string;
  target_language: string;
  quantity_from: Money;
  amount: Money;
  notes: string;
};
type PricingData = { pricing_mode: "STANDARD" | "CLIENT"; client_discount_percent: Money; items: ClientTariff[] };
type Draft = { id?: string; service_code: string; variant: string; source_language: string; target_language: string; quantity_from: string; amount: string; notes: string };

const emptyDraft: Draft = { service_code: "", variant: "", source_language: "", target_language: "", quantity_from: "1", amount: "", notes: "" };

function variantOf(service: Service | undefined, variant: string) {
  const variants = service?.definition?.variants;
  if (!variants) return "";
  return variants[variant] ? variant : service?.definition?.default_variant || Object.keys(variants)[0] || "";
}
function unitOf(service: Service | undefined, variant: string) {
  const definition = service?.definition;
  const selected = definition?.variants?.[variantOf(service, variant)];
  return selected?.billing_unit || definition?.billing_unit || service?.billing_mode || "CUSTOM";
}
function hasLanguages(service: Service | undefined) {
  const fields = service?.definition?.fields;
  return !fields || fields.includes("source_language") || fields.includes("target_language");
}

/** Client price list: its own rates per service, optional language pair and quantity ladder. */
export function ClientTariffsPanel({ clientId, disabled }: { clientId: string; disabled: boolean }) {
  const [data, setData] = useState<PricingData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState({ pricing_mode: "STANDARD", client_discount_percent: "0" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((result: PricingData) => {
    setData(result);
    setSettings({ pricing_mode: result.pricing_mode, client_discount_percent: String(Number(result.client_discount_percent || 0)) });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<PricingData>(`/api/admin/companies/${clientId}/tariffs`, { signal: controller.signal }),
      api<Service[]>("/api/admin/crm/services?active=true", { signal: controller.signal }),
    ])
      .then(([pricing, catalog]) => { apply(pricing); setServices(catalog.filter((item) => item.active)); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить тарифы клиента"); });
    return () => controller.abort();
  }, [apply, clientId]);

  const serviceByCode = useMemo(() => new Map(services.map((item) => [item.code, item])), [services]);
  const describe = (item: ClientTariff) => {
    const service = serviceByCode.get(item.service_code);
    const variant = service?.definition?.variants?.[item.variant]?.label;
    const languages = item.source_language || item.target_language ? `${item.source_language || "любой"} → ${item.target_language || "любой"}` : "";
    return [service?.name || item.service_code, variant, languages].filter(Boolean).join(" · ");
  };

  async function run(action: () => Promise<PricingData>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      apply(await action());
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveSettings = () => run(() => api<PricingData>(`/api/admin/companies/${clientId}/pricing`, {
    method: "PUT",
    body: JSON.stringify({ pricing_mode: settings.pricing_mode, client_discount_percent: Number(settings.client_discount_percent || 0) }),
  }), "Настройки тарифов сохранены");

  async function saveDraft() {
    if (!draft) return;
    const service = serviceByCode.get(draft.service_code);
    if (!service) return setError("Выберите услугу");
    if (draft.amount === "" || Number(draft.amount) < 0) return setError("Укажите цену");
    const body = JSON.stringify({
      service_code: draft.service_code,
      variant: variantOf(service, draft.variant),
      source_language: hasLanguages(service) ? draft.source_language : "",
      target_language: hasLanguages(service) ? draft.target_language : "",
      quantity_from: Number(draft.quantity_from || 1),
      amount: Number(draft.amount),
      notes: draft.notes,
    });
    const ok = await run(() => api<PricingData>(
      draft.id ? `/api/admin/companies/${clientId}/tariffs/${draft.id}` : `/api/admin/companies/${clientId}/tariffs`,
      { method: draft.id ? "PATCH" : "POST", body },
    ), draft.id ? "Тариф обновлён" : "Тариф добавлен");
    if (ok) setDraft(null);
  }

  const remove = (item: ClientTariff) => {
    if (!confirm(`Удалить тариф «${describe(item)}»? Уже созданные заказы сохранят свои цены.`)) return;
    void run(() => api<PricingData>(`/api/admin/companies/${clientId}/tariffs/${item.id}`, { method: "DELETE" }), "Тариф удалён");
  };

  if (!data) return error ? <p className="field-error" role="alert">{error}</p> : <LoadingState label="Загрузка тарифов клиента" />;

  const draftService = draft ? serviceByCode.get(draft.service_code) : undefined;
  const draftUnit = unitOf(draftService, draft?.variant || "");
  return <section className="directory-detail-section client-tariffs" aria-label="Тарифы клиента">
    <div className="directory-detail-section__title"><Icon name="wallet" size={17} /><strong>Тарифы клиента</strong></div>
    <div className="client-tariffs__settings">
      <Select label="Тарифы по умолчанию" value={settings.pricing_mode} disabled={busy || disabled} onChange={(e) => setSettings({ ...settings, pricing_mode: e.target.value })}>
        <option value="STANDARD">Стандартные тарифы компании</option>
        <option value="CLIENT">Тарифы этого клиента</option>
      </Select>
      <Input label="Скидка клиента, %" hint="Например, за внесённый депозит; применяется к тарифам клиента" type="number" min="0" max="100" step="0.5" value={settings.client_discount_percent} disabled={busy || disabled} onChange={(e) => setSettings({ ...settings, client_discount_percent: e.target.value })} />
      <Button variant="secondary" disabled={busy || disabled} onClick={() => void saveSettings()}>Сохранить</Button>
    </div>
    <p className="directory-muted client-tariffs__hint">
      В заказе этого клиента в списке тарифов появится «Тариф клиента». При режиме «Тарифы этого клиента» он подставляется сам, стандартные тарифы остаются доступны.
    </p>

    <div className="client-tariffs__list">
      {data.items.length ? data.items.map((item) => <div key={item.id} className="client-tariffs__row">
        <div>
          <b>{describe(item)}</b>
          <span>{Number(item.quantity_from) > 1 ? `от ${Number(item.quantity_from)} ${formatRateUnit(unitOf(serviceByCode.get(item.service_code), item.variant)).replace("₽/", "")}` : "любой объём"}{item.notes ? ` · ${item.notes}` : ""}</span>
        </div>
        <Badge tone="info">{formatRate(item.amount, unitOf(serviceByCode.get(item.service_code), item.variant))}</Badge>
        <div className="client-tariffs__row-actions">
          <Button variant="quiet" disabled={busy || disabled} onClick={() => setDraft({ id: item.id, service_code: item.service_code, variant: item.variant, source_language: item.source_language, target_language: item.target_language, quantity_from: String(Number(item.quantity_from)), amount: String(Number(item.amount)), notes: item.notes })}>Изменить</Button>
          <Button variant="quiet" disabled={busy || disabled} onClick={() => remove(item)}>Удалить</Button>
        </div>
      </div>) : <p className="directory-muted">Своих тарифов нет — для клиента действуют стандартные тарифы.</p>}
    </div>

    {draft ? <div className="client-tariffs__form" role="group" aria-label={draft.id ? "Изменение тарифа клиента" : "Новый тариф клиента"}>
      <Select label="Услуга" value={draft.service_code} onChange={(e) => setDraft({ ...draft, service_code: e.target.value, variant: variantOf(serviceByCode.get(e.target.value), "") })}>
        <option value="">Выберите услугу</option>
        {services.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </Select>
      {draftService?.definition?.variants && <Select label={draftService.definition.variant_label || "Способ расчёта"} value={variantOf(draftService, draft.variant)} onChange={(e) => setDraft({ ...draft, variant: e.target.value })}>
        {Object.entries(draftService.definition.variants).map(([value, variant]) => <option key={value} value={value}>{variant.label}</option>)}
      </Select>}
      {draftService && hasLanguages(draftService) && <>
        <LanguageCombobox label="Язык оригинала (необязательно)" value={draft.source_language} onChange={(value) => setDraft({ ...draft, source_language: value })} />
        <LanguageCombobox label="Язык перевода (необязательно)" value={draft.target_language} onChange={(value) => setDraft({ ...draft, target_language: value })} />
      </>}
      <Input label={`Цена, ${formatRateUnit(draftUnit)}`} type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
      <Input label="Действует от количества" hint="Для цены от объёма: например, от 5 документов" type="number" min="1" step="1" value={draft.quantity_from} onChange={(e) => setDraft({ ...draft, quantity_from: e.target.value })} />
      <Input label="Комментарий" placeholder="Например, паспорта" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      <div className="client-tariffs__form-actions">
        <Button disabled={busy} onClick={() => void saveDraft()}>{busy ? "Сохраняем…" : draft.id ? "Сохранить тариф" : "Добавить тариф"}</Button>
        <Button variant="quiet" disabled={busy} onClick={() => setDraft(null)}>Отмена</Button>
      </div>
    </div> : <Button variant="secondary" disabled={busy || disabled} onClick={() => { setNotice(""); setDraft({ ...emptyDraft }); }}><Icon name="plus" size={16} /> Добавить тариф</Button>}

    {error && <p className="field-error" role="alert">{error}</p>}
    {notice && !error && <p className="directory-muted" role="status">{notice}</p>}
  </section>;
}
