const dateOnlyPattern = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/;
const pad = (value: number) => String(value).padStart(2, "0");

// Owner format: ДД.ММ.ГГ (two-digit year) everywhere in the CRM.
function shortDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${pad(date.getFullYear() % 100)}`;
}

export function formatCrmDate(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const dateOnly = dateOnlyPattern.exec(value);
  if (dateOnly) return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : shortDate(date);
}

export function formatCrmDateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : `${shortDate(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
