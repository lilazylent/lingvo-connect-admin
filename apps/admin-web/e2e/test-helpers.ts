import { expect, type Page } from "@playwright/test";

/**
 * Wait for the CRM preference bootstrap before forcing a test theme.
 * CrmThemeLoader fetches the persisted preference after hydration; forcing the
 * data attribute before that request settles creates a race where Light can
 * overwrite Dark in the middle of an assertion.
 */
export async function gotoWithCrmTheme(
  page: Page,
  path: string,
  theme: "light" | "dark",
) {
  const preferenceResponse = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/api/admin/users/me/preferences") &&
        response.request().method() === "GET"
      );
    } catch {
      return false;
    }
  });

  await page.goto(path);
  await preferenceResponse;
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme-ready", "true");
  await page.evaluate((nextTheme) => {
    document.documentElement.dataset.crmTheme = nextTheme;
    document.documentElement.dataset.crmThemePreference = nextTheme;
    window.localStorage.setItem("lc-crm-theme", nextTheme);
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme", theme);
}

/**
 * The document itself must never gain horizontal overflow. Individual dense
 * data surfaces are allowed to scroll inside their own .table-wrap.
 */
export async function expectDocumentBounded(page: Page, tolerance = 1) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(tolerance);
}

export function contrastRatio(foreground: string, background: string) {
  const rgb = (value: string) =>
    value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const luminance = (value: string) => {
    const [r, g, b] = rgb(value).map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
