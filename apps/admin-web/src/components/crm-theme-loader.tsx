"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { applyCrmTheme, type CrmThemePreference } from "@/lib/crm-theme";

export function CrmThemeLoader() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.crmThemeReady = "false";
    const stored = window.localStorage.getItem("lc-crm-theme") as CrmThemePreference | null;
    applyCrmTheme(stored ?? "system");
    api<{ interface_theme: CrmThemePreference }>("/api/admin/users/me/preferences")
      .then(({ interface_theme }) => applyCrmTheme(interface_theme))
      .catch(() => undefined)
      .finally(() => { root.dataset.crmThemeReady = "true"; });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      if (root.dataset.crmThemePreference === "system") applyCrmTheme("system");
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);
  return null;
}
