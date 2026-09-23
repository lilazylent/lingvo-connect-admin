"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiDownloadUrl } from "@/lib/api";
import type { UserSummary } from "@/lib/types";
import {
  ActionMenu,
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "./ui";
import { CrmLookup } from "./crm-lookup";
import { LanguageCombobox } from "./language-combobox";
import { OrderRecords } from "./crm-order-records";
import { Icon, Pictogram } from "./icons";

type Money = string | number;
type ClientDepositPreview = { company_id: string; balance: Money; transactions: unknown[] };
type Page<T> = { items: T[]; total: number; page: number; pages: number };
type ServiceDefinition = {
  category: string;
  fields: string[];
  billing_unit: string;
  allowed_billing_units: string[];
  page_from_characters: boolean;
  matching_mode: "LANGUAGE_PAIR" | "SOURCE_LANGUAGE" | "SERVICE_ONLY";
  supports_routing: boolean;
  default_variant?: string;
  variants?: Record<string, { label: string; billing_unit: string; fields: string[] }>;
};
type Service = {
  id: string;
  code: string;
  name: string;
  billing_mode: string;
  active: boolean;
  definition?: ServiceDefinition | null;
};
type Order = {
  id: string;
  number: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
  manager_id: string | null;
  application_id: string | null;
  deadline: string | null;
  status: string;
  notes: string;
  version: number;
  archived: boolean;
  created_at: string;
  client_name?: string;
  contact_name?: string;
  manager_name?: string;
  financial?: Financial;
};
type ExecutorAssignment = {
  id: string;
  executor_id: string;
  executor_name: string;
  character_count: number | null;
  page_count: Money | null;
  document_count: number | null;
  duration_seconds: number | null;
  hour_count: Money | null;
  billing_unit: string;
  rate: Money;
  auto_cost: Money;
  cost: Money;
  cost_overridden: boolean;
  deadline: string | null;
  deadline_time: string;
  status: string;
  notes: string;
  route_stage_index: number | null;
  route_source_language: string;
  route_target_language: string;
};

type Work = {
  id: string;
  service_code: string;
  work_type: string;
  source_language: string;
  target_language: string;
  tariff_ids: string;
  topic: string;
  urgent: boolean;
  urgency_multiplier: Money;
  native_speaker: boolean;
  discount_percent: Money;
  discount_overridden: boolean;
  character_count: number | null;
  page_count: Money | null;
  word_count: number | null;
  document_count: number | null;
  duration_seconds: number | null;
  hour_count: Money | null;
  start_date: string | null;
  start_time: string;
  certification_mode: string;
  billing_unit: string;
  client_rate: Money;
  auto_price: Money;
  price: Money;
  price_overridden: boolean;
  price_override_reason: string;
  client_billable: boolean;
  executor_id: string | null;
  executor_rate: Money;
  executor_billing_unit: string;
  executor_auto_cost: Money;
  executor_cost: Money;
  executor_cost_overridden: boolean;
  deadline: string | null;
  deadline_time: string;
  executor_deadline: string | null;
  executor_deadline_time: string;
  status: string;
  notes: string;
  version: number;
  sort_order: number;
  executor_assignments: ExecutorAssignment[];
};
type Payment = {
  id: string;
  amount_due: Money;
  amount_paid: Money;
  payment_method: string;
  invoice_number: string;
  invoice_date: string | null;
  paid_at: string | null;
  notes: string;
  version: number;
};
type OrderDetail = Order & {
  works: Work[];
  payment: Payment | null;
  files: OrderFile[];
  financial: Financial;
  client_name: string;
  contact_name: string;
  manager_name: string;
};
type FinanceExecutorAssignment = {
  assignment_id: string;
  executor_id: string;
  executor_name: string;
  route_stage_index: number | null;
  route_source_language: string;
  route_target_language: string;
  character_count: number | null;
  page_count: Money | null;
  document_count: number | null;
  duration_seconds: number | null;
  hour_count: Money | null;
  billing_unit: string;
  rate: Money;
  auto_cost: Money;
  cost: Money;
  cost_overridden: boolean;
  amount_paid: Money;
  deadline: string | null;
  status: string;
};
type FinanceWorkBreakdown = {
  work_id: string;
  service_code: string;
  source_language: string;
  target_language: string;
  client_price: Money;
  client_billable: boolean;
  executor_cost: Money;
  legacy_cost: boolean;
  assignments: FinanceExecutorAssignment[];
};
type Financial = {
  revenue: Money;
  executor_cost: Money;
  profit: Money;
  margin_percent: Money;
  client_paid: Money;
  client_debt: Money;
  executor_assignment_count?: number;
  executor_breakdown?: FinanceWorkBreakdown[];
};
type OrderFile = {
  id: string;
  original_name: string;
  page_count: number | null;
  character_count: number | null;
  word_count: number | null;
  analysis_status: string;
  analysis_note: string;
  created_at: string;
};
type Analysis = {
  page_count: number | null;
  character_count: number | null;
  word_count: number | null;
  analysis_status: string;
  analysis_note: string;
};

type ExecutorCandidate = {
  executor_id: string;
  executor_name: string;
  service_code: string;
  service_name: string;
  matched_pair: {
    source_language: string;
    target_language: string;
    bidirectional: boolean;
  };
  default_rate: Money;
  rate_unit: string;
  availability: {
    state: string;
    start_date: string | null;
    end_date: string | null;
    notes: string;
  };
  candidate_state: "AVAILABLE" | "UNKNOWN" | "UNAVAILABLE";
  deadline_compatible: boolean | null;
};
type ExecutorRouteStage = {
  index: number;
  source_language: string;
  target_language: string;
  candidates: ExecutorCandidate[];
  counts: { available: number; unknown: number; unavailable: number; total: number };
};
type ExecutorCandidateResponse = {
  order_id: string | null;
  work: {
    id: string | null;
    service_code: string;
    service_name: string;
    source_language: string;
    target_language: string;
    deadline: string | null;
    executor_deadline: string | null;
  };
  match_type: "DIRECT";
  matching_mode: "LANGUAGE_PAIR" | "SOURCE_LANGUAGE" | "SERVICE_ONLY";
  matchable: boolean;
  missing_fields: string[];
  required_date: string | null;
  required_date_source: string | null;
  candidates: ExecutorCandidate[];
  counts: { available: number; unknown: number; unavailable: number; total: number };
  direct_viable: boolean;
  routed_match: {
    eligible: boolean;
    via_language: string | null;
    reason: string | null;
    complete: boolean;
    stages: ExecutorRouteStage[];
  };
};

type TariffComponent = {
  tariff_id: string;
  source_language: string;
  target_language: string;
  direction: string;
  rate: Money;
  unit: string;
};
type TariffOption = {
  key: string;
  tariff_ids: string[];
  resolution: string;
  rate: Money;
  unit: string;
  amount: Money;
  quantity: Money;
  base_amount: Money;
  surcharge_multiplier: Money;
  before_discount: Money;
  discount_percent: Money;
  discount_amount: Money;
  source_language: string;
  target_language: string;
  directions: string[];
  components: TariffComponent[];
  discount_name?: string | null;
  is_auto: boolean;
};
type DraftExecutorAssignment = {
  key: string;
  id?: string;
  executor_id: string;
  character_count: string;
  page_count: string;
  document_count: string;
  duration_seconds: string;
  hour_count: string;
  billing_unit: string;
  rate: string;
  cost: string;
  manualCost: boolean;
  deadline: string;
  deadline_time: string;
  status: string;
  notes: string;
  route_stage_index?: number | null;
  route_source_language?: string;
  route_target_language?: string;
};

type DraftWork = {
  key: string;
  service_code: string;
  work_type: string;
  source_language: string;
  target_language: string;
  tariff_ids: string[];
  topic: string;
  urgent: boolean;
  urgency_multiplier: string;
  native_speaker: boolean;
  manualDiscount: boolean;
  discount_percent: string;
  character_count: string;
  page_count: string;
  word_count: string;
  document_count: string;
  duration_seconds: string;
  hour_count: string;
  start_date: string;
  start_time: string;
  certification_mode: string;
  billing_unit: string;
  client_rate: string;
  price: string;
  manualPrice: boolean;
  client_billable: boolean;
  executor_id: string;
  executor_rate: string;
  executor_billing_unit: string;
  executor_cost: string;
  manualExecutorCost: boolean;
  deadline: string;
  deadline_time: string;
  executor_deadline: string;
  executor_deadline_time: string;
  status: string;
  notes: string;
  quoteAmount: string;
  quoteBeforeDiscount: string;
  quoteAutoDiscount: string;
  quoteRate: string;
  quoteUnit: string;
  quoteMessage: string;
  executor_assignments: DraftExecutorAssignment[];
};

export const workTypes = [
  ["written_translation", "Письменный перевод"],
  ["interpreting", "Устный перевод"],
  ["certification", "Заверение"],
  ["localization", "Локализация"],
  ["audio_video", "Аудио и видео"],
  ["linguistic_support", "Лингвистическое сопровождение"],
  ["editing", "Редактура"],
  ["proofreading", "Корректура"],
  ["layout", "Вёрстка"],
] as const;

const orderStatuses = [
  ["NEW", "Новый"],
  ["ESTIMATING", "В расчёте"],
  ["APPROVED", "Согласован"],
  ["IN_PROGRESS", "В работе"],
  ["REVIEW", "На проверке"],
  ["READY", "Готов"],
  ["DELIVERED", "Выдан"],
  ["COMPLETED", "Завершён"],
  ["CANCELLED", "Отменён"],
] as const;
type StatusOption = {
  code: string;
  name: string;
  color: string;
  board: "MAIN" | "ARCHIVE";
  active: boolean;
  sort_order: number;
};
const fallbackStatuses: StatusOption[] = orderStatuses.map(
  ([code, name], index) => ({
    code,
    name,
    color: [
      "blue",
      "violet",
      "cyan",
      "amber",
      "violet",
      "green",
      "cyan",
      "green",
      "rose",
    ][index],
    board: code === "CANCELLED" ? "ARCHIVE" : "MAIN",
    active: true,
    sort_order: (index + 1) * 10,
  }),
);
const workStatuses = [
  ["NEW", "Новая"],
  ["IN_PROGRESS", "В работе"],
  ["REVIEW", "На проверке"],
  ["COMPLETED", "Готово"],
  ["CANCELLED", "Отменена"],
] as const;
const billingUnits = [
  ["CONDITIONAL_PAGE", "Усл. страница / 1800 знаков"],
  ["PER_1000_CHARS", "За 1000 знаков"],
  ["PER_PAGE", "За страницу"],
  ["PER_DOCUMENT", "За документ"],
  ["PER_SECOND", "За секунду"],
  ["PER_MINUTE", "За минуту"],
  ["HOURLY", "За час"],
  ["FIXED", "Фиксированная"],
  ["PERCENT_OF_BASE_SERVICE", "Процент от базовой услуги"],
  ["CUSTOM", "Своя единица"],
] as const;
const statusLabel = (
  status: string,
  options: StatusOption[] = fallbackStatuses,
) => options.find((option) => option.code === status)?.name ?? status;
const rub = (value: Money | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
const orderCreatedDate = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU");
const billingUnitLabel = (unit: string) =>
  billingUnits.find(([value]) => value === unit)?.[1] ?? unit;
const billingQuantityLabel = (unit: string, quantity: number) => {
  const formatted = quantity.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  if (unit === "CONDITIONAL_PAGE") return `${formatted} усл. стр.`;
  if (unit === "PER_1000_CHARS") return `${formatted} тыс. знаков`;
  if (unit === "PER_PAGE") return `${formatted} стр.`;
  if (unit === "PER_DOCUMENT") return `${formatted} док.`;
  if (unit === "PER_SECOND") return `${formatted} сек.`;
  if (unit === "PER_MINUTE") return `${formatted} мин.`;
  if (unit === "HOURLY") return `${formatted} ч.`;
  if (unit === "FIXED") return "1 услуга";
  return formatted;
};
const activeServiceFields = (service: Service | undefined, certificationMode = "") => {
  const definition = service?.definition;
  if (!definition) return new Set<string>();
  const fields = new Set(definition.fields);
  if (service?.code === "company_certification" && definition.variants) {
    fields.delete("document_count");
    fields.delete("page_count");
    const variant = definition.variants[certificationMode || definition.default_variant || "BOUND"];
    variant?.fields.forEach((field) => fields.add(field));
  }
  return fields;
};
const serviceHasField = (service: Service | undefined, field: string, certificationMode = "") =>
  !service?.definition || activeServiceFields(service, certificationMode).has(field);
const serviceBillingUnit = (service: Service | undefined, certificationMode = "") => {
  const definition = service?.definition;
  if (!definition) return service?.billing_mode || "CUSTOM";
  if (service?.code === "company_certification" && definition.variants) {
    const variant = definition.variants[certificationMode || definition.default_variant || "BOUND"];
    if (variant?.billing_unit) return variant.billing_unit;
  }
  return definition.billing_unit || service?.billing_mode || "CUSTOM";
};
const draftWorkDirectionLabel = (work: DraftWork) => {
  if (work.source_language && work.target_language) return `${work.source_language} → ${work.target_language}`;
  if (work.source_language) return `Язык: ${work.source_language}`;
  return "Без языковой пары";
};
const draftWorkVolumeLabel = (work: DraftWork) => {
  const unit = work.billing_unit;
  const quantity = numericQuantity(unit, work);
  if (quantity > 0) return billingQuantityLabel(unit, quantity);
  return "Объём не указан";
};
const workDirectionLabel = (work: Work) => {
  if (work.source_language && work.target_language) return `${work.source_language} → ${work.target_language}`;
  if (work.source_language) return `Язык: ${work.source_language}`;
  return "Без языковой пары";
};
const workVolumeLabel = (work: Work) => {
  const quantity = numericQuantity(work.billing_unit, work);
  if (quantity > 0) return billingQuantityLabel(work.billing_unit, quantity);
  if (work.word_count) return `${Number(work.word_count).toLocaleString("ru-RU")} слов`;
  return "Объём не указан";
};
const workTimingLabel = (work: DraftWork | Work) => {
  const start = [work.start_date, work.start_time].filter(Boolean).join(" ");
  const end = [work.deadline, work.deadline_time].filter(Boolean).join(" ");
  if (start && end) return `${start} → ${end}`;
  return end || start || "Срок не указан";
};
const executorVolumeLabel = (assignment: FinanceExecutorAssignment) => {
  if (assignment.character_count)
    return `${Number(assignment.character_count).toLocaleString("ru-RU")} зн.`;
  if (assignment.document_count)
    return `${Number(assignment.document_count).toLocaleString("ru-RU")} док.`;
  if (assignment.duration_seconds)
    return `${Number(assignment.duration_seconds).toLocaleString("ru-RU")} сек.`;
  if (assignment.hour_count)
    return `${Number(assignment.hour_count).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ч.`;
  if (assignment.page_count)
    return `${Number(assignment.page_count).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} стр.`;
  return "Объём не указан";
};
const tariffOptionLabel = (service: Service | undefined, option: TariffOption) => {
  const matchingMode = service?.definition?.matching_mode;
  const scope =
    matchingMode === "SERVICE_ONLY"
      ? service?.name || "По услуге"
      : matchingMode === "SOURCE_LANGUAGE"
        ? option.source_language || "Язык не указан"
        : `${option.source_language || "Любой"} → ${option.target_language || "Любой"}`;
  const resolution =
    option.resolution === "via_russian"
      ? " · через русский"
      : option.resolution === "native_speaker"
        ? " · носитель"
        : "";
  const recommended = option.is_auto ? " · рекомендован" : "";
  return `${scope} · ${rub(option.rate)} · ${billingUnits.find(([unit]) => unit === option.unit)?.[1] || option.unit}${resolution}${recommended}`;
};

const tariffMessage = (option: TariffOption, automatic = option.is_auto) => {
  const quantity = Number(option.quantity ?? 0);
  const multiplier = Number(option.surcharge_multiplier ?? 1);
  const discount = Number(option.discount_percent ?? 0);
  const route =
    option.resolution === "via_russian"
      ? "через русский"
      : option.resolution === "native_speaker"
        ? "носитель"
        : option.source_language || option.target_language
          ? "по языковой паре"
          : "по услуге";
  const components =
    option.resolution === "via_russian" && option.components?.length
      ? ` · ${option.components.map((item) => `${item.source_language || "Русский"} → ${item.target_language}: ${rub(item.rate)}`).join(" + ")}`
      : "";
  return `${automatic ? "Тариф подобран CRM" : "Тариф выбран менеджером"}: ${rub(option.rate)} × ${billingQuantityLabel(option.unit, quantity)}${multiplier > 1 ? ` × ${multiplier} срочность` : ""}${discount > 0 ? ` − ${discount}% скидка` : ""} · ${route}${components}`;
};
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const conditionalPages = (value: string | number | null | undefined) => {
  const chars = Number(value || 0);
  if (!chars) return "";
  // Oleg's matrix: 1800 characters with spaces = 1 conditional page;
  // values are rounded upward to one decimal and the billable/display minimum is 1 page.
  return String(Math.max(1, Math.ceil((chars / 1800) * 10) / 10));
};
const numericQuantity = (
  unit: string,
  values: {
    character_count?: string | number | null;
    page_count?: string | number | null;
    document_count?: string | number | null;
    duration_seconds?: string | number | null;
    hour_count?: string | number | null;
  },
) => {
  if (unit === "CONDITIONAL_PAGE")
    return values.character_count
      ? Number(conditionalPages(values.character_count))
      : Number(values.page_count || 0);
  if (unit === "PER_1000_CHARS") return Number(values.character_count || 0) / 1000;
  if (unit === "PER_PAGE") return Number(values.page_count || 0);
  if (unit === "PER_DOCUMENT") return Number(values.document_count || 0);
  if (unit === "PER_SECOND") return Number(values.duration_seconds || 0);
  if (unit === "PER_MINUTE") return Number(values.duration_seconds || 0) / 60;
  if (unit === "HOURLY") return Number(values.hour_count || 0);
  if (unit === "FIXED") return 1;
  return Number(values.page_count || values.document_count || values.hour_count || 0);
};
const resetQuotePatch = {
  tariff_ids: [] as string[],
  client_rate: "0",
  quoteAmount: "",
  quoteBeforeDiscount: "",
  quoteAutoDiscount: "",
  quoteRate: "",
  quoteUnit: "",
  quoteMessage: "",
};
const serviceFieldPatch = (work: DraftWork, service: Service | undefined): Partial<DraftWork> => {
  if (!service) {
    return {
      service_code: "",
      work_type: "written_translation",
      billing_unit: "CUSTOM",
      certification_mode: "",
      ...resetQuotePatch,
    };
  }
  const definition = service.definition;
  const defaultVariant = service.code === "company_certification"
    ? definition?.default_variant || "BOUND"
    : "";
  const fields = activeServiceFields(service, defaultVariant);
  const keep = (field: string) => !definition || fields.has(field);
  return {
    service_code: service.code,
    work_type: service.code,
    billing_unit: serviceBillingUnit(service, defaultVariant),
    executor_billing_unit: serviceBillingUnit(service, defaultVariant),
    certification_mode: defaultVariant,
    executor_assignments: [],
    executor_id: "",
    source_language: keep("source_language") ? work.source_language : "",
    target_language: keep("target_language") ? work.target_language : "",
    topic: keep("topic") ? work.topic : "",
    character_count: keep("character_count") ? work.character_count : "",
    page_count: keep("page_count") ? work.page_count : "",
    document_count: keep("document_count") ? work.document_count : "",
    duration_seconds: keep("duration_seconds") ? work.duration_seconds : "",
    hour_count: keep("hour_count") ? work.hour_count : "",
    start_date: keep("start_date") ? work.start_date : "",
    start_time: keep("start_time") ? work.start_time : "",
    deadline: keep("deadline") ? work.deadline : "",
    deadline_time: keep("deadline_time") ? work.deadline_time : "",
    urgent: keep("markup") ? work.urgent : false,
    native_speaker: keep("translator_type") ? work.native_speaker : false,
    manualDiscount: keep("discount") ? work.manualDiscount : false,
    discount_percent: keep("discount") ? work.discount_percent : "0",
    ...resetQuotePatch,
  };
};
const emptyAssignment = (): DraftExecutorAssignment => ({
  key: newKey(),
  executor_id: "",
  character_count: "",
  page_count: "",
  document_count: "",
  duration_seconds: "",
  hour_count: "",
  billing_unit: "CONDITIONAL_PAGE",
  rate: "0",
  cost: "0",
  manualCost: false,
  deadline: "",
  deadline_time: "",
  status: "NEW",
  notes: "",
  route_stage_index: null,
  route_source_language: "",
  route_target_language: "",
});
const emptyWork = (): DraftWork => ({
  key: newKey(),
  service_code: "",
  work_type: "written_translation",
  source_language: "",
  target_language: "",
  tariff_ids: [],
  topic: "",
  urgent: false,
  urgency_multiplier: "1",
  native_speaker: false,
  manualDiscount: false,
  discount_percent: "0",
  character_count: "",
  page_count: "",
  word_count: "",
  document_count: "",
  duration_seconds: "",
  hour_count: "",
  start_date: "",
  start_time: "",
  certification_mode: "",
  billing_unit: "CUSTOM",
  client_rate: "0",
  price: "0",
  manualPrice: false,
  client_billable: true,
  executor_id: "",
  executor_rate: "0",
  executor_billing_unit: "CUSTOM",
  executor_cost: "0",
  manualExecutorCost: false,
  deadline: "",
  deadline_time: "",
  executor_deadline: "",
  executor_deadline_time: "",
  status: "NEW",
  notes: "",
  quoteAmount: "",
  quoteBeforeDiscount: "",
  quoteAutoDiscount: "",
  quoteRate: "",
  quoteUnit: "",
  quoteMessage: "",
  executor_assignments: [],
});

function assignmentPrice(assignment: DraftExecutorAssignment) {
  const rate = Number(assignment.rate || 0);
  const quantity = numericQuantity(assignment.billing_unit, assignment);
  return Math.round(quantity * rate * 100) / 100;
}

function executorMatchingLockReason(draft: DraftWork, persisted: Work | undefined): string | undefined {
  if (!persisted) return "Сохраните работу перед подбором исполнителя.";
  const draftService = (draft.service_code || draft.work_type || "").trim();
  const persistedService = (persisted.service_code || persisted.work_type || "").trim();
  const changed =
    draftService !== persistedService ||
    draft.source_language.trim() !== (persisted.source_language || "").trim() ||
    draft.target_language.trim() !== (persisted.target_language || "").trim() ||
    draft.executor_deadline !== (persisted.executor_deadline || "") ||
    draft.deadline !== (persisted.deadline || "");
  return changed
    ? "Услуга, языковая пара или срок изменены. Сначала сохраните работу, затем обновите подбор."
    : undefined;
}

function localPrice(work: DraftWork, executor = false) {
  if (!executor && !work.manualPrice && work.quoteAmount && Number(work.client_rate || 0) === 0) {
    if (!work.manualDiscount) return Number(work.quoteAmount);
    const beforeDiscount = Number(work.quoteBeforeDiscount || work.quoteAmount);
    const manualDiscount = Number(work.discount_percent || 0);
    return Math.round(beforeDiscount * (1 - manualDiscount / 100) * 100) / 100;
  }
  const unit = executor ? work.executor_billing_unit : work.billing_unit;
  const rate = Number(executor ? work.executor_rate : work.client_rate) || 0;
  const quantity = numericQuantity(unit, work);
  let result = quantity * rate;
  if (!executor && work.urgent) result *= Number(work.urgency_multiplier || 1);
  if (!executor && work.manualDiscount) result *= 1 - Number(work.discount_percent || 0) / 100;
  return Math.round(result * 100) / 100;
}


export function CrmOrders() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Page<Order> | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [overdue, setOverdue] = useState("");
  const [paid, setPaid] = useState("");
  const [language, setLanguage] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"table" | "kanban">("table");
  const [statusOptions, setStatusOptions] =
    useState<StatusOption[]>(fallbackStatuses);
  const [wizard, setWizard] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({ total: 0, active: 0, completed: 0, awaiting: 0, overdue: 0 });
  const applicationId = searchParams.get("application_id") ?? "";
  const openId = searchParams.get("open") ?? "";

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        status,
        archived: String(archived),
        page: String(page),
        page_size: "100",
      });
      if (overdue) params.set("overdue", overdue);
      if (paid) params.set("paid", paid);
      if (language) params.set("language", language);
      if (executorId) params.set("executor_id", executorId);
      const metricBase = new URLSearchParams({ archived: "false", page: "1", page_size: "1", q: "" });
      const [result, activeRows, completedRows, awaitingRows, overdueRows] = await Promise.all([
        api<Page<Order>>(`/api/admin/crm/orders?${params.toString()}`),
        api<Page<Order>>(`/api/admin/crm/orders?${new URLSearchParams({ ...Object.fromEntries(metricBase), status: "IN_PROGRESS" }).toString()}`),
        api<Page<Order>>(`/api/admin/crm/orders?${new URLSearchParams({ ...Object.fromEntries(metricBase), status: "COMPLETED" }).toString()}`),
        api<Page<Order>>(`/api/admin/crm/orders?${new URLSearchParams({ ...Object.fromEntries(metricBase), paid: "false" }).toString()}`),
        api<Page<Order>>(`/api/admin/crm/orders?${new URLSearchParams({ ...Object.fromEntries(metricBase), overdue: "true" }).toString()}`),
      ]);
      setData(result);
      setMetrics({ total: result.total, active: activeRows.total, completed: completedRows.total, awaiting: awaitingRows.total, overdue: overdueRows.total });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказы");
    }
  }, [query, status, archived, overdue, paid, language, executorId, page]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    api<StatusOption[]>("/api/admin/crm/order-statuses")
      .then((rows) => {
        if (rows.length) setStatusOptions(rows);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (applicationId) setWizard(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applicationId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (openId) setSelectedId(openId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openId]);

  const currentBoard = archived ? "ARCHIVE" : "MAIN";
  const boardStatusOptions = statusOptions.filter(
    (option) => option.active && option.board === currentBoard,
  );

  return (
    <>
      <header className="page-head page-head--compact crm-orders-head">
        <div>
          <span className="overline overline--accent">Лингво Коннект / Заказы</span>
          <h1>Заказы</h1>
          <p>Управляйте всеми заказами, сроками, исполнителями, оплатами и файлами в одном рабочем центре.</p>
        </div>
        <Button
          onClick={() => {
            setSelectedId(null);
            setWizard(true);
          }}
        >
          <Icon name="plus" size={17} /> Новый заказ
        </Button>
      </header>
      <section className="lc-module-metrics lc-module-metrics--5" aria-label="Сводка по заказам">
        <OrderMetric icon="orders" tone="pink" value={metrics.total} label="Всего заказов" />
        <OrderMetric icon="clock" tone="blue" value={metrics.active} label="В работе" />
        <OrderMetric icon="shield" tone="green" value={metrics.completed} label="Завершено" />
        <OrderMetric icon="wallet" tone="orange" value={metrics.awaiting} label="Ждут оплаты" />
        <OrderMetric icon="hourglass" tone="violet" value={metrics.overdue} label="Просрочено" />
      </section>
      {error && <ErrorState message={error} />}
      <section className="phase5-orders-command" aria-label="Поиск и фильтры заказов">
        <div className="phase5-orders-filters">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              void load();
            }}
            className="phase5-orders-search"
          >
            <Input
              label="Поиск"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="№ заказа или клиент"
            />
            <Button variant="secondary">Найти</Button>
          </form>
          <Select
            label="Статус"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все статусы</option>
            {boardStatusOptions
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
          </Select>
          <Input
            label="Язык"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setPage(1);
            }}
            placeholder="Русский / English"
          />
          <CrmLookup
            label="Исполнитель"
            path="/api/admin/executors?archived=false"
            value={executorId}
            onChange={(id) => {
              setExecutorId(id);
              setPage(1);
            }}
            placeholder="Любой исполнитель"
          />
          <Select
            label="Срок"
            value={overdue}
            onChange={(e) => {
              setOverdue(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все сроки</option>
            <option value="true">Просроченные</option>
            <option value="false">Не просроченные</option>
          </Select>
          <Select
            label="Оплата"
            value={paid}
            onChange={(e) => {
              setPaid(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Любая оплата</option>
            <option value="true">Оплачено</option>
            <option value="false">Есть долг</option>
          </Select>
        </div>
        <div className="phase5-orders-viewbar">
          <label className="archive-toggle">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setStatus("");
                setPage(1);
              }}
            />
            <span className="archive-toggle__box" />
            <span className="archive-toggle__label">Архив</span>
          </label>
          <div
            className="view-switch"
            role="group"
            aria-label="Представление заказов"
          >
            <button
              type="button"
              className={mode === "table" ? "is-active" : ""}
              onClick={() => setMode("table")}
            >
              Таблица
            </button>
            <button
              type="button"
              className={mode === "kanban" ? "is-active" : ""}
              onClick={() => setMode("kanban")}
            >
              Kanban
            </button>
          </div>
        </div>
      </section>
      {wizard && (
        <OrderWizard
          applicationId={applicationId}
          statuses={statusOptions}
          onClose={() => setWizard(false)}
          onCreated={(id) => {
            setWizard(false);
            setSelectedId(id);
            void load();
          }}
        />
      )}
      {selectedId && (
        <OrderCard
          key={selectedId}
          orderId={selectedId}
          statuses={statusOptions}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
      {!data ? (
        <LoadingState label="Загружаем заказы" />
      ) : mode === "table" ? (
        <OrdersTable
          data={data}
          statuses={statusOptions}
          page={page}
          setPage={setPage}
          select={setSelectedId}
        />
      ) : (
        <OrdersKanban
          orders={data.items}
          statuses={statusOptions}
          archived={archived}
          select={setSelectedId}
          onChanged={load}
        />
      )}
    </>
  );
}

function OrderMetric({ icon, tone, value, label }: { icon: Parameters<typeof Icon>[0]["name"]; tone: string; value: number; label: string }) {
  return <div className={`lc-module-metric lc-module-metric--${tone}`}><span><Pictogram name={icon} size={19} /></span><strong>{value}</strong><b>{label}</b></div>;
}

function OrderStageGlyph({ index, state }: { index: number; state: "current" | "completed" | "future" }) {
  return <span className="order-stage__glyph" data-stage-glyph-state={state} aria-hidden="true">
    <svg className="order-stage__dial" viewBox="0 0 36 36" focusable="false">
      <circle className="order-stage__dial-track" cx="18" cy="18" r="14.5" pathLength="100" />
      <circle className="order-stage__dial-progress" cx="18" cy="18" r="14.5" pathLength="100" />
    </svg>
    <span className="order-stage__index">{String(index).padStart(2, "0")}</span>
  </span>;
}


function OrdersTable({
  data,
  statuses,
  page,
  setPage,
  select,
}: {
  data: Page<Order>;
  statuses: StatusOption[];
  page: number;
  setPage: (n: number) => void;
  select: (id: string) => void;
}) {
  return (
    <section className="table-surface crm-order-table">
      <div className="table-caption">Всего заказов: {data.total}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Клиент</th>
              <th>Дедлайн</th>
              <th>Статус</th>
              <th>Оплата</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    className="crm-record-link"
                    onClick={() => select(o.id)}
                  >
                    {o.number}
                  </button>
                  <small className="order-created-date">Создан {orderCreatedDate(o.created_at)}</small>
                </td>
                <td>
                  <strong>{o.client_name || "Клиент не указан"}</strong>
                </td>
                <td>{o.deadline || "—"}</td>
                <td>
                  <Badge
                    tone={
                      o.status === "COMPLETED"
                        ? "success"
                        : o.deadline &&
                            o.deadline < new Date().toISOString().slice(0, 10)
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {statusLabel(o.status, statuses)}
                  </Badge>
                </td>
                <td>
                  {o.financial ? (
                    <span className={Number(o.financial.client_debt) > 0 ? "order-debt is-open" : "order-debt is-paid"}>
                      {Number(o.financial.client_debt) > 0
                        ? `Долг ${rub(o.financial.client_debt)}`
                        : "Оплачено"}
                    </span>
                  ) : "—"}
                </td>
                <td>
                  <Button variant="quiet" onClick={() => select(o.id)}>
                    Открыть →
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && <p className="crm-empty">Заказов пока нет.</p>}
      <div className="pagination">
        <Button
          variant="quiet"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Назад
        </Button>
        <span>
          {page} / {data.pages}
        </span>
        <Button
          variant="quiet"
          disabled={page >= data.pages}
          onClick={() => setPage(page + 1)}
        >
          Далее →
        </Button>
      </div>
    </section>
  );
}

function OrdersKanban({
  orders,
  statuses,
  archived,
  select,
  onChanged,
}: {
  orders: Order[];
  statuses: StatusOption[];
  archived: boolean;
  select: (id: string) => void;
  onChanged: () => void;
}) {
  const board = archived ? "ARCHIVE" : "MAIN";
  const visible = statuses
    .filter((status) => status.active && status.board === board)
    .sort((a, b) => a.sort_order - b.sort_order);
  const [moving, setMoving] = useState("");
  async function move(id: string, status: string) {
    if (!id || moving) return;
    setMoving(id);
    try {
      await api(`/api/admin/crm/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await onChanged();
    } finally {
      setMoving("");
    }
  }
  return (
    <section className="kanban-board">
      {visible.map((status) => {
        const value = status.code;
        return (
          <div
            className={`kanban-column status-color--${status.color}`}
            key={value}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void move(e.dataTransfer.getData("text/order-id"), value);
            }}
          >
            <header>
              <strong>{status.name}</strong>
              <span>{orders.filter((o) => o.status === value).length}</span>
            </header>
            <div className="kanban-stack">
              {orders
                .filter((o) => o.status === value)
                .map((o) => (
                  <article
                    key={o.id}
                    className={`kanban-card ${moving === o.id ? "is-moving" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/order-id", o.id);
                    }}
                  >
                    <button
                      className="kanban-card__main"
                      onClick={() => select(o.id)}
                    >
                      <span>{o.number}</span>
                      <small className="order-created-date">Создан {orderCreatedDate(o.created_at)}</small>
                      <strong>{o.client_name || "Клиент не указан"}</strong>
                      <small>
                        {o.deadline ? `Срок ${o.deadline}` : "Срок не указан"}
                      </small>
                      {o.financial && Number(o.financial.client_debt) > 0 && (
                        <small className="kanban-card__debt">Долг {rub(o.financial.client_debt)}</small>
                      )}
                    </button>
                    <Select
                      label="Сменить статус"
                      hideLabel
                      value={o.status}
                      onChange={(e) => void move(o.id, e.target.value)}
                    >
                      {statuses
                        .filter((s) => (s.active && s.board === board) || s.code === o.status)
                        .map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                    </Select>
                  </article>
                ))}
              {!orders.some((o) => o.status === value) && (
                <p className="kanban-empty">Перетащите заказ сюда</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function OrderWizard({
  applicationId,
  statuses,
  onClose,
  onCreated,
}: {
  applicationId: string;
  statuses: StatusOption[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [client, setClient] = useState("");
  const [contact, setContact] = useState("");
  const [manager, setManager] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("NEW");
  const [works, setWorks] = useState<DraftWork[]>([emptyWork()]);
  const [services, setServices] = useState<Service[]>([]);
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [payment, setPayment] = useState({
    amount_paid: "0",
    payment_method: "",
    invoice_number: "",
    invoice_date: "",
    paid_at: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderNumberPreview, setOrderNumberPreview] = useState("");
  const [clientDeposit, setClientDeposit] = useState<ClientDepositPreview | null>(null);
  const [tariffOptions, setTariffOptions] = useState<
    Record<string, TariffOption[]>
  >({});
  useEffect(() => {
    api<Service[]>("/api/admin/crm/services?active=true")
      .then(setServices)
      .catch((e) => setError(e.message));
    api<UserSummary[]>("/api/admin/applications/managers")
      .then(setManagers)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!applicationId) return;
    api<{
      name: string;
      number: string;
      message: string;
      internal_summary: string | null;
      desired_date: string | null;
      responsible_manager: UserSummary | null;
    }>(`/api/admin/applications/${applicationId}`)
      .then((a) => {
        setNotes(a.internal_summary || a.message);
        setManager(a.responsible_manager?.id || "");
        if (a.desired_date)
          setWorks((ws) =>
            ws.map((w, i) =>
              i === 0 ? { ...w, deadline: a.desired_date || "" } : w,
            ),
          );
      })
      .catch((e) => setError(e.message));
  }, [applicationId]);
  const draftExecutionYear = useMemo(() => {
    const years = works
      .map((work) => (work.deadline ? Number(work.deadline.slice(0, 4)) : 0))
      .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 9999);
    return years.length ? Math.max(...years) : null;
  }, [works]);
  useEffect(() => {
    let controller: AbortController | undefined;
    const timer = window.setTimeout(() => {
      if (!client) {
        setClientDeposit(null);
        return;
      }
      controller = new AbortController();
      api<ClientDepositPreview>(`/api/admin/companies/${client}/deposit?limit=1`, { signal: controller.signal })
        .then(setClientDeposit)
        .catch(() => setClientDeposit(null));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [client]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (draftExecutionYear) params.set("execution_year", String(draftExecutionYear));
    const suffix = params.size ? `?${params.toString()}` : "";
    api<{ number: string; reserved: boolean }>(`/api/admin/crm/orders/number-preview${suffix}`)
      .then((result) => setOrderNumberPreview(result.number))
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось получить номер нового заказа"));
  }, [draftExecutionYear]);
  const clientTotal = useMemo(
    () =>
      works.reduce(
        (sum, w) =>
          sum + (w.client_billable ? (w.manualPrice ? Number(w.price || 0) : localPrice(w)) : 0),
        0,
      ),
    [works],
  );
  const paidAmount = Math.max(0, Number(payment.amount_paid || 0) || 0);
  const remainingTotal = Math.max(0, clientTotal - paidAmount);
  const depositBalance = Math.max(0, Number(clientDeposit?.balance || 0) || 0);
  const depositApplied = Math.min(depositBalance, remainingTotal);
  const depositAfterOrder = Math.max(0, depositBalance - depositApplied);
  const remainingAfterDeposit = Math.max(0, remainingTotal - depositApplied);
  const executorTotal = useMemo(
    () =>
      works.reduce(
        (sum, w) =>
          sum +
          (w.executor_assignments.length
            ? w.executor_assignments.reduce(
                (assignmentSum, assignment) =>
                  assignmentSum +
                  (assignment.manualCost
                    ? Number(assignment.cost || 0)
                    : assignmentPrice(assignment)),
                0,
              )
            : w.manualExecutorCost
              ? Number(w.executor_cost || 0)
              : localPrice(w, true)),
        0,
      ),
    [works],
  );
  const patchWork = (key: string, patch: Partial<DraftWork>) =>
    setWorks((items) =>
      items.map((w) => (w.key === key ? { ...w, ...patch } : w)),
    );
  async function resolveTariff(work: DraftWork) {
    if (!work.service_code) {
      setTariffOptions((current) => ({ ...current, [work.key]: [] }));
      patchWork(work.key, {
        tariff_ids: [],
        quoteAmount: "",
        quoteBeforeDiscount: "",
        quoteAutoDiscount: "",
        quoteRate: "",
        quoteUnit: "",
        quoteMessage:
          "Услугу можно выбрать позже — автотариф пока не применяется.",
      });
      return;
    }
    try {
      const result = await api<{ options: TariffOption[]; auto_key: string; resolution?: string; message?: string }>(
        "/api/admin/crm/pricing/options",
        {
          method: "POST",
          body: JSON.stringify({
            service_code: work.service_code,
            source_language: work.source_language,
            target_language: work.target_language,
            character_count: work.character_count
              ? Number(work.character_count)
              : null,
            page_count: work.page_count ? Number(work.page_count) : null,
            document_count: work.document_count ? Number(work.document_count) : null,
            duration_seconds: work.duration_seconds ? Number(work.duration_seconds) : null,
            hour_count: work.hour_count ? Number(work.hour_count) : null,
            certification_mode: work.certification_mode,
            urgent: work.urgent,
            urgency_multiplier: Number(work.urgency_multiplier || 1),
            native_speaker: work.native_speaker,
          }),
        },
      );
      setTariffOptions((current) => ({
        ...current,
        [work.key]: result.options,
      }));
      const currentKey = work.tariff_ids.join(",");
      const selected =
        result.options.find((option) => option.key === currentKey) ||
        result.options.find((option) => option.key === result.auto_key) ||
        result.options[0];
      if (selected)
        patchWork(work.key, {
          tariff_ids: selected.tariff_ids,
          quoteAmount: String(selected.amount ?? 0),
          quoteBeforeDiscount: String(selected.before_discount ?? selected.amount ?? 0),
          quoteAutoDiscount: String(selected.discount_percent ?? 0),
          discount_percent: work.manualDiscount
            ? work.discount_percent
            : String(selected.discount_percent ?? 0),
          quoteRate: String(selected.rate ?? 0),
          quoteUnit: selected.unit || work.billing_unit,
          quoteMessage: tariffMessage(selected),
        });
      else
        patchWork(work.key, {
          tariff_ids: [],
          quoteAmount: "",
          quoteBeforeDiscount: "",
          quoteAutoDiscount: "",
          quoteRate: "",
          quoteUnit: "",
          quoteMessage:
            result.message || "Тариф по запросу / автоматический тариф не найден. Можно указать ставку вручную.",
        });
    } catch (e) {
      setTariffOptions((current) => ({ ...current, [work.key]: [] }));
      patchWork(work.key, {
        tariff_ids: [],
        quoteAmount: "",
        quoteBeforeDiscount: "",
        quoteAutoDiscount: "",
        quoteRate: "",
        quoteUnit: "",
        quoteMessage:
          e instanceof Error ? e.message : "Не удалось подобрать тариф",
      });
    }
  }
  async function analyze(next: File) {
    setFile(next);
    setAnalyzing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("upload", next);
      const result = await api<Analysis>(
        "/api/admin/crm/files/analyze-preview",
        { method: "POST", body: form },
      );
      setAnalysis(result);
      setWorks((ws) =>
        ws.map((w, i) =>
          i === 0
            ? (() => {
                const service = services.find((item) => item.code === w.service_code);
                const canUseCharacters = serviceHasField(service, "character_count", w.certification_mode);
                const canUsePages = serviceHasField(service, "page_count", w.certification_mode);
                const character_count = canUseCharacters
                  ? result.character_count?.toString() ?? w.character_count
                  : w.character_count;
                return {
                  ...w,
                  character_count,
                  page_count: canUsePages
                    ? service?.definition?.page_from_characters && character_count
                      ? conditionalPages(character_count)
                      : result.page_count?.toString() ?? w.page_count
                    : w.page_count,
                  word_count: result.word_count?.toString() ?? w.word_count,
                };
              })()
            : w,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось проанализировать документ",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        client_id: client || null,
        contact_id: contact || null,
        manager_id: manager || null,
        application_id: applicationId || null,
        status,
        notes,
        works: works.map((w) => ({
          service_code: w.service_code,
          work_type: w.work_type,
          source_language: w.source_language,
          target_language: w.target_language,
          tariff_ids: w.tariff_ids,
          topic: w.topic,
          urgent: w.urgent,
          urgency_multiplier: Number(w.urgency_multiplier || 1),
          native_speaker: w.native_speaker,
          discount_percent: w.manualDiscount ? Number(w.discount_percent || 0) : null,
          character_count: w.character_count ? Number(w.character_count) : null,
          page_count: w.page_count ? Number(w.page_count) : null,
          word_count: w.word_count ? Number(w.word_count) : null,
          document_count: w.document_count ? Number(w.document_count) : null,
          duration_seconds: w.duration_seconds ? Number(w.duration_seconds) : null,
          hour_count: w.hour_count ? Number(w.hour_count) : null,
          start_date: w.start_date || null,
          start_time: w.start_time,
          certification_mode: w.certification_mode,
          billing_unit: w.billing_unit,
          client_rate: Number(w.client_rate || 0),
          price: w.manualPrice ? Number(w.price || 0) : null,
          price_override_reason: w.manualPrice
            ? "Ручная корректировка менеджером"
            : "",
          client_billable: w.client_billable,
          executor_id: w.executor_id || null,
          executor_rate: Number(w.executor_rate || 0),
          executor_billing_unit: w.executor_billing_unit,
          executor_cost: w.manualExecutorCost
            ? Number(w.executor_cost || 0)
            : null,
          deadline: w.deadline || null,
          deadline_time: w.deadline_time,
          executor_deadline: w.executor_deadline || null,
          executor_deadline_time: w.executor_deadline_time,
          executor_assignments: w.executor_assignments.filter((assignment) => assignment.executor_id).map((assignment) => ({
            id: assignment.id,
            executor_id: assignment.executor_id,
            character_count: assignment.character_count ? Number(assignment.character_count) : null,
            page_count: assignment.page_count ? Number(assignment.page_count) : null,
            document_count: assignment.document_count ? Number(assignment.document_count) : null,
            duration_seconds: assignment.duration_seconds ? Number(assignment.duration_seconds) : null,
            hour_count: assignment.hour_count ? Number(assignment.hour_count) : null,
            billing_unit: assignment.billing_unit,
            rate: Number(assignment.rate || 0),
            cost: assignment.manualCost ? Number(assignment.cost || 0) : null,
            deadline: assignment.deadline || null,
            deadline_time: assignment.deadline_time,
            route_stage_index: assignment.route_stage_index ?? null,
            route_source_language: assignment.route_source_language || "",
            route_target_language: assignment.route_target_language || "",
            status: assignment.status,
            notes: assignment.notes,
          })),
          status: w.status,
          notes: w.notes,
        })),
        payment: {
          ...payment,
          amount_paid: Number(payment.amount_paid || 0),
          invoice_date: payment.invoice_date || null,
          paid_at: payment.paid_at || null,
        },
      };
      const created = await api<OrderDetail>("/api/admin/crm/orders/wizard", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (file) {
        const form = new FormData();
        form.append("upload", file);
        await api(`/api/admin/crm/orders/${created.id}/files/analyze`, {
          method: "POST",
          body: form,
        });
      }
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать заказ");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (step !== 4) return;
    works.forEach((w) => {
      if (
        w.service_code &&
        !w.manualPrice &&
        !w.quoteAmount &&
        Number(w.client_rate || 0) === 0
      )
        void resolveTariff(w);
    });
    // Calculation is intentionally triggered only when the review step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const canNext = true;
  return (
    <section className="crm-wizard">
      <header className="crm-wizard__head">
        <div>
          <span className="overline">Новый заказ{orderNumberPreview ? ` · ${orderNumberPreview}` : ""}</span>
          <h2>Регистрация заказа</h2>
          <p>Шесть коротких шагов вместо одной длинной формы.</p>
        </div>
        <Button variant="quiet" onClick={onClose}>
          Закрыть
        </Button>
      </header>
      {error && <ErrorState message={error} />}
      <nav className="wizard-steps">
        {[
          "Клиент",
          "Работы",
          "Документы",
          "Расчёт",
          "Исполнители",
          "Проверка",
        ].map((label, i) => (
          <button
            key={label}
            className={
              step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""
            }
            onClick={() => setStep(i + 1)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="wizard-panel">
        {step === 1 && (
          <div className="wizard-grid">
            <div className="wizard-draft-note">
              Можно перейти дальше и создать заказ с любым объёмом известной
              информации — недостающие данные редактируются позже.
            </div>
            <CrmLookup
              label="Найти клиента"
              placeholder="Имя, компания, телефон или email"
              path="/api/admin/companies"
              value={client}
              onChange={(id) => {
                setClient(id);
                setContact("");
              }}
            />
            {client && (
              <CrmLookup
                label="Контактное лицо"
                placeholder="Имя, должность, телефон или email"
                path={`/api/admin/companies/${client}/representatives`}
                value={contact}
                onChange={setContact}
              />
            )}
            <Select
              label="Ответственный"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">Не назначен</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </Select>
            <Select
              label="Статус"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses
                .filter((s) => s.active && s.board === "MAIN")
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Textarea
              label="Внутренний комментарий"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Link className="client-directory-action" href="/admin/clients">
              ＋ Быстро добавить клиента в справочник ↗
            </Link>
          </div>
        )}
        {step === 2 && (
          <div className="wizard-work-list">
            {works.map((w, index) => (
              <WorkDraft
                key={w.key}
                work={w}
                index={index}
                services={services}
                patch={(p) => patchWork(w.key, p)}
                remove={() =>
                  setWorks((items) => items.filter((x) => x.key !== w.key))
                }
              />
            ))}
            {!works.length && (
              <div className="wizard-empty-work">
                <strong>Работы пока не добавлены</strong>
                <span>
                  Заказ можно создать и без работ — добавите их позже в
                  карточке.
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => setWorks((items) => [...items, emptyWork()])}
            >
              Добавить работу +
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="document-step">
            <label className="file-drop">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.xlsx,.xlsm,image/*"
                onChange={(e) =>
                  e.target.files?.[0] && void analyze(e.target.files[0])
                }
              />
              <span>Прикрепить документ клиента</span>
              <strong>
                {file?.name || "PDF, DOCX, TXT, XLSX или изображение"}
              </strong>
            </label>
            {analyzing && <LoadingState label="Анализируем документ" />}
            {analysis && (
              <div className="analysis-result">
                <div>
                  <span>Страниц</span>
                  <strong>{analysis.page_count ?? "—"}</strong>
                </div>
                <div>
                  <span>Знаков</span>
                  <strong>
                    {analysis.character_count?.toLocaleString("ru-RU") ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Слов</span>
                  <strong>
                    {analysis.word_count?.toLocaleString("ru-RU") ?? "—"}
                  </strong>
                </div>
                <p>{analysis.analysis_note}</p>
              </div>
            )}
            <p className="context-note">
              Если значение нельзя определить надёжно, CRM не придумывает его.
              Объём можно вручную исправить в каждой работе.
            </p>
          </div>
        )}
        {step === 4 && (
          <div className="pricing-step">
            {works.map((w, i) => {
              const service = services.find((item) => item.code === w.service_code);
              const options = tariffOptions[w.key] || [];
              const selectedKey = w.tariff_ids.join(",");
              const selected = options.find(
                (option) => option.key === selectedKey,
              );
              return (
                <article key={w.key} className="price-row">
                  <header>
                    <strong>
                      {i + 1}.{" "}
                      {services.find((s) => s.code === w.service_code)?.name ||
                        "Услуга не указана"}
                    </strong>
                    <span>
                      {!w.client_billable ? "Внутренняя работа · " : ""}{draftWorkDirectionLabel(w)} · {draftWorkVolumeLabel(w)}
                    </span>
                  </header>
                  <div className="price-row__fields price-row__fields--tariff">
                    <div className="pricing-field pricing-field--tariff">
                      <Select
                        label="Тариф"
                        value={selectedKey}
                        onChange={(e) => {
                          const option = options.find(
                            (item) => item.key === e.target.value,
                          );
                          if (option)
                            patchWork(w.key, {
                              tariff_ids: option.tariff_ids,
                              quoteAmount: String(option.amount),
                              quoteBeforeDiscount: String(option.before_discount ?? option.amount),
                              quoteAutoDiscount: String(option.discount_percent ?? 0),
                              discount_percent: w.manualDiscount
                                ? w.discount_percent
                                : String(option.discount_percent ?? 0),
                              quoteRate: String(option.rate),
                              quoteUnit: option.unit,
                              client_rate: "0",
                              quoteMessage: tariffMessage(option, false),
                            });
                        }}
                      >
                        <option value="">
                          {options.length
                            ? "Выберите тариф"
                            : "Подходящих тарифов нет"}
                        </option>
                        {options.map((option) => (
                          <option
                            key={option.key}
                            value={option.key}
                          >{tariffOptionLabel(service, option)}</option>
                        ))}
                      </Select>
                    </div>
                    {selected ? (
                      <>
                        <div className="pricing-field pricing-field--unit">
                          <span className="field__label">Единица тарифа</span>
                          <div className="calculated-value">
                            <strong>
                              {billingUnits.find(
                                ([unit]) => unit === selected.unit,
                              )?.[1] || selected.unit}
                            </strong>
                            <small>По выбранному тарифу</small>
                          </div>
                        </div>
                        <div className="pricing-field pricing-field--rate">
                          <span className="field__label">Ставка по тарифу</span>
                          <div className="calculated-value">
                            <strong>{rub(selected.rate)}</strong>
                            <small>За единицу тарифа</small>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pricing-field pricing-field--unit">
                          {service?.definition ? (
                            <>
                              <span className="field__label">Единица тарифа</span>
                              <div className="calculated-value">
                                <strong>{billingUnitLabel(serviceBillingUnit(service, w.certification_mode))}</strong>
                                <small>Определяется выбранной услугой</small>
                              </div>
                            </>
                          ) : (
                            <Select
                              label="Единица тарифа"
                              value={w.billing_unit}
                              onChange={(e) => patchWork(w.key, { billing_unit: e.target.value, ...resetQuotePatch })}
                            >
                              {billingUnits.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </Select>
                          )}
                        </div>
                        <div className="pricing-field pricing-field--rate">
                          <Input
                            label="Ставка вручную"
                            type="number"
                            min="0"
                            step="0.01"
                            value={w.client_rate}
                            onChange={(e) =>
                              patchWork(w.key, {
                                client_rate: e.target.value,
                                tariff_ids: [],
                                quoteAmount: "",
                                quoteBeforeDiscount: "",
                                quoteAutoDiscount: "",
                                quoteMessage: "",
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                    <div className="pricing-field">
                      <span className="field__label">Ручной итог</span>
                      <label className="manual-switch manual-switch--feature manual-switch--compact">
                        <input
                          type="checkbox"
                          checked={w.manualPrice}
                          onChange={(e) =>
                            patchWork(w.key, {
                              manualPrice: e.target.checked,
                              price: String(localPrice(w)),
                            })
                          }
                        />
                        <span>
                          <b>{w.manualPrice ? "Включён" : "Выключен"}</b>
                          <small>
                            {w.manualPrice
                              ? "Итог задаёт менеджер"
                              : "Расчёт выполняет CRM"}
                          </small>
                        </span>
                      </label>
                    </div>
                    <div className="pricing-field">
                      <span className="field__label">
                        {w.manualPrice ? "Итог вручную" : "Авторасчёт"}
                      </span>
                      {w.manualPrice ? (
                        <input
                          aria-label="Итог вручную, ₽"
                          className="input pricing-inline-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={w.price}
                          onChange={(e) =>
                            patchWork(w.key, { price: e.target.value })
                          }
                        />
                      ) : (
                        <div className="calculated-value calculated-value--total">
                          <strong>{rub(localPrice(w))}</strong>
                          <small>Итог по работе</small>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tariff-resolution">
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => void resolveTariff(w)}
                    >
                      Обновить подбор
                    </Button>
                    <span>
                      {w.quoteMessage ||
                        "CRM подберёт тариф по услуге, языковой паре и параметрам работы."}
                    </span>
                  </div>
                </article>
              );
            })}
            <div className="wizard-total">
              <div>
                <span>Итоговая стоимость заказа</span>
                <small>{rub(clientTotal)}</small>
              </div>
              <div>
                <span>Уже оплачено</span>
                <small>{rub(paidAmount)}</small>
              </div>
              <div className="wizard-total__primary">
                <span>Остаток к оплате</span>
                <strong>{rub(remainingTotal)}</strong>
              </div>
            </div>
            {client && <div className="client-deposit-preview">
              <div><span>Депозит клиента</span><strong>{rub(depositBalance)}</strong></div>
              <div><span>Будет списано из депозита</span><strong>{rub(depositApplied)}</strong></div>
              <div><span>Останется на депозите</span><strong>{rub(depositAfterOrder)}</strong></div>
              <div className="client-deposit-preview__remaining"><span>Останется к оплате</span><strong>{rub(remainingAfterDeposit)}</strong></div>
            </div>}
            <div className="wizard-grid">
              <Input
                label="Уже оплачено, ₽"
                type="number"
                min="0"
                step="0.01"
                value={payment.amount_paid}
                onChange={(e) =>
                  setPayment({ ...payment, amount_paid: e.target.value })
                }
              />
              <Select
                label="Способ оплаты"
                value={payment.payment_method}
                onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}
              >
                <option value="">Не выбран</option>
                <option value="cash">Наличные</option>
                <option value="cashless">Безналичный расчёт</option>
                <option value="deposit">Депозит</option>
              </Select>
              <Input
                label="№ счёта"
                value={payment.invoice_number}
                onChange={(e) =>
                  setPayment({ ...payment, invoice_number: e.target.value })
                }
              />
              <Input
                label="Дата счёта"
                type="date"
                value={payment.invoice_date}
                onChange={(e) =>
                  setPayment({ ...payment, invoice_date: e.target.value })
                }
              />
              <Input
                label="Дата оплаты"
                type="date"
                value={payment.paid_at}
                onChange={(e) =>
                  setPayment({ ...payment, paid_at: e.target.value })
                }
              />
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="executor-step">
            {works.map((w, i) => (
              <article className="executor-row" key={w.key}>
                <header>
                  <strong>
                    {i + 1}. {services.find((s) => s.code === w.service_code)?.name || "Услуга не указана"}
                  </strong>
                  <span>{w.client_billable ? `Стоимость для клиента: ${rub(w.manualPrice ? Number(w.price) : localPrice(w))}` : "Не учитывается в расчёте клиента"}</span>
                </header>
                <ExecutorAssignmentsEditor
                  work={w}
                  service={services.find((item) => item.code === w.service_code)}
                  onChange={(executor_assignments) =>
                    patchWork(w.key, { executor_assignments })
                  }
                  matching={{ preview: true, workId: w.key, autoLoad: true }}
                />
              </article>
            ))}
          </div>
        )}
        {step === 6 && (
          <div className="review-step">
            <div className="review-hero">
              <div>
                <span>Клиент</span>
                <strong>{client ? "Выбран" : "Можно уточнить позже"}</strong>
              </div>
              <div>
                <span>Работ</span>
                <strong>{works.length}</strong>
              </div>
              <div>
                <span>Стоимость для клиента</span>
                <strong>{rub(clientTotal)}</strong>
              </div>
              <div>
                <span>Выплаты исполнителям</span>
                <strong>{rub(executorTotal)}</strong>
              </div>
              <div>
                <span>Прибыль</span>
                <strong>{rub(clientTotal - executorTotal)}</strong>
              </div>
              <div>
                <span>Маржинальность</span>
                <strong>
                  {clientTotal
                    ? `${Math.round(((clientTotal - executorTotal) / clientTotal) * 1000) / 10}%`
                    : "0%"}
                </strong>
              </div>
              {client && <>
                <div>
                  <span>Депозит клиента</span>
                  <strong>{rub(depositBalance)}</strong>
                </div>
                <div>
                  <span>После заказа</span>
                  <strong>{rub(depositAfterOrder)}</strong>
                </div>
              </>}
            </div>
            {client && depositApplied > 0 && <p className="context-note">При создании заказа из депозита автоматически спишется {rub(depositApplied)}. Остаток к оплате после депозита: {rub(remainingAfterDeposit)}.</p>}
            <div className="review-list">
              {works.map((w, i) => (
                <div key={w.key}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {services.find((s) => s.code === w.service_code)?.name ||
                        "Услуга не указана"}
                    </strong>
                    <small>
                      {draftWorkDirectionLabel(w)} · {draftWorkVolumeLabel(w)} · {workTimingLabel(w)}
                    </small>
                  </div>
                  <b>{w.client_billable ? rub(w.manualPrice ? Number(w.price) : localPrice(w)) : "Внутренняя работа"}</b>
                </div>
              ))}
            </div>
            <div className="review-submit-zone">
              {file && (
                <p className="context-note">
                  Файл «{file.name}» будет загружен и проанализирован после
                  создания заказа.
                </p>
              )}
              <Button disabled={busy} onClick={() => void create()}>
                {busy ? "Создаём заказ…" : "Создать заказ"}
              </Button>
            </div>
          </div>
        )}
      </div>
      <footer className="wizard-footer">
        <Button
          variant="quiet"
          disabled={step === 1 || busy}
          onClick={() => setStep(step - 1)}
        >
          ← Назад
        </Button>
        <span>Шаг {step} из 6</span>
        {step < 6 && (
          <Button disabled={!canNext || busy} onClick={() => setStep(step + 1)}>
            Продолжить →
          </Button>
        )}
      </footer>
    </section>
  );
}

function WorkDraft({
  work,
  index,
  services,
  patch,
  remove,
}: {
  work: DraftWork;
  index: number;
  services: Service[];
  patch: (p: Partial<DraftWork>) => void;
  remove: () => void;
}) {
  const service = services.find((s) => s.code === work.service_code);
  const definition = service?.definition;
  const fields = activeServiceFields(service, work.certification_mode);
  const has = (field: string) => !definition || fields.has(field);
  const pageFromCharacters = Boolean(definition?.page_from_characters);
  const clearQuote = () => resetQuotePatch;
  const patchQuantity = (payload: Partial<DraftWork>) => patch({ ...payload, ...clearQuote() });

  return (
    <article className="work-draft service-driven-work-draft">
      <header>
        <div>
          <span className="overline">Работа {String(index + 1).padStart(2, "0")}</span>
          <strong>{service?.name || "Новая работа"}</strong>
        </div>
        <Button variant="quiet" onClick={remove}>Удалить</Button>
      </header>

      <div className={`wizard-grid service-driven-grid${service?.code === "written_translation" ? " service-driven-grid--written" : ""}`}>
        <div className="work-field work-field--service"><Select
          label="Услуга"
          value={work.service_code}
          onChange={(e) => {
            const nextService = services.find((item) => item.code === e.target.value);
            patch(serviceFieldPatch(work, nextService));
          }}
        >
          <option value="">Выберите услугу</option>
          {services.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </Select></div>

        {!service && (
          <div className="service-form-intro" role="note">
            <strong>Сначала выберите услугу</strong>
            <span>После выбора CRM покажет только те поля, которые нужны именно для этой работы.</span>
          </div>
        )}

        {service && has("certification_mode") && (
          <Select
            label="Вариант заверения"
            value={work.certification_mode || definition?.default_variant || "BOUND"}
            onChange={(e) => {
              const mode = e.target.value;
              const nextFields = activeServiceFields(service, mode);
              patch({
                certification_mode: mode,
                billing_unit: serviceBillingUnit(service, mode),
                document_count: nextFields.has("document_count") ? work.document_count : "",
                page_count: nextFields.has("page_count") ? work.page_count : "",
                ...resetQuotePatch,
              });
            }}
          >
            {Object.entries(definition?.variants || {}).map(([value, variant]) => (
              <option key={value} value={value}>{variant.label}</option>
            ))}
          </Select>
        )}

        {service && has("source_language") && (
          <div className="work-field work-field--source"><LanguageCombobox
            label={definition?.matching_mode === "SOURCE_LANGUAGE" ? "Язык" : "Язык оригинала"}
            value={work.source_language}
            onChange={(value) => patch({ source_language: value, ...resetQuotePatch })}
          /></div>
        )}
        {service && has("target_language") && (
          <div className="work-field work-field--target"><LanguageCombobox
            label="Язык перевода"
            value={work.target_language}
            onChange={(value) => patch({ target_language: value, ...resetQuotePatch })}
          /></div>
        )}
        {service && has("character_count") && (
          <div className="work-field work-field--chars"><Input
            label="Количество знаков"
            hint={pageFromCharacters ? "Страницы рассчитываются автоматически: 1800 знаков = 1 страница" : undefined}
            type="number"
            min="0"
            value={work.character_count}
            onChange={(e) => {
              const character_count = e.target.value;
              patchQuantity({
                character_count,
                page_count: pageFromCharacters && character_count ? conditionalPages(character_count) : work.page_count,
              });
            }}
          /></div>
        )}
        {service && has("page_count") && (
          <div className="work-field work-field--pages"><Input
            label={pageFromCharacters ? "Количество страниц · авто" : "Количество страниц"}
            hint={pageFromCharacters ? "Округление вверх до 0,1; минимум 1 страница" : undefined}
            type="number"
            min="0"
            step="0.1"
            readOnly={pageFromCharacters}
            value={pageFromCharacters && work.character_count ? conditionalPages(work.character_count) : work.page_count}
            onChange={(e) => !pageFromCharacters && patchQuantity({ page_count: e.target.value })}
          /></div>
        )}
        {service && has("document_count") && (
          <Input
            label="Количество документов"
            type="number"
            min="0"
            step="1"
            value={work.document_count}
            onChange={(e) => patchQuantity({ document_count: e.target.value })}
          />
        )}
        {service && has("duration_seconds") && (
          <Input
            label="Длительность, секунд"
            hint="Тарификация — за секунду."
            type="number"
            min="0"
            step="1"
            value={work.duration_seconds}
            onChange={(e) => patchQuantity({ duration_seconds: e.target.value })}
          />
        )}
        {service && has("hour_count") && (
          <Input
            label="Количество часов"
            type="number"
            min="0"
            step="0.25"
            value={work.hour_count}
            onChange={(e) => patchQuantity({ hour_count: e.target.value })}
          />
        )}
        {service && has("topic") && (
          <div className="work-field work-field--topic"><Input
            label="Тематика"
            value={work.topic}
            onChange={(e) => patch({ topic: e.target.value })}
          /></div>
        )}
        {service && has("translator_type") && (
          <div className="work-field work-field--translator"><Select
            label="Тип переводчика"
            value={work.native_speaker ? "native" : "regular"}
            onChange={(e) => patch({ native_speaker: e.target.value === "native", ...resetQuotePatch })}
          >
            <option value="regular">Обычный переводчик</option>
            <option value="native">Носитель языка</option>
          </Select><small className="field-help">Носитель языка учитывается при подборе исполнителя и расчёте тарифа.</small></div>
        )}
        {service && has("start_date") && (
          <Input
            label="Дата начала"
            type="date"
            value={work.start_date}
            onChange={(e) => patch({ start_date: e.target.value })}
          />
        )}
        {service && has("start_time") && (
          <Input
            label="Время начала"
            type="time"
            value={work.start_time}
            onChange={(e) => patch({ start_time: e.target.value })}
          />
        )}
        {service && has("deadline") && (
          <div className="work-field work-field--deadline"><Input
            label="Дата окончания"
            type="date"
            value={work.deadline}
            onChange={(e) => patch({ deadline: e.target.value })}
          /></div>
        )}
        {service && has("deadline_time") && (
          <div className="work-field work-field--deadline-time"><Input
            label="Время окончания"
            type="time"
            value={work.deadline_time}
            onChange={(e) => patch({ deadline_time: e.target.value })}
          /></div>
        )}
        {service && has("status") && (
          <div className="work-field work-field--status"><Select label="Статус работы" value={work.status} onChange={(e) => patch({ status: e.target.value })}>
            {workStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select></div>
        )}

        {service && has("markup") && (
          <label className="manual-switch manual-switch--feature">
            <input
              type="checkbox"
              checked={work.urgent}
              onChange={(e) => patch({ urgent: e.target.checked, ...resetQuotePatch })}
            />
            <span>
              <b>Наценка / срочность</b>
              <small>Включите, если для этой работы применяется повышающий коэффициент</small>
            </span>
          </label>
        )}
        {service && has("markup") && work.urgent && (
          <div className="pricing-field pricing-field--compact">
            <span className="field__label">Коэффициент наценки</span>
            <div className="urgency-coefficient-row">
              {["1.2", "1.5", "2", "3", "4"].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`coefficient-chip${work.urgency_multiplier === value ? " is-active" : ""}`}
                  onClick={() => patch({ urgency_multiplier: value, ...resetQuotePatch })}
                >×{value}</button>
              ))}
              <input
                aria-label="Свой коэффициент наценки"
                className="input coefficient-custom-input"
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={work.urgency_multiplier}
                onChange={(e) => patch({ urgency_multiplier: e.target.value, ...resetQuotePatch })}
              />
            </div>
          </div>
        )}

        {service && has("discount") && (
          <label className="manual-switch manual-switch--feature">
            <input
              type="checkbox"
              checked={work.manualDiscount}
              onChange={(e) => patch({
                manualDiscount: e.target.checked,
                discount_percent: e.target.checked ? work.discount_percent || work.quoteAutoDiscount || "0" : work.quoteAutoDiscount || "0",
              })}
            />
            <span>
              <b>Скидка вручную</b>
              <small>Иначе CRM использует автоматическое правило тарифа</small>
            </span>
          </label>
        )}
        {service && has("discount") && work.manualDiscount && (
          <Input
            label="Скидка, %"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={work.discount_percent}
            onChange={(e) => patch({ discount_percent: e.target.value })}
          />
        )}

        {service && (
          <label className="manual-switch manual-switch--feature internal-work-switch">
            <input
              type="checkbox"
              checked={!work.client_billable}
              onChange={(e) => patch({ client_billable: !e.target.checked })}
            />
            <span>
              <b>Не учитывать в расчёте для клиента</b>
              <small>Исполнитель и себестоимость сохраняются, но работа не входит в клиентскую стоимость и предварительный расчёт</small>
            </span>
          </label>
        )}

        {service && has("notes") && (
          <Textarea label="Комментарий" value={work.notes} onChange={(e) => patch({ notes: e.target.value })} />
        )}
      </div>
    </article>
  );
}

function ExecutorAssignmentsEditor({
  work,
  service,
  onChange,
  matching,
}: {
  work: DraftWork;
  service?: Service;
  onChange: (assignments: DraftExecutorAssignment[]) => void;
  matching?: {
    orderId?: string;
    workId: string;
    lockedReason?: string;
    preview?: boolean;
    autoLoad?: boolean;
  };
}) {
  const assignments = work.executor_assignments;
  const assignmentFields = activeServiceFields(service, work.certification_mode);
  const hasAssignmentField = (field: string) => !service?.definition || assignmentFields.has(field);
  const pageFromCharacters = Boolean(service?.definition?.page_from_characters);
  const [matchingOpen, setMatchingOpen] = useState(false);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState("");
  const [candidateData, setCandidateData] = useState<ExecutorCandidateResponse | null>(null);
  const [routeSelections, setRouteSelections] = useState<Record<number, string>>({});
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [manualRateOpen, setManualRateOpen] = useState<Record<string, boolean>>({});
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const candidateRegionId = matching ? `executor-candidates-${matching.workId}` : undefined;
  const matchingOrderId = matching?.orderId;
  const matchingWorkId = matching?.workId;
  const matchingPreview = Boolean(matching?.preview);
  const matchingAutoLoad = Boolean(matching?.autoLoad);
  const matchingLockedReason = matching?.lockedReason;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMatchingOpen(false);
      setMatchingLoading(false);
      setMatchingError("");
      setCandidateData(null);
      setRouteSelections({});
      setManualRateOpen({});
      setRateOverrides({});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [matching?.workId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const persisted: Record<number, string> = {};
      assignments.forEach((assignment) => {
        if (assignment.route_stage_index && assignment.executor_id) {
          persisted[assignment.route_stage_index] = assignment.executor_id;
        }
      });
      setRouteSelections(persisted);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assignments]);
  const patchAssignment = (key: string, patch: Partial<DraftExecutorAssignment>) =>
    onChange(assignments.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const assignmentFromWork = () => {
    const next = emptyAssignment();
    next.character_count = work.character_count;
    next.page_count = work.page_count;
    next.document_count = work.document_count;
    next.duration_seconds = work.duration_seconds;
    next.hour_count = work.hour_count;
    next.billing_unit = work.billing_unit === "CUSTOM" ? serviceBillingUnit(service, work.certification_mode) : work.billing_unit;
    next.deadline = work.executor_deadline || work.deadline;
    next.deadline_time = work.executor_deadline ? work.executor_deadline_time : work.deadline_time;
    return next;
  };
  const addAssignment = () => onChange([...assignments, assignmentFromWork()]);
  const candidateRateKey = (candidate: ExecutorCandidate, stageIndex?: number) =>
    stageIndex ? `route:${stageIndex}:${candidate.executor_id}` : `direct:${candidate.executor_id}`;
  const effectiveCandidateRate = (candidate: ExecutorCandidate, stageIndex?: number) => {
    const key = candidateRateKey(candidate, stageIndex);
    const override = rateOverrides[key];
    if (override !== undefined && override !== "") return override;
    const selectedAssignment = stageIndex
      ? assignments.find((item) => item.route_stage_index === stageIndex && item.executor_id === candidate.executor_id)
      : assignments.find((item) => !item.route_stage_index && item.executor_id === candidate.executor_id);
    return selectedAssignment?.rate || String(candidate.default_rate ?? 0);
  };
  const toggleManualRate = (candidate: ExecutorCandidate, stageIndex?: number) => {
    const key = candidateRateKey(candidate, stageIndex);
    setManualRateOpen((current) => ({ ...current, [key]: !current[key] }));
    setRateOverrides((current) =>
      current[key] === undefined ? { ...current, [key]: effectiveCandidateRate(candidate, stageIndex) } : current,
    );
  };
  const resetManualRate = (candidate: ExecutorCandidate, stageIndex?: number) => {
    const key = candidateRateKey(candidate, stageIndex);
    setManualRateOpen((current) => ({ ...current, [key]: false }));
    setRateOverrides((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const loadCandidates = useCallback(async () => {
    if (!matchingWorkId || matchingLockedReason) return;
    setMatchingOpen(true);
    setMatchingLoading(true);
    setMatchingError("");
    try {
      const result = matchingPreview
        ? await api<ExecutorCandidateResponse>("/api/admin/orders/executor-candidates/preview", {
            method: "POST",
            body: JSON.stringify({
              service_code: work.service_code,
              work_type: work.work_type,
              source_language: work.source_language,
              target_language: work.target_language,
              deadline: work.deadline || null,
              executor_deadline: work.executor_deadline || null,
              order_deadline: null,
            }),
          })
        : await api<ExecutorCandidateResponse>(
            `/api/admin/orders/${matchingOrderId}/works/${matchingWorkId}/executor-candidates`,
          );
      setCandidateData(result);
      // Candidates are ranked deterministically, but a proposal must not become a
      // draft assignment until the manager explicitly chooses it. Keeping the
      // selection empty also prevents the UI from saying “Выбран для этапа” while
      // executor_assignments is still empty.
      setRouteSelections({});
      setRouteConfirmed(false);
    } catch (error) {
      setCandidateData(null);
      setMatchingError(error instanceof Error ? error.message : "Не удалось подобрать исполнителей");
    } finally {
      setMatchingLoading(false);
    }
  }, [matchingWorkId, matchingOrderId, matchingPreview, matchingLockedReason, work.service_code, work.work_type, work.source_language, work.target_language, work.deadline, work.executor_deadline]);
  useEffect(() => {
    if (!matchingAutoLoad || matchingLockedReason) return;
    const timer = window.setTimeout(() => void loadCandidates(), 0);
    return () => window.clearTimeout(timer);
  }, [matchingAutoLoad, matchingLockedReason, loadCandidates]);
  const selectCandidate = (candidate: ExecutorCandidate) => {
    if (candidate.candidate_state === "UNAVAILABLE") return;
    if (assignments.some((assignment) => assignment.executor_id === candidate.executor_id)) return;
    const next = assignmentFromWork();
    next.executor_id = candidate.executor_id;
    next.rate = effectiveCandidateRate(candidate);
    next.billing_unit = candidate.rate_unit || next.billing_unit;
    onChange([...assignments, next]);
  };
  const routeStageFor = (stageIndex: number) =>
    candidateData?.routed_match.stages.find((stage) => stage.index === stageIndex);
  const persistRouteSelection = (stageIndex: number, candidate: ExecutorCandidate) => {
    const stage = routeStageFor(stageIndex);
    if (!stage || candidate.candidate_state === "UNAVAILABLE") return;
    const existing = assignments.find((assignment) => assignment.route_stage_index === stageIndex);
    const next = existing ? { ...existing } : assignmentFromWork();
    next.executor_id = candidate.executor_id;
    next.rate = effectiveCandidateRate(candidate, stageIndex);
    next.billing_unit = candidate.rate_unit || next.billing_unit;
    next.route_stage_index = stage.index;
    next.route_source_language = stage.source_language;
    next.route_target_language = stage.target_language;
    const withoutStage = assignments.filter((assignment) => assignment.route_stage_index !== stageIndex);
    onChange([...withoutStage, next].sort((left, right) =>
      (left.route_stage_index ?? 99) - (right.route_stage_index ?? 99)
    ));
  };
  const selectRouteCandidate = (stageIndex: number, candidate: ExecutorCandidate) => {
    if (candidate.candidate_state === "UNAVAILABLE") return;
    setRouteConfirmed(false);
    setRouteSelections((current) => ({ ...current, [stageIndex]: candidate.executor_id }));
    persistRouteSelection(stageIndex, candidate);
  };
  const updateCandidateRate = (candidate: ExecutorCandidate, value: string, stageIndex?: number) => {
    const key = candidateRateKey(candidate, stageIndex);
    setRateOverrides((current) => ({ ...current, [key]: value }));
    if (stageIndex) {
      const selected = routeSelections[stageIndex] === candidate.executor_id;
      if (selected) {
        const assignment = assignments.find((item) => item.route_stage_index === stageIndex);
        if (assignment) patchAssignment(assignment.key, { rate: value });
      }
      return;
    }
    const assignment = assignments.find((item) => !item.route_stage_index && item.executor_id === candidate.executor_id);
    if (assignment) patchAssignment(assignment.key, { rate: value });
  };
  const resetCandidateRate = (candidate: ExecutorCandidate, stageIndex?: number) => {
    resetManualRate(candidate, stageIndex);
    const defaultRate = String(candidate.default_rate ?? 0);
    if (stageIndex) {
      const assignment = assignments.find((item) => item.route_stage_index === stageIndex && item.executor_id === candidate.executor_id);
      if (assignment) patchAssignment(assignment.key, { rate: defaultRate });
      return;
    }
    const assignment = assignments.find((item) => !item.route_stage_index && item.executor_id === candidate.executor_id);
    if (assignment) patchAssignment(assignment.key, { rate: defaultRate });
  };
  const assignSuggestedRoute = () => {
    if (!candidateData?.routed_match.eligible || candidateData.routed_match.stages.length !== 2) return;
    const ready = candidateData.routed_match.stages.every((stage) => {
      const executorId = routeSelections[stage.index];
      const candidate = stage.candidates.find((item) => item.executor_id === executorId);
      return Boolean(candidate && candidate.candidate_state !== "UNAVAILABLE" && assignments.some(
        (assignment) => assignment.route_stage_index === stage.index && assignment.executor_id === executorId,
      ));
    });
    if (!ready) return;
    // Stage clicks already persisted both draft assignments. This button only confirms
    // the manager's choice and collapses the editor; it must not replay stale onChange calls.
    setRouteConfirmed(true);
    setMatchingOpen(false);
  };

  return (
    <div className="executor-assignments">
      <div className="executor-assignments__head">
        <div>
          <strong>Исполнители и их объём</strong>
          <small>
            Клиентский объём остаётся у работы. Здесь указывается фактическая часть каждого исполнителя.
          </small>
        </div>
        <div className="executor-assignments__actions">
          {matching && (
            <Button
              type="button"
              variant="secondary"
              aria-expanded={matchingOpen}
              aria-controls={candidateRegionId}
              disabled={Boolean(matching.lockedReason)}
              title={matching.lockedReason || undefined}
              onClick={() => {
                if (matchingOpen) {
                  setMatchingOpen(false);
                  return;
                }
                void loadCandidates();
              }}
            >
              Подобрать исполнителя
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={addAssignment}>
            Добавить исполнителя +
          </Button>
        </div>
      </div>
      {matching?.lockedReason && (
        <p className="executor-matching-note" role="note">{matching.lockedReason}</p>
      )}
      {matchingOpen && matching && (
        <section
          id={candidateRegionId}
          className="executor-matching"
          aria-label="Подходящие исполнители"
          aria-live="polite"
        >
          <header className="executor-matching__head">
            <div>
              <span className="overline">Автоподбор</span>
              <strong>{candidateData?.direct_viable ? "Найден подходящий исполнитель" : "Подходящие исполнители"}</strong>
              <small>
                CRM показывает сохранённые направления, ставки и доступность. Окончательный выбор делает менеджер.
              </small>
            </div>
            {candidateData && candidateData.matchable && (
              <span className="executor-matching__count">Найдено: {candidateData.counts.total}</span>
            )}
          </header>
          {matchingLoading && <LoadingState label="Подбираем исполнителей…" />}
          {matchingError && <ErrorState message={matchingError} />}
          {!matchingLoading && !matchingError && candidateData && !candidateData.matchable && (
            <div className="executor-matching__empty">
              <strong>Недостаточно данных для подбора</strong>
              <span>
                Заполните {candidateData.missing_fields.map((field) => ({
                  service_code: "услугу",
                  source_language: "язык исходника",
                  target_language: "язык результата",
                }[field] || field)).join(", ")} и сохраните работу.
              </span>
            </div>
          )}
          {!matchingLoading && !matchingError && candidateData?.matchable && !candidateData.candidates.length && (
            <div className="executor-matching__empty">
              <strong>{candidateData.routed_match.eligible ? "Прямой исполнитель не найден" : "Подходящий исполнитель не найден"}</strong>
              <span>{candidateData.routed_match.eligible ? "CRM нашла возможный составной маршрут ниже." : "Для этой услуги и её обязательных параметров подходящих исполнителей нет."}</span>
              <Button type="button" variant="secondary" onClick={addAssignment}>Добавить вручную</Button>
            </div>
          )}
          {!matchingLoading && !matchingError && candidateData?.matchable && candidateData.candidates.length > 0 && (
            <div className="executor-candidate-list">
              {candidateData.candidates.map((candidate) => {
                const alreadySelected = assignments.some((assignment) => assignment.executor_id === candidate.executor_id);
                const unavailable = candidate.candidate_state === "UNAVAILABLE";
                const availabilityLabel = candidate.candidate_state === "AVAILABLE"
                  ? "Свободен"
                  : candidate.candidate_state === "UNKNOWN"
                    ? "Доступность не указана"
                    : candidate.availability.state === "VACATION"
                      ? "Отпуск"
                      : candidate.availability.state === "BUSY"
                        ? "Занят"
                        : "Недоступен";
                const tone = candidate.candidate_state === "AVAILABLE"
                  ? "success"
                  : candidate.candidate_state === "UNAVAILABLE"
                    ? "danger"
                    : "warning";
                return (
                  <article className={`executor-candidate-card is-${candidate.candidate_state.toLowerCase()}`} key={candidate.executor_id}>
                    <div className="executor-candidate-card__identity">
                      <div>
                        <strong>{candidate.executor_name}</strong>
                        <span>
                          {candidateData?.matching_mode === "SERVICE_ONLY"
                            ? "Без языковой пары"
                            : candidateData?.matching_mode === "SOURCE_LANGUAGE"
                              ? candidate.matched_pair.source_language || work.source_language || "Язык не указан"
                              : `${candidate.matched_pair.source_language} ↔ ${candidate.matched_pair.target_language}`}
                        </span>
                      </div>
                      <Badge tone={tone}>{availabilityLabel}</Badge>
                    </div>
                    <div className="executor-candidate-card__facts">
                      <div>
                        <span>Услуга</span>
                        <strong>{candidate.service_name || candidate.service_code}</strong>
                      </div>
                      <div>
                        <span>Ставка по умолчанию</span>
                        <strong>{rub(candidate.default_rate)} / {billingUnits.find(([value]) => value === candidate.rate_unit)?.[1] || candidate.rate_unit}</strong>
                      </div>
                      <div>
                        <span>Проверка срока</span>
                        <strong>{candidateData.required_date || "Дата не указана"}</strong>
                      </div>
                    </div>
                    <div className="executor-candidate-rate">
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => toggleManualRate(candidate)}
                      >
                        {manualRateOpen[candidateRateKey(candidate)] ? "Скрыть ставку" : "Ставка вручную"}
                      </Button>
                      {manualRateOpen[candidateRateKey(candidate)] && (
                        <div className="executor-candidate-rate__editor">
                          <Input
                            label="Ставка для этого назначения, ₽"
                            type="number"
                            min="0"
                            step="0.01"
                            value={effectiveCandidateRate(candidate)}
                            onChange={(e) =>
                              setRateOverrides((current) => ({
                                ...current,
                                [candidateRateKey(candidate)]: e.target.value,
                              }))
                            }
                          />
                          <Button type="button" variant="quiet" onClick={() => resetManualRate(candidate)}>
                            Вернуть ставку по умолчанию
                          </Button>
                        </div>
                      )}
                    </div>
                    {(candidate.availability.start_date || candidate.availability.notes) && (
                      <p className="executor-candidate-card__note">
                        {candidate.availability.start_date && candidate.availability.end_date
                          ? `${candidate.availability.start_date} — ${candidate.availability.end_date}`
                          : ""}
                        {candidate.availability.notes ? `${candidate.availability.start_date ? " · " : ""}${candidate.availability.notes}` : ""}
                      </p>
                    )}
                    <div className="executor-candidate-card__action">
                      <Button
                        type="button"
                        variant={candidate.candidate_state === "AVAILABLE" ? "primary" : "secondary"}
                        disabled={unavailable || alreadySelected}
                        onClick={() => selectCandidate(candidate)}
                      >
                        {alreadySelected ? "Назначен" : unavailable ? "Недоступен на срок" : "Назначить исполнителя"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!matchingLoading && !matchingError && candidateData?.matchable && candidateData.routed_match.eligible && (
            <section className="executor-routing" aria-label="Маршрут через русский">
              <header className="executor-routing__head">
                <div>
                  <span className="overline">Прямой исполнитель не найден</span>
                  <strong>Найден составной маршрут через {candidateData.routed_match.via_language}</strong>
                  <small>
                    CRM предлагает два последовательных этапа. Каждый этап выполняет один исполнитель; окончательное назначение подтверждает менеджер.
                  </small>
                </div>
                <Badge tone={candidateData.routed_match.complete ? "success" : "warning"}>
                  {candidateData.routed_match.complete ? "Маршрут доступен" : "Нужен исполнитель"}
                </Badge>
              </header>
              <div className="executor-route-flow">
                {candidateData.routed_match.stages.map((stage) => (
                  <article className="executor-route-stage" key={stage.index}>
                    <header className="executor-route-stage__head">
                      <div>
                        <span className="overline">Этап {String(stage.index).padStart(2, "0")}</span>
                        <strong>{stage.source_language} → {stage.target_language}</strong>
                      </div>
                      <span>{stage.counts.total ? `Кандидатов: ${stage.counts.total}` : "Исполнитель не найден"}</span>
                    </header>
                    {!stage.candidates.length ? (
                      <div className="executor-matching__empty">
                        <strong>Исполнитель не найден</strong>
                        <span>Для этого этапа нет сохранённого направления с нужной услугой и языковой парой.</span>
                      </div>
                    ) : (
                      <div className="executor-route-candidates">
                        {stage.candidates.map((candidate) => {
                          const unavailable = candidate.candidate_state === "UNAVAILABLE";
                          const selected = routeSelections[stage.index] === candidate.executor_id;
                          const availabilityLabel = candidate.candidate_state === "AVAILABLE"
                            ? "Свободен"
                            : candidate.candidate_state === "UNKNOWN"
                              ? "Доступность не указана"
                              : candidate.availability.state === "VACATION"
                                ? "Отпуск"
                                : candidate.availability.state === "BUSY"
                                  ? "Занят"
                                  : "Недоступен";
                          const tone = candidate.candidate_state === "AVAILABLE"
                            ? "success"
                            : unavailable ? "danger" : "warning";
                          return (
                            <div className={`executor-route-candidate is-${candidate.candidate_state.toLowerCase()}`} key={candidate.executor_id}>
                              <div>
                                <strong>{candidate.executor_name}</strong>
                                <span>{rub(candidate.default_rate)} / {billingUnits.find(([value]) => value === candidate.rate_unit)?.[1] || candidate.rate_unit}</span>
                                <button
                                  type="button"
                                  className="executor-rate-toggle"
                                  onClick={() => toggleManualRate(candidate, stage.index)}
                                >
                                  {manualRateOpen[candidateRateKey(candidate, stage.index)] ? "Скрыть ставку" : "Ставка вручную"}
                                </button>
                                {manualRateOpen[candidateRateKey(candidate, stage.index)] && (
                                  <div className="executor-route-rate-editor">
                                    <Input
                                      label={`Ставка этапа ${String(stage.index).padStart(2, "0")}, ₽`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={effectiveCandidateRate(candidate, stage.index)}
                                      onChange={(e) => updateCandidateRate(candidate, e.target.value, stage.index)}
                                    />
                                    <Button
                                      type="button"
                                      variant="quiet"
                                      onClick={() => resetCandidateRate(candidate, stage.index)}
                                    >
                                      По умолчанию
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <Badge tone={tone}>{availabilityLabel}</Badge>
                              <Button
                                type="button"
                                variant={selected ? "primary" : "secondary"}
                                disabled={unavailable}
                                onClick={() => selectRouteCandidate(stage.index, candidate)}
                              >
                                {selected ? "Выбран для этапа" : unavailable ? "Недоступен на срок" : "Выбрать для этапа"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {candidateData.routed_match.stages.length === 2 && routeSelections[1] && routeSelections[2] && (
                <div className="executor-routing__ready" role="status">
                  <span>Оба этапа выбраны и уже учтены в выплатах. Ставки можно скорректировать до создания заказа.</span>
                  <Button type="button" onClick={assignSuggestedRoute}>Назначить предложенных исполнителей</Button>
                </div>
              )}
            </section>
          )}
        </section>
      )}
      {!assignments.length && (
        <p className="context-note">
          Исполнитель пока не назначен. Это можно сделать позже без изменения клиентской стоимости.
        </p>
      )}
      {routeConfirmed && assignments.some((assignment) => assignment.route_stage_index) ? (
        <div className="executor-assignment-confirmation" role="status">
          <div>
            <strong>✓ Исполнители успешно назначены</strong>
            <span>{assignments.filter((assignment) => assignment.route_stage_index).sort((a, b) => (a.route_stage_index ?? 0) - (b.route_stage_index ?? 0)).map((assignment) => `Этап ${String(assignment.route_stage_index).padStart(2, "0")}: ${assignment.route_source_language} → ${assignment.route_target_language}`).join(" · ")}</span>
          </div>
          <Button type="button" variant="secondary" onClick={() => { setRouteConfirmed(false); setMatchingOpen(true); }}>Редактировать</Button>
        </div>
      ) : assignments.map((assignment, index) => {
        const autoCost = assignmentPrice(assignment);
        return (
          <article className="executor-assignment-card" key={assignment.key}>
            <header>
              <div>
                <span className="overline">{assignment.route_stage_index ? `Этап ${String(assignment.route_stage_index).padStart(2, "0")}` : `Исполнитель ${index + 1}`}</span>
                <strong>{assignment.route_stage_index ? `${assignment.route_source_language} → ${assignment.route_target_language}` : assignment.executor_id ? "Назначение" : "Выберите специалиста"}</strong>
              </div>
              <Button
                type="button"
                variant="quiet"
                onClick={() => onChange(assignments.filter((item) => item.key !== assignment.key))}
              >
                Удалить
              </Button>
            </header>
            <div className="wizard-grid executor-assignment-grid">
              <CrmLookup
                label="Исполнитель"
                placeholder="Имя, телефон, email или Telegram"
                path={`/api/admin/executors?language=${encodeURIComponent(work.target_language || work.source_language)}&work_type=${encodeURIComponent(work.work_type)}`}
                value={assignment.executor_id}
                onChange={(id) => patchAssignment(assignment.key, { executor_id: id })}
              />
              {hasAssignmentField("character_count") && (
                <Input
                  label="Знаков исполнителя"
                  type="number"
                  min="0"
                  value={assignment.character_count}
                  onChange={(e) => {
                    const character_count = e.target.value;
                    patchAssignment(assignment.key, {
                      character_count,
                      page_count: pageFromCharacters && character_count
                        ? conditionalPages(character_count)
                        : assignment.page_count,
                    });
                  }}
                />
              )}
              {hasAssignmentField("page_count") && (
                <Input
                  label={pageFromCharacters ? "Страниц исполнителя · авто" : "Страниц исполнителя"}
                  type="number"
                  min="0"
                  step="0.1"
                  readOnly={pageFromCharacters}
                  value={pageFromCharacters && assignment.character_count ? conditionalPages(assignment.character_count) : assignment.page_count}
                  onChange={(e) => !pageFromCharacters && patchAssignment(assignment.key, { page_count: e.target.value })}
                />
              )}
              {hasAssignmentField("document_count") && (
                <Input
                  label="Документов исполнителя"
                  type="number"
                  min="0"
                  step="1"
                  value={assignment.document_count}
                  onChange={(e) => patchAssignment(assignment.key, { document_count: e.target.value })}
                />
              )}
              {hasAssignmentField("duration_seconds") && (
                <Input
                  label="Секунд исполнителя"
                  type="number"
                  min="0"
                  step="1"
                  value={assignment.duration_seconds}
                  onChange={(e) => patchAssignment(assignment.key, { duration_seconds: e.target.value })}
                />
              )}
              {hasAssignmentField("hour_count") && (
                <Input
                  label="Часов исполнителя"
                  type="number"
                  min="0"
                  step="0.25"
                  value={assignment.hour_count}
                  onChange={(e) => patchAssignment(assignment.key, { hour_count: e.target.value })}
                />
              )}
              <div className="pricing-field executor-unit-readonly">
                <span className="field__label">Единица ставки</span>
                <div className="calculated-value">
                  <strong>{billingUnitLabel(assignment.billing_unit)}</strong>
                  <small>По выбранной услуге</small>
                </div>
              </div>
              <Input
                label="Ставка исполнителя, ₽"
                type="number"
                min="0"
                step="0.01"
                value={assignment.rate}
                onChange={(e) => patchAssignment(assignment.key, { rate: e.target.value })}
              />
              <Input
                label="Срок исполнителя"
                type="date"
                value={assignment.deadline}
                onChange={(e) => patchAssignment(assignment.key, { deadline: e.target.value })}
              />
              <Input
                label="Время"
                type="time"
                value={assignment.deadline_time}
                onChange={(e) => patchAssignment(assignment.key, { deadline_time: e.target.value })}
              />
              <Select
                label="Статус"
                value={assignment.status}
                onChange={(e) => patchAssignment(assignment.key, { status: e.target.value })}
              >
                {workStatuses.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <label className="manual-switch manual-switch--feature">
                <input
                  type="checkbox"
                  checked={assignment.manualCost}
                  onChange={(e) => patchAssignment(assignment.key, {
                    manualCost: e.target.checked,
                    cost: e.target.checked ? String(autoCost) : assignment.cost,
                  })}
                />
                <span>
                  <b>Стоимость вручную</b>
                  <small>Иначе CRM считает по объёму и ставке исполнителя</small>
                </span>
              </label>
              {assignment.manualCost ? (
                <Input
                  label="Итого исполнителю, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignment.cost}
                  onChange={(e) => patchAssignment(assignment.key, { cost: e.target.value })}
                />
              ) : (
                <div className="calculated-value calculated-value--total">
                  <span>Авторасчёт исполнителю</span>
                  <strong>{rub(autoCost)}</strong>
                  <small>По его фактическому объёму</small>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function draftFromWork(work: Work): DraftWork {
  const discount = Number(work.discount_percent || 0);
  const autoPrice = Number(work.auto_price || 0);
  const beforeDiscount = discount < 100 ? autoPrice / Math.max(0.0001, 1 - discount / 100) : autoPrice;
  return {
    key: work.id,
    service_code: work.service_code,
    work_type: work.work_type,
    source_language: work.source_language,
    target_language: work.target_language,
    tariff_ids: work.tariff_ids ? work.tariff_ids.split(",").filter(Boolean) : [],
    topic: work.topic,
    urgent: work.urgent,
    urgency_multiplier: String(work.urgency_multiplier ?? 1),
    native_speaker: work.native_speaker,
    manualDiscount: work.discount_overridden,
    discount_percent: String(work.discount_percent ?? 0),
    character_count: work.character_count?.toString() ?? "",
    page_count: work.page_count?.toString() ?? "",
    word_count: work.word_count?.toString() ?? "",
    document_count: work.document_count?.toString() ?? "",
    duration_seconds: work.duration_seconds?.toString() ?? "",
    hour_count: work.hour_count?.toString() ?? "",
    start_date: work.start_date ?? "",
    start_time: work.start_time ?? "",
    certification_mode: work.certification_mode ?? "",
    billing_unit: work.billing_unit,
    client_rate: String(work.client_rate ?? 0),
    price: String(work.price ?? 0),
    manualPrice: work.price_overridden,
    client_billable: work.client_billable !== false,
    executor_id: work.executor_id ?? "",
    executor_rate: String(work.executor_rate ?? 0),
    executor_billing_unit: work.executor_billing_unit,
    executor_cost: String(work.executor_cost ?? 0),
    manualExecutorCost: work.executor_cost_overridden,
    deadline: work.deadline ?? "",
    deadline_time: work.deadline_time ?? "",
    executor_deadline: work.executor_deadline ?? "",
    executor_deadline_time: work.executor_deadline_time ?? "",
    status: work.status,
    notes: work.notes,
    quoteAmount: String(work.auto_price ?? 0),
    quoteBeforeDiscount: String(beforeDiscount),
    quoteAutoDiscount: String(work.discount_overridden ? 0 : work.discount_percent ?? 0),
    quoteRate: String(work.client_rate ?? 0),
    quoteUnit: work.billing_unit,
    quoteMessage: work.discount_overridden
      ? `Скидка задана менеджером: ${Number(work.discount_percent || 0)}%`
      : Number(work.discount_percent || 0) > 0
        ? `CRM применила скидку от объёма: ${Number(work.discount_percent || 0)}%`
        : "",
    executor_assignments: (work.executor_assignments || []).map((assignment) => ({
      key: assignment.id || newKey(),
      id: assignment.id,
      executor_id: assignment.executor_id,
      character_count: assignment.character_count?.toString() ?? "",
      page_count: assignment.page_count?.toString() ?? "",
      document_count: assignment.document_count?.toString() ?? "",
      duration_seconds: assignment.duration_seconds?.toString() ?? "",
      hour_count: assignment.hour_count?.toString() ?? "",
      billing_unit: assignment.billing_unit,
      rate: String(assignment.rate ?? 0),
      cost: String(assignment.cost ?? 0),
      manualCost: assignment.cost_overridden,
      deadline: assignment.deadline ?? "",
      deadline_time: assignment.deadline_time ?? "",
      route_stage_index: assignment.route_stage_index ?? null,
      route_source_language: assignment.route_source_language ?? "",
      route_target_language: assignment.route_target_language ?? "",
      status: assignment.status,
      notes: assignment.notes,
    })),
  };
}


type WorkEditorState = {
  mode: "new" | "edit";
  workId?: string;
  version?: number;
  draft: DraftWork;
};

function OrderCard({
  orderId,
  statuses,
  onClose,
  onChanged,
}: {
  orderId: string;
  statuses: StatusOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [workEditor, setWorkEditor] = useState<WorkEditorState | null>(null);
  const [savingWork, setSavingWork] = useState(false);
  const [copiedClientSummary, setCopiedClientSummary] = useState(false);
  const [activeTab, setActiveTab] = useState<"core" | "works" | "finance" | "files" | "history">("core");
  const [paymentEdit, setPaymentEdit] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({
    amount_paid: "0",
    payment_method: "",
    invoice_number: "",
    invoice_date: "",
    paid_at: "",
    notes: "",
  });
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [detailsEdit, setDetailsEdit] = useState(false);
  const [detailDraft, setDetailDraft] = useState({
    client_id: "",
    contact_id: "",
    manager_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const detail = await api<OrderDetail>(`/api/admin/crm/orders/${orderId}`);
      setOrder(detail);
      setPaymentDraft({
        amount_paid: String(detail.payment?.amount_paid ?? 0),
        payment_method: detail.payment?.payment_method ?? "",
        invoice_number: detail.payment?.invoice_number ?? "",
        invoice_date: detail.payment?.invoice_date ?? "",
        paid_at: detail.payment?.paid_at ?? "",
        notes: detail.payment?.notes ?? "",
      });
      setDetailDraft({
        client_id: detail.client_id ?? "",
        contact_id: detail.contact_id ?? "",
        manager_id: detail.manager_id ?? "",
        notes: detail.notes ?? "",
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказ");
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    api<Service[]>("/api/admin/crm/services?active=true")
      .then(setServices)
      .catch(() => {});
    api<UserSummary[]>("/api/admin/applications/managers")
      .then(setManagers)
      .catch(() => {});
  }, []);

  async function changeStatus(status: string) {
    try {
      await api(`/api/admin/crm/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить статус");
    }
  }
  async function setArchiveState(nextArchived: boolean) {
    try {
      await api(`/api/admin/crm/orders/${orderId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived: nextArchived }),
      });
      setDetailsEdit(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : nextArchived
            ? "Не удалось переместить заказ в архив"
            : "Не удалось вернуть заказ в основную воронку",
      );
    }
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("upload", file);
      await api(`/api/admin/crm/orders/${orderId}/files/analyze`, {
        method: "POST",
        body: form,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }
  async function duplicateWork(workId: string) {
    try {
      await api(`/api/admin/crm/orders/${orderId}/works/${workId}/duplicate`, {
        method: "POST",
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось дублировать работу",
      );
    }
  }
  async function archiveWork(workId: string) {
    if (
      !confirm(
        "Убрать эту работу из активного заказа? История сохранится в архиве.",
      )
    )
      return;
    try {
      await api(`/api/admin/crm/orders/${orderId}/works/${workId}/archive`, {
        method: "POST",
      });
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось архивировать работу",
      );
    }
  }
  async function saveWork() {
    if (!workEditor) return;
    setSavingWork(true);
    setError("");
    const w = workEditor.draft;
    const payload = {
      service_code: w.service_code,
      work_type: w.work_type,
      source_language: w.source_language,
      target_language: w.target_language,
      tariff_ids: w.tariff_ids,
      topic: w.topic,
      urgent: w.urgent,
      urgency_multiplier: Number(w.urgency_multiplier || 1),
      native_speaker: w.native_speaker,
      discount_percent: w.manualDiscount ? Number(w.discount_percent || 0) : null,
      character_count: w.character_count ? Number(w.character_count) : null,
      page_count: w.page_count ? Number(w.page_count) : null,
      word_count: w.word_count ? Number(w.word_count) : null,
      document_count: w.document_count ? Number(w.document_count) : null,
      duration_seconds: w.duration_seconds ? Number(w.duration_seconds) : null,
      hour_count: w.hour_count ? Number(w.hour_count) : null,
      start_date: w.start_date || null,
      start_time: w.start_time,
      certification_mode: w.certification_mode,
      billing_unit: w.billing_unit,
      client_rate: Number(w.client_rate || 0),
      price: w.manualPrice ? Number(w.price || 0) : null,
      price_override_reason: w.manualPrice
        ? "Ручная корректировка в карточке заказа"
        : "",
      client_billable: w.client_billable,
      executor_id: w.executor_id || null,
      executor_rate: Number(w.executor_rate || 0),
      executor_billing_unit: w.executor_billing_unit,
      executor_cost: w.manualExecutorCost ? Number(w.executor_cost || 0) : null,
      deadline: w.deadline || null,
      deadline_time: w.deadline_time,
      executor_deadline: w.executor_deadline || null,
      executor_deadline_time: w.executor_deadline_time,
      executor_assignments: w.executor_assignments.filter((assignment) => assignment.executor_id).map((assignment) => ({
        id: assignment.id,
        executor_id: assignment.executor_id,
        character_count: assignment.character_count ? Number(assignment.character_count) : null,
        page_count: assignment.page_count ? Number(assignment.page_count) : null,
        document_count: assignment.document_count ? Number(assignment.document_count) : null,
        duration_seconds: assignment.duration_seconds ? Number(assignment.duration_seconds) : null,
        hour_count: assignment.hour_count ? Number(assignment.hour_count) : null,
        billing_unit: assignment.billing_unit,
        rate: Number(assignment.rate || 0),
        cost: assignment.manualCost ? Number(assignment.cost || 0) : null,
        deadline: assignment.deadline || null,
        deadline_time: assignment.deadline_time,
        route_stage_index: assignment.route_stage_index ?? null,
        route_source_language: assignment.route_source_language || "",
        route_target_language: assignment.route_target_language || "",
        status: assignment.status,
        notes: assignment.notes,
      })),
      status: w.status,
      notes: w.notes,
      ...(workEditor.mode === "edit" ? { version: workEditor.version } : {}),
    };
    try {
      const path =
        workEditor.mode === "edit"
          ? `/api/admin/crm/orders/${orderId}/works/${workEditor.workId}`
          : `/api/admin/crm/orders/${orderId}/works`;
      await api(path, {
        method: workEditor.mode === "edit" ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setWorkEditor(null);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить работу");
    } finally {
      setSavingWork(false);
    }
  }
  async function saveOrderDetails() {
    if (!order) return;
    setError("");
    try {
      await api(`/api/admin/crm/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          client_id: detailDraft.client_id || null,
          contact_id: detailDraft.contact_id || null,
          manager_id: detailDraft.manager_id || null,
          notes: detailDraft.notes,
          version: order.version,
        }),
      });
      setDetailsEdit(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить данные заказа",
      );
    }
  }

  async function savePayment() {
    if (!order) return;
    try {
      await api(`/api/admin/crm/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          amount_paid: Number(paymentDraft.amount_paid || 0),
          payment_method: paymentDraft.payment_method,
          invoice_number: paymentDraft.invoice_number,
          invoice_date: paymentDraft.invoice_date || null,
          paid_at: paymentDraft.paid_at || null,
          notes: paymentDraft.notes,
          version: order.payment?.version ?? 1,
        }),
      });
      setPaymentEdit(false);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить оплату");
    }
  }

  if (!order)
    return (
      <section className="crm-editor">
        <Button variant="quiet" onClick={onClose}>
          Закрыть
        </Button>
        {error ? <ErrorState message={error} /> : <LoadingState />}
      </section>
    );
  const serviceName = (code: string) =>
    services.find((item) => item.code === code)?.name ||
    code ||
    "Услуга не указана";
  const clientSummaryText = [
    `Предварительный расчёт по заказу ${order.number}`,
    order.client_name ? `Клиент: ${order.client_name}` : "",
    "",
    ...order.works.filter((work) => work.client_billable !== false).flatMap((work, index) => {
      const direction = workDirectionLabel(work);
      const volume = workVolumeLabel(work);
      const lines = [
        `${index + 1}. ${serviceName(work.service_code)}${direction !== "Без языковой пары" ? `, ${direction}` : ""}`,
        volume !== "Объём не указан" ? `Объём: ${volume}` : "",
        work.service_code === "company_certification"
          ? `Вариант заверения: ${work.certification_mode === "PER_PAGE" ? "Постранично" : "Сшивка"}`
          : "",
        Number(work.client_rate || 0) > 0 ? `Тариф: ${rub(work.client_rate)} · ${billingUnitLabel(work.billing_unit)}` : "",
        work.urgent && Number(work.urgency_multiplier || 1) > 1
          ? `Наценка / срочность: ×${Number(work.urgency_multiplier).toLocaleString("ru-RU")}`
          : "",
        Number(work.discount_percent || 0) > 0
          ? `Скидка: ${Number(work.discount_percent).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`
          : "",
        `Предварительная стоимость: ${rub(work.price)}`,
        `Предварительный срок: ${workTimingLabel(work)}`,
      ].filter(Boolean);
      return [...lines, ""];
    }),
    `Предварительный итог: ${rub(order.financial.revenue)}`,
    "Расчёт предварительный и может быть уточнён после проверки материалов.",
  ].filter((line, index, items) => line !== "" || (index > 0 && items[index - 1] !== "")).join("\n");
  async function copyClientSummary() {
    try {
      await navigator.clipboard.writeText(clientSummaryText);
      setCopiedClientSummary(true);
      window.setTimeout(() => setCopiedClientSummary(false), 1800);
    } catch {
      setError("Не удалось скопировать расчёт. Выделите текст вручную.");
    }
  }
  const orderBoard = order.archived ? "ARCHIVE" : "MAIN";
  const visibleStatuses = statuses.filter(
    (status) =>
      (status.active && status.board === orderBoard) || status.code === order.status,
  );
  const currentStatusIndex = visibleStatuses.findIndex(
    (status) => status.code === order.status,
  );

  return (
    <section className="crm-order-card phase5-order-card">
      <header className="order-card-head">
        <div>
          <span className="overline">Создан {orderCreatedDate(order.created_at)}</span>
          <h2>Заказ {order.number}</h2>
          <p>
            {order.deadline
              ? `Общий дедлайн ${order.deadline}`
              : "Общий дедлайн не указан"}
          </p>
        </div>
        <div className="order-card-head__actions">
          {order.archived && <Badge tone="neutral">Архив</Badge>}
          <Button
            variant="secondary"
            aria-expanded={detailsEdit}
            disabled={order.archived}
            onClick={() => setDetailsEdit(!detailsEdit)}
          >
            {detailsEdit ? "Свернуть" : "Изменить данные"}
          </Button>
          <ActionMenu
            label="Действия с заказом"
            items={[
              order.archived
                ? {
                    label: "Вернуть в основную воронку",
                    onSelect: () => void setArchiveState(false),
                  }
                : {
                    label: "Добавить в архив",
                    onSelect: () => void setArchiveState(true),
                  },
            ]}
          />
          <Button variant="quiet" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </header>
      {error && <ErrorState message={error} />}
      <section className="order-stage-flow" aria-label="Этап заказа">
        <div className="order-stage-flow__track" role="list">
          {visibleStatuses.map((status, index) => {
            const isCurrent = status.code === order.status;
            const isPast = currentStatusIndex >= 0 && index < currentStatusIndex;
            return (
              <button
                type="button"
                role="listitem"
                key={status.code}
                className={`order-stage${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}`}
                data-stage-state={isCurrent ? "current" : isPast ? "completed" : "future"}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => {
                  if (!isCurrent) void changeStatus(status.code);
                }}
              >
                <OrderStageGlyph
                  key={`${status.code}-${order.status}`}
                  index={index + 1}
                  state={isCurrent ? "current" : isPast ? "completed" : "future"}
                />
                <span className="order-stage__label">{status.name}</span>
              </button>
            );
          })}
        </div>
      </section>
      <nav className="order-section-nav phase5-order-tabs" aria-label="Разделы заказа" role="tablist">
        {([
          ["core", "Основное"],
          ["works", `Работы ${order.works.length}`],
          ["finance", "Финансы"],
          ["files", `Файлы ${order.files.length}`],
          ["history", "История"],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            className={activeTab === value ? "is-active" : ""}
            key={value}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section
        id="order-core"
        role="tabpanel"
        className={`order-core-editor phase5-order-panel${activeTab === "core" ? " is-active" : ""}${detailsEdit ? " is-editing" : ""}`}
      >
        {detailsEdit ? (
          <>
            <header className="order-edit-heading">
              <div>
                <span className="overline">Основное</span>
                <h3>Данные заказа</h3>
                <p>
                  Клиент, ответственный и внутренняя информация редактируются
                  отдельно от работ.
                </p>
              </div>
            </header>
            <div className="order-edit-groups">
              <fieldset className="order-edit-group">
                <legend>Клиент и ответственность</legend>
                <CrmLookup
                  label="Клиент"
                  path="/api/admin/companies"
                  value={detailDraft.client_id}
                  onChange={(id) =>
                    setDetailDraft({
                      ...detailDraft,
                      client_id: id,
                      contact_id: "",
                    })
                  }
                />
                {detailDraft.client_id && (
                  <CrmLookup
                    label="Контактное лицо"
                    path={`/api/admin/companies/${detailDraft.client_id}/representatives`}
                    value={detailDraft.contact_id}
                    onChange={(id) =>
                      setDetailDraft({ ...detailDraft, contact_id: id })
                    }
                  />
                )}
                <Select
                  label="Ответственный"
                  value={detailDraft.manager_id}
                  onChange={(e) =>
                    setDetailDraft({
                      ...detailDraft,
                      manager_id: e.target.value,
                    })
                  }
                >
                  <option value="">Не назначен</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </fieldset>
              <fieldset className="order-edit-group">
                <legend>Параметры и заметки</legend>
                <Textarea
                  label="Внутренний комментарий"
                  value={detailDraft.notes}
                  onChange={(e) =>
                    setDetailDraft({ ...detailDraft, notes: e.target.value })
                  }
                />
              </fieldset>
            </div>
            <div className="form-actions order-edit-actions">
              <Button onClick={() => void saveOrderDetails()}>
                Сохранить данные
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setDetailsEdit(false);
                  setDetailDraft({
                    client_id: order.client_id ?? "",
                    contact_id: order.contact_id ?? "",
                    manager_id: order.manager_id ?? "",
                    notes: order.notes ?? "",
                  });
                }}
              >
                Отмена
              </Button>
            </div>
          </>
        ) : (
          <div className="order-context-strip">
            <div>
              <span>Клиент</span>
              <strong>{order.client_name || "Не указан"}</strong>
            </div>
            <div>
              <span>Контакт</span>
              <strong>{order.contact_name || "Не указан"}</strong>
            </div>
            <div>
              <span>Ответственный</span>
              <strong>{order.manager_name || "Не назначен"}</strong>
            </div>
            <div>
              <span>Дедлайн</span>
              <strong>{order.deadline || "Не указан"}</strong>
            </div>
            <div>
              <span>Создан</span>
              <strong>{orderCreatedDate(order.created_at)}</strong>
            </div>
            <div>
              <span>Внутренняя заметка</span>
              <strong>{order.notes || "Нет заметки"}</strong>
            </div>
          </div>
        )}
      </section>
      <section id="order-finance" role="tabpanel" className={`phase5-finance-workspace phase5-order-panel${activeTab === "finance" ? " is-active" : ""}`}>
        <div className="phase5-finance-main-column">
          <div className="order-finance-module">
            <header>
              <div>
                <span className="overline">Финансы</span>
                <h3>Экономика заказа</h3>
              </div>
              <p>Стоимость, выплаты, прибыль, маржинальность и текущий долг клиента.</p>
            </header>
            <div className="finance-strip">
              <div className="finance-strip__primary finance-metric finance-metric--total">
                <span>Итоговая стоимость заказа</span>
                <strong>{rub(order.financial.revenue)}</strong>
                <small>Стоимость всех работ для клиента</small>
              </div>
              <div
                className={`finance-strip__primary finance-strip__debt finance-metric finance-metric--debt${Number(order.financial.client_debt) > 0 ? " is-debt-open" : " is-paid"}`}
              >
                <span>Остаток к оплате</span>
                <strong>{rub(order.financial.client_debt)}</strong>
                <small>{Number(order.financial.client_debt) > 0 ? "Текущая задолженность" : "Оплата закрыта"}</small>
              </div>
              <div className="finance-strip__secondary finance-metric finance-metric--profit">
                <span>Прибыль</span>
                <strong>{rub(order.financial.profit)}</strong>
                <small>До учёта прочих расходов</small>
              </div>
              <div className="finance-strip__secondary finance-metric finance-metric--executor">
                <span>Выплаты исполнителям</span>
                <strong>{rub(order.financial.executor_cost)}</strong>
                <small>Себестоимость работ</small>
              </div>
              <div className="finance-strip__secondary finance-metric finance-metric--margin">
                <span>Маржинальность</span>
                <strong>{Number(order.financial.margin_percent)}%</strong>
                <small>Доля прибыли в стоимости заказа</small>
              </div>
            </div>
          </div>
        </div>

        <aside className="phase5-finance-side-column" aria-label="Детали финансов заказа">
          {(order.financial.executor_breakdown ?? []).some((work) => Number(work.executor_cost) > 0) && (
            <section className="executor-finance-breakdown" aria-label="Структура выплат исполнителям">
              <header>
                <div>
                  <span className="overline">Исполнители</span>
                  <h4>Структура выплат</h4>
                </div>
                <strong>{rub(order.financial.executor_cost)}</strong>
              </header>
              <div className="executor-finance-breakdown__works">
                {(order.financial.executor_breakdown ?? []).filter((work) => Number(work.executor_cost) > 0).map((work, workIndex) => (
                  <article className="executor-finance-work" key={work.work_id}>
                    <div className="executor-finance-work__head">
                      <span className="lc-number-badge">{String(workIndex + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{serviceName(work.service_code)}</strong>
                        <small>{work.client_billable === false ? "Внутренняя работа · не учитывается клиенту" : ([work.source_language, work.target_language].filter(Boolean).join(" → ") || "Без языковой пары")}</small>
                      </div>
                      <strong>{rub(work.executor_cost)}</strong>
                    </div>
                    {work.assignments.length ? (
                      <div className="executor-finance-stages">
                        {work.assignments.map((assignment) => {
                          const routeDirection = [assignment.route_source_language, assignment.route_target_language].filter(Boolean).join(" → ");
                          return (
                            <div className="executor-finance-stage" key={assignment.assignment_id}>
                              <div>
                                <span>{assignment.route_stage_index ? `Этап ${String(assignment.route_stage_index).padStart(2, "0")}` : "Прямое назначение"}</span>
                                <strong>{assignment.executor_name || "Исполнитель"}</strong>
                                <small>{routeDirection || [work.source_language, work.target_language].filter(Boolean).join(" → ")}</small>
                              </div>
                              <div>
                                <span>Объём</span>
                                <strong>{executorVolumeLabel(assignment)}</strong>
                              </div>
                              <div>
                                <span>Ставка</span>
                                <strong>{rub(assignment.rate)}</strong>
                                <small>{billingUnitLabel(assignment.billing_unit)}</small>
                              </div>
                              <div>
                                <span>Стоимость</span>
                                <strong>{rub(assignment.cost)}</strong>
                                {assignment.cost_overridden && <small>Итог задан вручную</small>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="executor-finance-work__legacy">Себестоимость сохранена в старом формате работы: {rub(work.executor_cost)}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <details className="client-quote-summary phase5-client-quote">
            <summary>
              <div>
                <span className="overline">Для клиента</span>
                <strong>Предварительный расчёт</strong>
                <small>Открывайте только когда нужно скопировать расчёт для клиента.</small>
              </div>
              <span>Показать</span>
            </summary>
            <div className="phase5-client-quote__body">
              <Button type="button" variant="secondary" onClick={() => void copyClientSummary()}>
                {copiedClientSummary ? "Скопировано ✓" : "Скопировать текст"}
              </Button>
              <pre>{clientSummaryText}</pre>
            </div>
          </details>
        </aside>
      </section>

      {activeTab === "works" && workEditor && (
        <section className="work-inline-editor">
          <header>
            <div>
              <span className="overline">
                {workEditor.mode === "edit"
                  ? "Редактирование работы"
                  : "Новая работа"}
              </span>
              <h3>{serviceName(workEditor.draft.service_code)}</h3>
              <p>
                Поля разделены на параметры работы и финансовую ответственность.
              </p>
            </div>
            <Button variant="quiet" onClick={() => setWorkEditor(null)}>
              Закрыть
            </Button>
          </header>
          <section className="work-edit-module">
            <div className="work-edit-module__head">
              <span className="lc-number-badge">01</span>
              <div>
                <strong>Данные работы</strong>
                <small>Услуга, языковая пара, объём, сроки и статус.</small>
              </div>
            </div>
            <WorkDraft
              work={workEditor.draft}
              index={0}
              services={services}
              patch={(patch) =>
                setWorkEditor({
                  ...workEditor,
                  draft: { ...workEditor.draft, ...patch },
                })
              }
              remove={() => setWorkEditor(null)}
            />
          </section>
          <section className="work-edit-module">
            <div className="work-edit-module__head">
              <span className="lc-number-badge">02</span>
              <div>
                <strong>Финансы и исполнитель</strong>
                <small>
                  Клиентская ставка, себестоимость и назначенный специалист.
                </small>
              </div>
            </div>
            <div className="wizard-grid work-inline-editor__finance">
              {services.find((item) => item.code === workEditor.draft.service_code)?.definition ? (
                <div className="pricing-field executor-unit-readonly">
                  <span className="field__label">Единица тарифа</span>
                  <div className="calculated-value">
                    <strong>{billingUnitLabel(workEditor.draft.billing_unit)}</strong>
                    <small>Определяется выбранной услугой</small>
                  </div>
                </div>
              ) : (
                <Select
                  label="Единица тарифа"
                  value={workEditor.draft.billing_unit}
                  onChange={(e) => setWorkEditor({
                    ...workEditor,
                    draft: { ...workEditor.draft, billing_unit: e.target.value },
                  })}
                >
                  {billingUnits.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
              <Input
                label="Тариф клиенту, ₽"
                type="number"
                min="0"
                step="0.01"
                value={workEditor.draft.client_rate}
                onChange={(e) =>
                  setWorkEditor({
                    ...workEditor,
                    draft: { ...workEditor.draft, client_rate: e.target.value },
                  })
                }
              />
              <label className="manual-switch">
                <input
                  type="checkbox"
                  checked={workEditor.draft.manualPrice}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: {
                        ...workEditor.draft,
                        manualPrice: e.target.checked,
                      },
                    })
                  }
                />
                <span>Ручной итог</span>
              </label>
              {workEditor.draft.manualPrice && (
                <Input
                  label="Итог клиенту, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={workEditor.draft.price}
                  onChange={(e) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: { ...workEditor.draft, price: e.target.value },
                    })
                  }
                />
              )}
              <div className="work-inline-editor__assignments">
                <ExecutorAssignmentsEditor
                  work={workEditor.draft}
                  service={services.find((item) => item.code === workEditor.draft.service_code)}
                  matching={
                    workEditor.mode === "edit" && workEditor.workId
                      ? {
                          orderId,
                          workId: workEditor.workId,
                          lockedReason: executorMatchingLockReason(
                            workEditor.draft,
                            order.works.find((item) => item.id === workEditor.workId),
                          ),
                        }
                      : undefined
                  }
                  onChange={(executor_assignments) =>
                    setWorkEditor({
                      ...workEditor,
                      draft: { ...workEditor.draft, executor_assignments },
                    })
                  }
                />
              </div>
            </div>
          </section>
          <div className="work-inline-editor__actions">
            <Button variant="quiet" onClick={() => setWorkEditor(null)}>
              Отмена
            </Button>
            <Button disabled={savingWork} onClick={() => void saveWork()}>
              {savingWork ? "Сохраняем…" : "Сохранить работу"}
            </Button>
          </div>
        </section>
      )}

      <div className="order-card-layout order-deal-layout">
        <main>
          <section id="order-works" role="tabpanel" className={`order-card-section phase5-order-panel${activeTab === "works" ? " is-active" : ""}`}>
            <header>
              <div>
                <span className="overline">Работы</span>
                <h3>{order.works.length} в заказе</h3>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setWorkEditor({ mode: "new", draft: emptyWork() })
                }
              >
                Добавить работу +
              </Button>
            </header>
            <div className="order-work-table">
              {order.works.map((w, i) => {
                const direction = workDirectionLabel(w);
                const volume = workVolumeLabel(w);
                return (
                <article className="order-work-card" key={w.id}>
                  <div className="order-work-card__lead">
                    <span className="order-work-table__index lc-number-badge">{String(i + 1).padStart(2, "0")}</span>
                    <div className="order-work-card__identity">
                      <strong>{serviceName(w.service_code)}</strong>
                      <div className="order-work-card__meta">
                        <span className="order-work-card__direction">{direction}</span>
                        <span>{volume}</span>
                        {w.urgent && <span className="work-chip work-chip--urgent">Срочно</span>}
                        {w.native_speaker && <span className="work-chip">Носитель</span>}
                        {w.client_billable === false && <span className="work-chip">Внутренняя работа</span>}
                      </div>
                    </div>
                    <Badge tone={w.status === "COMPLETED" ? "success" : w.executor_assignments.length || w.executor_id ? "neutral" : "warning"}>
                      {statusLabel(w.status)}
                    </Badge>
                  </div>
                  <div className="order-work-card__grid">
                    <div>
                      <span>Исполнитель</span>
                      <strong>
                        {w.executor_assignments.length
                          ? w.executor_assignments.map((assignment) => assignment.executor_name || "Исполнитель").join(", ")
                          : w.executor_id
                            ? <ExecutorName id={w.executor_id} />
                            : "Не назначен"}
                      </strong>
                    </div>
                    <div>
                      <span>Дедлайн</span>
                      <strong>{w.deadline || "—"}</strong>
                    </div>
                    <div>
                      <span>Тариф клиенту</span>
                      <strong>{rub(w.client_rate)}</strong>
                    </div>
                    <div>
                      <span>Стоимость для клиента</span>
                      <strong>{w.client_billable === false ? "Не учитывается" : rub(w.price)}</strong>
                    </div>
                    <div>
                      <span>Выплата исполнителю</span>
                      <strong>{rub(w.executor_cost)}</strong>
                    </div>
                  </div>
                  <div className="work-row-actions">
                    <Button
                      type="button"
                      variant="quiet"
                      className="work-action"
                      onClick={() =>
                        setWorkEditor({
                          mode: "edit",
                          workId: w.id,
                          version: w.version,
                          draft: draftFromWork(w),
                        })
                      }
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      className="work-action"
                      onClick={() => void duplicateWork(w.id)}
                    >
                      Дублировать
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="work-action work-action--danger"
                      onClick={() => void archiveWork(w.id)}
                    >
                      В архив
                    </Button>
                  </div>
                </article>
              )})}
              {!order.works.length && <p className="crm-empty">В заказе пока нет работ.</p>}
            </div>
          </section>
          <section id="order-files" role="tabpanel" className={`order-card-section phase5-order-panel${activeTab === "files" ? " is-active" : ""}`}>
            <header>
              <div>
                <span className="overline">Файлы</span>
                <h3>Документы заказа</h3>
              </div>
              <label className="compact-upload">
                <input
                  type="file"
                  onChange={(e) =>
                    e.target.files?.[0] && void upload(e.target.files[0])
                  }
                />
                {uploading ? "Анализ…" : "Добавить файл +"}
              </label>
            </header>
            <div className="file-metrics-list">
              {order.files.map((f) => (
                <article key={f.id} className="file-metric-row">
                  <span className="file-metric-row__mark" aria-hidden="true">
                    {(f.original_name.split(".").pop() || "FILE")
                      .slice(0, 4)
                      .toUpperCase()}
                  </span>
                  <div
                    className="file-metric-row__copy"
                    title={f.original_name}
                  >
                    <strong>{f.original_name}</strong>
                    <small>
                      {f.analysis_note || "Файл прикреплён к заказу"}
                    </small>
                  </div>
                  <div className="file-metric-row__metric">
                    <span>Страниц</span>
                    <strong>{f.page_count ?? "—"}</strong>
                  </div>
                  <div className="file-metric-row__metric">
                    <span>Знаков</span>
                    <strong>
                      {f.character_count?.toLocaleString("ru-RU") ?? "—"}
                    </strong>
                  </div>
                  <Badge
                    tone={
                      f.analysis_status === "OK"
                        ? "success"
                        : f.analysis_status === "ERROR"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {f.analysis_status === "OK"
                      ? "Готово"
                      : f.analysis_status === "ERROR"
                        ? "Ошибка"
                        : f.analysis_status}
                  </Badge>
                  <div className="file-metric-row__actions">
                    {/\.(pdf|png|jpe?g|webp|gif|txt|csv)$/i.test(f.original_name) && <a className="button button--quiet" href={apiDownloadUrl(`/api/admin/orders/${order.id}/files/${f.id}/preview`)} target="_blank" rel="noreferrer">Открыть</a>}
                    <a className="button button--secondary" href={apiDownloadUrl(`/api/admin/orders/${order.id}/files/${f.id}/download`)}>Скачать</a>
                  </div>
                </article>
              ))}
              {!order.files.length && (
                <p className="crm-empty">Файлы ещё не прикреплены.</p>
              )}
            </div>
          </section>
        </main>
        <aside>
          <section
            className={`order-side-card order-payment-card phase5-order-panel${activeTab === "finance" ? " is-active" : ""} ${paymentEdit ? "is-editing" : ""}`}
          >
            <div className="order-side-card__head">
              <span className="overline">Оплата клиента</span>
              <Button
                type="button"
                variant="quiet"
                className="order-side-card__toggle"
                onClick={() => setPaymentEdit(!paymentEdit)}
              >
                {paymentEdit ? "Свернуть" : "Изменить"}
              </Button>
            </div>
            {paymentEdit ? (
              <div className="payment-edit">
                <Input
                  label="Оплачено, ₽"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentDraft.amount_paid}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      amount_paid: e.target.value,
                    })
                  }
                />
                <Select
                  label="Способ оплаты"
                  value={paymentDraft.payment_method}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_method: e.target.value })}
                >
                  <option value="">Не выбран</option>
                  <option value="cash">Наличные</option>
                  <option value="cashless">Безналичный расчёт</option>
                  <option value="deposit">Депозит</option>
                </Select>
                <Input
                  label="№ счёта"
                  value={paymentDraft.invoice_number}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      invoice_number: e.target.value,
                    })
                  }
                />
                <Input
                  label="Дата счёта"
                  type="date"
                  value={paymentDraft.invoice_date}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      invoice_date: e.target.value,
                    })
                  }
                />
                <Input
                  label="Дата оплаты"
                  type="date"
                  value={paymentDraft.paid_at}
                  onChange={(e) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      paid_at: e.target.value,
                    })
                  }
                />
                <Textarea
                  label="Комментарий"
                  rows={3}
                  value={paymentDraft.notes}
                  onChange={(e) =>
                    setPaymentDraft({ ...paymentDraft, notes: e.target.value })
                  }
                />
                <div className="payment-edit__actions">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setPaymentEdit(false);
                      setPaymentDraft({
                        amount_paid: String(order.payment?.amount_paid ?? 0),
                        payment_method: order.payment?.payment_method ?? "",
                        invoice_number: order.payment?.invoice_number ?? "",
                        invoice_date: order.payment?.invoice_date ?? "",
                        paid_at: order.payment?.paid_at ?? "",
                        notes: order.payment?.notes ?? "",
                      });
                    }}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={() => void savePayment()}>
                    Сохранить оплату
                  </Button>
                </div>
              </div>
            ) : (
              <div className="payment-summary">
                <div>
                  <span>К оплате</span>
                  <strong>
                    {rub(order.payment?.amount_due ?? order.financial.revenue)}
                  </strong>
                </div>
                <div>
                  <span>Оплачено</span>
                  <strong>{rub(order.payment?.amount_paid ?? 0)}</strong>
                </div>
                <div>
                  <span>Счёт</span>
                  <strong>{order.payment?.invoice_number || "—"}</strong>
                </div>
                <div>
                  <span>Дата оплаты</span>
                  <strong>{order.payment?.paid_at || "—"}</strong>
                </div>
              </div>
            )}
          </section>
          {order.application_id && activeTab === "core" && (
            <Link
              className="order-side-link"
              href={`/admin/applications/${order.application_id}`}
            >
              Исходная заявка ↗
            </Link>
          )}
        </aside>
      </div>
      <section id="order-history" role="tabpanel" className={`order-history-module phase5-order-panel${activeTab === "history" ? " is-active" : ""}`}>
        <OrderRecords id={order.id} disabled={order.archived} showFiles={false} />
      </section>
    </section>
  );
}

function ExecutorName({ id }: { id: string }) {
  const [name, setName] = useState("Исполнитель");
  useEffect(() => {
    let active = true;
    api<{ name: string }>(`/api/admin/executors/${id}`)
      .then((x) => {
        if (active) setName(x.name || "Исполнитель без имени");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return <>{name}</>;
}
