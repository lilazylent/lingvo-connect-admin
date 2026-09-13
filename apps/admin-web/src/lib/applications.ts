import type { ApplicationSource, ApplicationStatus } from "@/lib/types";

export const statusOptions: Array<{ value: ApplicationStatus; label: string; tone: "accent" | "warning" | "success" | "neutral" }> = [
  { value: "NEW", label: "Новая", tone: "accent" },
  { value: "IN_PROGRESS", label: "В работе", tone: "warning" },
  { value: "COMPLETED", label: "Завершена", tone: "success" },
  { value: "CANCELLED", label: "Отменена", tone: "neutral" },
];

export const serviceOptions = [
  ["written_translation", "Письменный перевод"],
  ["interpreting", "Устный перевод"],
  ["certification", "Заверение и легализация"],
  ["localization", "Локализация"],
  ["additional", "Дополнительные услуги"],
  ["not_sure", "Нужна консультация"],
] as const;

export const sourceLabels: Record<ApplicationSource, string> = { website: "Сайт", manual: "Вручную" };

export function statusMeta(status: ApplicationStatus) {
  return statusOptions.find((item) => item.value === status) ?? statusOptions[0];
}

export function serviceLabel(code: string): string {
  return serviceOptions.find(([value]) => value === code)?.[1] ?? code;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
