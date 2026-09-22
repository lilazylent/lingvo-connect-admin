import { test, expect, type Page } from "@playwright/test";
import { contrastRatio, gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase2-user",
  display_name: "Phase 2 QA",
  email: "phase2@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: null,
};

const application = {
  id: "phase2-application",
  number: "LC-A-000202",
  name: "Анна Смирнова",
  contact_method: "email",
  contact: "anna@example.invalid",
  email: "anna@example.invalid",
  phone: null,
  company: "ООО «Лингво Тест»",
  requested_service: "written_translation",
  source_language: "Русский",
  target_language: "Английский",
  message: "Перевод договора и приложений.",
  desired_date: null,
  status_code: "NEW",
  responsible_manager: user,
  internal_summary: null,
  source: "manual",
  source_identifier: null,
  submitted_at: "2026-09-15T08:00:00Z",
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  version: 1,
  comments: [],
  files: [],
  activity: [],
};

async function fixtures(page: Page) {
  let interfaceTheme = "light";
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3011",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });

    let json: unknown = { items: [], total: 0, page: 1, pages: 1, page_size: 20 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) {
      if (method === "PATCH") interfaceTheme = (route.request().postDataJSON() as { interface_theme: string }).interface_theme;
      json = { interface_theme: interfaceTheme };
    } else if (path.endsWith("/managers")) json = [user];
    else if (path.endsWith("/applications")) json = { items: [application], total: 1, page: 1, pages: 1, page_size: 20 };
    else if (path.endsWith("/phase2-application")) json = application;
    else if (path.endsWith("/companies") || path.endsWith("/orders")) json = { items: [], total: 0, page: 1, pages: 1 };
    else if (path.endsWith("/client")) json = { client_id: null };
    else if (path.endsWith("/users")) json = [user];
    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("shared controls use the Phase 2 geometry and visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/applications/new");

  const input = page.getByLabel("Имя контакта", { exact: true });
  const select = page.getByRole("combobox", { name: "Способ связи", exact: true });
  const submit = page.getByRole("button", { name: "Создать заявку →" });

  expect((await input.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await select.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await input.focus();
  await expect(input).toBeFocused();
  const focusVisual = await input.evaluate((node) => {
    const style = getComputedStyle(node);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(focusVisual.outline !== "none" || focusVisual.shadow !== "none").toBeTruthy();

  await select.click();
  const popup = page.locator(".select-popup");
  await expect(popup).toBeVisible();
  const popupBox = await popup.boundingBox();
  expect(popupBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((popupBox?.x ?? 0) + (popupBox?.width ?? 0)).toBeLessThanOrEqual(1440);
});

test("table, badge and pagination share one operational surface", async ({ page }) => {
  const listResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/admin/applications") && !url.search && response.request().method() === "GET";
  });
  await page.goto("/admin/applications");
  await listResponse;

  const surface = page.locator(".table-surface");
  const badge = surface.locator(".badge").first();
  await expect(surface).toBeVisible();
  await expect(badge).toBeVisible();

  const geometry = await surface.evaluate((node) => {
    const surfaceStyle = getComputedStyle(node);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      actual: Number.parseFloat(surfaceStyle.borderRadius),
      token: Number.parseFloat(rootStyle.getPropertyValue("--ui-radius-card")),
    };
  });
  const badgeGeometry = await badge.evaluate((node) => {
    const badgeStyle = getComputedStyle(node);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      actual: Number.parseFloat(badgeStyle.borderRadius),
      token: Number.parseFloat(rootStyle.getPropertyValue("--ui-radius-round")),
    };
  });
  expect(geometry.actual).toBeCloseTo(geometry.token, 2);
  expect(badgeGeometry.actual).toBeCloseTo(badgeGeometry.token, 2);

  const row = surface.locator("tbody tr").first();
  await expect(row).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const before = await row.boundingBox();
  await row.hover();
  const after = await row.boundingBox();
  const transform = await row.evaluate((node) => getComputedStyle(node).transform);
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(transform).toBe("none");
  expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThanOrEqual(0.5);
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThanOrEqual(0.5);
});

test("shared kit derives Dark from semantic tokens without light islands", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/applications/new", "dark");

  const input = page.getByLabel("Имя контакта", { exact: true });
  const button = page.getByRole("button", { name: "Создать заявку →" });
  await expect(input).toBeVisible();
  await expect(button).toBeVisible();

  const inputColors = await input.evaluate((node) => {
    const style = getComputedStyle(node);
    return { foreground: style.color, background: style.backgroundColor };
  });
  const buttonBg = await button.evaluate((node) => getComputedStyle(node).backgroundColor);

  expect(inputColors.background).not.toBe("rgb(255, 255, 255)");
  expect(buttonBg).not.toBe("rgb(255, 255, 255)");
  expect(contrastRatio(inputColors.foreground, inputColors.background)).toBeGreaterThanOrEqual(4.5);
});

for (const width of [900, 620, 430, 390, 360, 320]) {
  test(`shared kit has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/applications/new");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}
