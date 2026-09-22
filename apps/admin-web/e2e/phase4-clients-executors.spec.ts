import { expect, test, type Page } from "@playwright/test";
import { gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase4-user",
  display_name: "Lilazylent",
  email: "phase4@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: "2026-09-15T08:00:00Z",
};

const company = {
  id: "company-atlas",
  name: "ООО Атлас",
  kind: "company",
  email: "office@atlas.example.invalid",
  phone: "+79990001122",
  manager_id: user.id,
  tax_id: "7812345678",
  notes: "Клиент предпочитает согласовывать сроки по email.",
  archived: false,
  version: 1,
};

const clientOrder = {
  id: "order-atlas-1",
  number: "LC-O-000401",
  title: "Перевод договора",
  client_id: company.id,
  deadline: "2026-09-22",
  status: "IN_PROGRESS",
  archived: false,
};

const executor = {
  id: "executor-anna",
  name: "Анна Переводчик",
  email: "anna.translator@example.invalid",
  phone: "+79995550011",
  telegram: "@anna_translator",
  notes: "Работает с юридическими текстами.",
  archived: false,
  version: 1,
  directions: [
    { executor_id: "executor-anna", source_language: "Русский", target_language: "Английский", work_type: "written_translation" },
    { executor_id: "executor-anna", source_language: "Английский", target_language: "Русский", work_type: "proofreading" },
  ],
};

const executorWork = {
  id: "work-anna-1",
  order_id: clientOrder.id,
  work_type: "written_translation",
  service_code: "written_translation",
  source_language: "Русский",
  target_language: "Английский",
  status: "IN_PROGRESS",
  deadline: "2026-09-20",
};

