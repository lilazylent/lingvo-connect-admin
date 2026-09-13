export type CrmThemePreference = "system" | "light" | "dark";

export function applyCrmTheme(preference: CrmThemePreference) {
  if (typeof window === "undefined") return;
  const resolved = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.crmTheme = resolved;
  document.documentElement.dataset.crmThemePreference = preference;
  window.localStorage.setItem("lc-crm-theme", preference);
}
