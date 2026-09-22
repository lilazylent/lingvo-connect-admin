import { expect, test, type Page } from "@playwright/test";
import { gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase6-admin",
  display_name: "Lilazylent",
  email: "phase6@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: "2026-09-15T08:00:00Z",
};

const colleague = {
  ...user,
  id: "phase6-manager",
  display_name: "Анна Менеджер",
  email: "anna.manager@example.invalid",
  role: "MANAGER",
  two_factor_enabled: false,
  last_login_at: null,
};

const file = {
  id: "file-phase6",
  source: "order",
  entity_id: "order-phase6",
  entity_number: "LC-O-000601",
  entity_title: "Перевод договора",
  original_name: "contract.pdf",
  mime_type: "application/pdf",
  size_bytes: 245760,
  page_count: 8,
  character_count: 14200,
  word_count: 2300,
  analysis_status: "OK",
  analysis_note: "Распознано автоматически",
  uploaded_at: "2026-09-15T10:00:00Z",
  extension: "pdf",
  download_path: "/api/admin/orders/order-phase6/files/file-phase6/download",
  preview_path: "/api/admin/orders/order-phase6/files/file-phase6/preview",
  entity_path: "/admin/orders?open=order-phase6",
};

const services = [
  { id: "service-written", code: "written_translation", name: "Письменный перевод", billing_mode: "CONDITIONAL_PAGE", active: true, sort_order: 10, notes: "" },
  { id: "service-consecutive", code: "consecutive_interpreting", name: "Устный последовательный перевод", billing_mode: "HOURLY", active: true, sort_order: 20, notes: "" },
];
const languages = [
  { id: "lang-ru", name: "Русский", active: true, sort_order: 10 },
  { id: "lang-en", name: "Английский", active: true, sort_order: 20 },
];

async function fixtures(page: Page) {
  let theme = "light";
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3011",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });

    let json: unknown = {};
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) {
      if (method === "PATCH") theme = (route.request().postDataJSON() as { interface_theme: string }).interface_theme;
      json = { interface_theme: theme };
    } else if (path.endsWith("/files")) {
      json = { items: [file], total: 1, total_bytes: file.size_bytes, order_files: 1, application_files: 0, page: 1, pages: 1 };
    } else if (path.endsWith("/users")) json = [user, colleague];
    else if (path.endsWith("/executors")) json = { items: [], total: 0, page: 1, pages: 1 };
    else if (path.endsWith("/crm/services")) json = services;
    else if (path.endsWith("/crm/languages")) json = { items: languages };
    else if (path.endsWith("/crm/tariffs")) json = [];
    else if (path.endsWith("/crm/pricing-rules")) json = [];
    else if (path.endsWith("/crm/order-statuses")) json = [{ code: "NEW", name: "Новый", color: "blue", board: "MAIN", active: true, sort_order: 10 }];
    else if (path.endsWith("/crm/orders")) json = { items: [{ id: "order-phase6", number: "LC-O-000601", title: "Перевод договора", client_name: "ООО Атлас" }], total: 1, page: 1, pages: 1 };
    else if (path.endsWith("/applications")) json = { items: [], total: 0, page: 1, pages: 1, page_size: 20 };
    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("Files is an operational split workspace with real preview/download/source actions", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/files", "dark");
  await expect(page.getByRole("heading", { name: "Файлы" })).toBeVisible();
  await expect(page.getByText("contract.pdf", { exact: true })).toBeVisible();
  await page.getByText("contract.pdf", { exact: true }).click();

  const panel = page.locator(".phase6-file-preview");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: /Просмотреть/ })).toHaveAttribute("href", /preview/);
  await expect(panel.getByRole("link", { name: /Скачать/ })).toHaveAttribute("href", /download/);
  await expect(panel.getByRole("link", { name: /Перейти к источнику/ })).toHaveAttribute("href", "/admin/orders?open=order-phase6");

  const download = page.locator(".files-row__download");
  const background = await download.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).not.toBe("rgb(255, 255, 255)");
});

test("Users action menu stays inside the viewport and closes outside/Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.goto("/admin/users");
  const colleagueRow = page.locator(".phase6-users-table tbody tr").filter({ hasText: "Анна Менеджер" });
  await colleagueRow.focus();
  await page.keyboard.press("Enter");
  await expect(colleagueRow).toHaveAttribute("aria-selected", "true");
  const trigger = page.getByRole("button", { name: "Действия для Анна Менеджер" });
  await trigger.click();
  const menu = page.locator(".action-menu__popover");
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1024);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(560);

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await trigger.click();
  await page.locator(".phase6-users__head").click();
  await expect(menu).toBeHidden();
});

test("Settings exposes one modular system and canonical language/service dictionaries", async ({ page }) => {
  await page.goto("/admin/settings");
  const nav = page.getByRole("navigation", { name: "Модули настроек" });
  for (const name of ["Справочники", "Тарифы", "Скидки и коэффициенты", "Оформление", "Услуги и единицы", "Статусы заказов"]) {
    await expect(nav.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByText("Русский", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Изменить" }).first().click();
  await expect(page.getByLabel("Название языка")).toBeDisabled();
  await page.getByRole("button", { name: "Закрыть окно" }).click();

  await nav.getByRole("button", { name: /Услуги и единицы/ }).click();
  await expect(page.getByText("Письменный перевод", { exact: true })).toBeVisible();
  await expect(page.getByText("Устный последовательный перевод", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Изменить" }).first().click();
  await expect(page.getByLabel("Код *", { exact: true })).toBeDisabled();
});


test("Executor capability editor uses canonical services, bidirectional pairs and default rates", async ({ page }) => {
  await page.goto("/admin/translators");
  await page.getByRole("button", { name: /Добавить исполнителя/ }).click();
  await page.getByRole("button", { name: "Добавить направление" }).click();
  const service = page.getByLabel("Услуга 1");
  await expect(service).toBeVisible();
  await expect(service.locator("option", { hasText: "Письменный перевод" })).toHaveCount(1);
  await expect(page.getByLabel(/Ставка по умолчанию 1/)).toBeVisible();
  await expect(page.getByLabel("Единица ставки 1")).toBeVisible();
  await expect(page.getByLabel("Язык пары A 1")).toBeVisible();
  await expect(page.getByLabel("Язык пары B 1")).toBeVisible();
});

for (const width of [900, 620, 430, 320]) {
  test(`Phase 06 workspaces stay document-bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    for (const path of ["/admin/files", "/admin/users", "/admin/settings"]) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
