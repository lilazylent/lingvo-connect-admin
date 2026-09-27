const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCrmDate(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const dateOnly = dateOnlyPattern.exec(value);
  if (dateOnly) return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatCrmDateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(date);
}
