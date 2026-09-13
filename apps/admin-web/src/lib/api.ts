export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

function csrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("lc_csrf="))
    ?.split("=")
    .slice(1)
    .join("=");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers.set("x-csrf-token", decodeURIComponent(token));
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // FastAPI validation detail can be an array, never render that object as UI copy.
    const message = typeof body?.detail === "string" ? body.detail
      : response.status === 422 ? "Проверьте заполнение полей и повторите сохранение."
      : "Не удалось выполнить запрос. Попробуйте ещё раз.";
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export function apiDownloadUrl(path: string): string {
  return `${API_URL}${path}`;
}
