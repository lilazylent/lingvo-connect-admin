// Canonical compact presentation of billing quantities and rates.
// Used by works, executors, finance, the order wizard and the copied client estimate,
// so every compact place shows the same commercial unit (e.g. "9 усл. стр." and
// "230 ₽/усл.стр.") instead of raw characters or long technical unit names.

const QUANTITY_UNITS: Record<string, string> = {
  CONDITIONAL_PAGE: "усл. стр.",
  PER_1000_CHARS: "тыс. зн.",
  PER_PAGE: "факт. стр.",
  PER_DOCUMENT: "док.",
  PER_SECOND: "сек.",
  PER_MINUTE: "мин.",
  HOURLY: "ч.",
};

const RATE_UNITS: Record<string, string> = {
  CONDITIONAL_PAGE: "₽/усл.стр.",
  PER_1000_CHARS: "₽/1000 зн.",
  PER_PAGE: "₽/факт.стр.",
  PER_DOCUMENT: "₽/док.",
  PER_SECOND: "₽/сек.",
  PER_MINUTE: "₽/мин.",
  HOURLY: "₽/час",
  FIXED: "₽/услугу",
  CUSTOM: "₽/ед.",
};

/** Russian number with at most one decimal: 9 · 9,5 · 40,7 (never "9,0"). */
export function formatBillingNumber(value: number | string | null | undefined): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/** Billing volume in the commercial unit, e.g. "9 усл. стр.", "3 док.", "2,5 ч.". */
export function formatBillingQuantity(unit: string, quantity: number | string | null | undefined): string {
  if (unit === "FIXED") return "1 услуга";
  const formatted = formatBillingNumber(quantity);
  const suffix = QUANTITY_UNITS[unit];
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/** Compact rate unit, e.g. "₽/усл.стр.". */
export function formatRateUnit(unit: string | null | undefined): string {
  return RATE_UNITS[unit || ""] ?? "₽/ед.";
}

/** Compact rate, e.g. "230 ₽/усл.стр.", "1 200 ₽/час". */
export function formatRate(rate: number | string | null | undefined, unit: string | null | undefined): string {
  const amount = Number(rate ?? 0);
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${formatRateUnit(unit)}`;
}