const executorAssignment = {
  id: "assignment-anna-1",
  work_id: executorWork.id,
  executor_id: executor.id,
  character_count: 12400,
  page_count: 6.9,
  billing_unit: "CONDITIONAL_PAGE",
  rate: 850,
  cost: 5865,
  amount_paid: 2000,
  paid_at: null,
  deadline: "2026-09-20",
  deadline_time: "18:00",
  status: "IN_PROGRESS",
  notes: "",
  work: executorWork,
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
    } else if (path.endsWith(`/crm/clients/${company.id}/summary`)) {
      json = { client: company, orders: [clientOrder], order_count: 1, active_orders: 1, revenue: 26631, debt: 4600, last_order: clientOrder };
    } else if (path.endsWith(`/crm/executors/${executor.id}/summary`)) {
      json = { executor, assignments: [executorAssignment], works: [executorWork], active_works: 1, completed_works: 3, amount_due: 5865, amount_paid: 2000, owed: 3865 };
    } else if (path.endsWith(`/companies/${company.id}/representatives`)) {
      json = { items: [{ id: "contact-1", company_id: company.id, name: "Мария Иванова", position: "Менеджер", email: "maria@atlas.example.invalid", phone: "+79997778899", notes: "Основной контакт", archived: false, version: 1 }], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith(`/orders/${clientOrder.id}/works`)) {
      json = { items: [executorWork], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith(`/companies/${company.id}/activity`)) {
      json = { items: [{ id: "client-event", action: "company.updated", created_at: "2026-09-15T08:20:00Z" }], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith(`/executors/${executor.id}/activity`)) {
      json = { items: [{ id: "executor-event", action: "executor.updated", created_at: "2026-09-15T08:30:00Z" }], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith("/companies")) {
      const archived = url.searchParams.get("archived") === "true";
      json = archived ? { items: [], total: 0, page: 1, pages: 1 } : { items: [company], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith("/executors")) {
      const archived = url.searchParams.get("archived") === "true";
      json = archived ? { items: [], total: 0, page: 1, pages: 1 } : { items: [executor], total: 1, page: 1, pages: 1 };
    } else if (path.endsWith("/users")) json = [user];
    await route.fulfill({ status: 200, headers, json });
  });
}

function contrastRatio(foreground: string, background: string) {
  const rgb = (value: string) => value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
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

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("Clients workspace uses real CRM totals and interactive detail tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/clients");

  const row = page.locator(".directory-table tbody tr").first();
  await expect(row).toContainText("ООО Атлас");
  await expect(row).toContainText("1 заказов");
  await expect(row).toContainText("26 631");
  await expect(row).toContainText("Долг 4 600");

  await row.click();
  await expect(page.getByRole("heading", { name: "ООО Атлас" })).toBeVisible();
  await expect(page.getByText("7812345678", { exact: true })).toBeVisible();
  await expect(page.getByText("Русский → Английский", { exact: true })).toBeVisible();

  const contactsTab = page.getByRole("tab", { name: "Контакты" });
  await contactsTab.click();
  await expect(contactsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Мария Иванова", { exact: true })).toBeVisible();
  await expect(page.getByText("maria@atlas.example.invalid", { exact: false })).toBeVisible();

  const ordersTab = page.getByRole("tab", { name: "Заказы" });
  await ordersTab.click();
  await expect(page.getByText("Перевод договора", { exact: true })).toBeVisible();
  await expect(page.getByText("LC-O-000401", { exact: true })).toBeVisible();

  const historyTab = page.getByRole("tab", { name: "История" });
  await historyTab.click();
  await expect(page.getByText("Изменены данные клиента", { exact: true })).toBeVisible();
});

test("Executors workspace shows directions, workload and real assignment money", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/translators");

  const row = page.locator(".directory-table tbody tr").first();
  await expect(row).toContainText("Анна Переводчик");
  await expect(row).toContainText("Русский ↔ Английский");
  // Summary cells are populated by a second real CRM request. Do not assert
  // their placeholder before that request resolves.
  await expect(row).not.toContainText("Загрузка данных");
  await expect(row).toContainText("1 активных");
  await expect(row).toContainText(/3[\s ]*865/);

  await row.click();
  const panel = page.locator(".directory-detail-panel");
  await expect(panel).toBeVisible();

  const directionsTab = panel.getByRole("tab", { name: "Направления" });
  await directionsTab.click();
  await expect(panel.getByText("Письменный перевод", { exact: true })).toBeVisible();
  await expect(panel.getByText("Корректура", { exact: true })).toBeVisible();

  const worksTab = panel.getByRole("tab", { name: "Работы" });
  await worksTab.click();
  await expect(panel.getByText(/Ставка[^0-9]*850/)).toBeVisible();
  await expect(panel.getByText(/Начислено[^0-9]*5[\s ]*865/)).toBeVisible();

  const historyTab = panel.getByRole("tab", { name: "История" });
  await historyTab.click();
  await expect(panel.getByText("Изменены данные исполнителя", { exact: true })).toBeVisible();
});

test("Phase 04 directory detail keeps semantic Dark contrast without white islands", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/clients", "dark");
  const row = page.locator(".directory-table tbody tr").first();
  await expect(row).not.toContainText("Загрузка данных");
  await row.click();

  const panel = page.locator(".directory-detail-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".directory-summary-grid")).toBeVisible();
  const panelBg = await panel.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(panelBg).not.toBe("rgb(255, 255, 255)");

  for (const locator of [panel.locator(".directory-facts dd").first(), panel.locator(".directory-summary-grid strong").first()]) {
    const colors = await locator.evaluate((node) => {
      const style = getComputedStyle(node);
      const surface = node.closest(".directory-detail-panel") as HTMLElement;
      return { foreground: style.color, background: getComputedStyle(surface).backgroundColor };
    });
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
});

for (const width of [900, 620, 430, 390, 360, 320]) {
  test(`Phase 04 workspaces keep document width bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/admin/clients");
    await page.locator(".directory-table tbody tr").first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.goto("/admin/translators");
    await page.locator(".directory-table tbody tr").first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
