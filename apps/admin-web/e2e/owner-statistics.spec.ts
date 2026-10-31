import { expect, test, type Page } from "@playwright/test";

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const bucket = (extra: Record<string, unknown>) => ({ orders: 2, works: 3, pages: 12.5, documents: 1, hours: 0, revenue: 30000, executor_cost: 12000, profit: 18000, ...extra });
const statistics = {
  totals: { ...bucket({}), orders_all: 4, paid: 20000, debt: 10000, margin_percent: 60 },
  by_service: [bucket({ service_code: "written_translation", name: "Письменный перевод" })],
  by_topic: [bucket({ topic: "юридическая" })],
  by_client: [bucket({ client_id: "client-alpha", name: "ООО «Альфа» с очень длинным названием компании для проверки переноса", kind: "company" })],
  by_executor: [bucket({ name: "Мария Переводчик" })],
  by_month: [bucket({ month: "2026-09" })],
};
const client = { id: "client-alpha", name: "ООО «Альфа»", email: "", phone: "", notes: "", archived: false, version: 1, kind: "company", stats: { orders_count: 2, revenue: 30000, executor_cost: 12000, profit: 18000 } };

async function fixtures(page: Page, requests: string[] = []) {
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    let json: unknown = { items: [], total: 0, page: 1, pages: 1 };
    if (url.pathname.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (url.pathname.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
    else if (url.pathname.endsWith("/crm/statistics")) json = statistics;
    else if (url.pathname.endsWith("/crm/services")) json = [{ code: "written_translation", name: "Письменный перевод", billing_mode: "CONDITIONAL_PAGE", active: true }];
    else if (url.pathname.endsWith("/crm/order-statuses")) json = [];
    else if (url.pathname.endsWith("/applications/managers")) json = [user];
    else if (url.pathname.endsWith("/crm/orders/number-preview")) json = { number: "26-0670" };
    else if (url.pathname.endsWith("/crm/clients/client-alpha/summary")) json = { order_count: 2, active_orders: 1, revenue: 30000, executor_cost: 12000, profit: 18000, debt: 0, deposit_balance: 0, last_order: null, orders: [] };
    else if (url.pathname.endsWith("/companies") && request.method() === "POST") json = { id: "client-new", name: JSON.parse(request.postData() || "{}").name };
    else if (url.pathname.endsWith("/companies/client-alpha/deposit")) json = { company_id: "client-alpha", balance: 0, transactions: [] };
    else if (url.pathname.endsWith("/companies/client-alpha")) json = client;
    else if (url.pathname.endsWith("/companies")) json = url.searchParams.get("q") ? { items: [], total: 0, page: 1, pages: 1 } : { items: [client], total: 1, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
}

test("statistics page shows totals, breakdowns, URL filters and a filtered export", async ({ page }) => {
  const requests: string[] = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/statistics?client=client-alpha&date_from=2026-09-01");
  await expect(page.getByRole("heading", { name: "Статистика" })).toBeVisible();
  const tiles = page.getByRole("region", { name: "Итоги" });
  await expect(tiles).toContainText("Выручка");
  await expect(tiles).toContainText("Прибыль");
  await expect(tiles).toContainText("60 %");
  expect(requests.some((r) => r.includes("/crm/statistics?") && r.includes("client_id=client-alpha") && r.includes("date_from=2026-09-01"))).toBe(true);
  // a client filter opens the monthly view of that client
  await expect(page.getByRole("tab", { name: "По месяцам" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".crm-statistics__table tbody")).toContainText("Сентябрь 2026");
  await expect(page.getByRole("link", { name: "Выгрузить в Excel" })).toHaveAttribute("href", /statistics\/export\.xlsx\?.*client_id=client-alpha/);
  await page.getByRole("tab", { name: "По исполнителям" }).click();
  await expect(page.locator(".crm-statistics__table tbody")).toContainText("Мария Переводчик");
  if (process.env.CAPTURE_OWNER_QA) await page.screenshot({ path: "test-results/owner-statistics-light.png", fullPage: true });
  await page.getByRole("button", { name: "Весь период" }).click();
  await expect(page).not.toHaveURL(/date_from/);
  await expect(page.getByRole("link", { name: "Статистика" })).toHaveAttribute("aria-current", "page");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((next) => document.documentElement.setAttribute("data-crm-theme", next), theme);
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest(".table-wrap, .view-switch")).slice(0, 5).map((el) => `${el.tagName}.${el.className}`));
      expect(overflow, `${theme} ${width}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (process.env.CAPTURE_OWNER_QA && (width === 375 || width === 1440)) await page.screenshot({ path: `test-results/owner-statistics-${theme}-${width}.png`, fullPage: true });
    }
  }
});

test("clients can be filtered by kind and ranked by revenue, profit and order count", async ({ page }) => {
  const requests: string[] = [];
  await fixtures(page, requests);
  await page.goto("/admin/clients");
  const pick = async (label: string, option: string) => { await page.getByLabel(label).click(); await page.getByRole("option", { name: option, exact: true }).click(); };
  await pick("Тип клиента", "Частные лица");
  await expect.poll(() => requests.some((r) => r.startsWith("GET /api/admin/companies?") && r.includes("kind=individual"))).toBe(true);
  await pick("Сортировка", "Выше прибыль");
  await expect.poll(() => requests.some((r) => r.includes("sort=profit") && r.includes("order=desc"))).toBe(true);
  await pick("Тип клиента", "Все клиенты");
  await expect(page.locator(".directory-table tbody")).toContainText("Прибыль 18");
  await page.locator(".directory-table tbody tr").first().click();
  await expect(page.locator(".directory-detail-panel")).toContainText("Выплаты исполнителям");
  if (process.env.CAPTURE_OWNER_QA) await page.screenshot({ path: "test-results/owner-clients-stats.png" });
  await expect(page.locator(".directory-detail-panel").getByRole("link", { name: "Статистика" })).toHaveAttribute("href", "/admin/statistics?client=client-alpha");
});

test("orders export follows the visible filters", async ({ page }) => {
  await fixtures(page);
  await page.goto("/admin/orders?overdue=true");
  const link = page.getByRole("link", { name: "Выгрузить в Excel" });
  await expect(link).toHaveAttribute("href", /orders\/export\.xlsx\?.*overdue=true/);
  await expect(link).not.toHaveAttribute("href", /page_size/);
  if (process.env.CAPTURE_OWNER_QA) await page.locator(".phase5-orders-command").screenshot({ path: "test-results/owner-orders-export.png" });
});

test("new order wizard creates a typed client inline and keeps the number editable", async ({ page }) => {
  const requests: string[] = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: "Новый заказ" }).click();
  await expect(page.getByLabel("Номер заказа")).toHaveValue("26-0670");
  await page.getByLabel("Номер заказа").fill("26-0800");
  await expect(page.getByText("Автоматический номер: 26-0670")).toBeVisible();
  await expect(page.getByLabel("Дата заказа")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByLabel("Клиент", { exact: true }).fill("Новый клиент Олега");
  const create = page.getByRole("button", { name: /Создать частное лицо «Новый клиент Олега»/ });
  await expect(create).toBeVisible();
  if (process.env.CAPTURE_OWNER_QA) await page.screenshot({ path: "test-results/owner-wizard-create.png" });
  await expect(page.getByRole("button", { name: /Создать компанию «Новый клиент Олега»/ })).toBeVisible();
  await create.click();
  await expect.poll(() => requests.includes("POST /api/admin/companies")).toBe(true);
  await expect(page.getByText("Новый клиент Олега").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Создать частное лицо/ })).toHaveCount(0);
});
