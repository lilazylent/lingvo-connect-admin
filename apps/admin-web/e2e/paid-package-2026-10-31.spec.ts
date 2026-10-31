import { expect, test, type Locator, type Page } from "@playwright/test";

// Paid upgrade package 2026-10-31 (DOCX v3): 5-step order registration, compact header summary,
// «Общее и Клиент», config-driven work forms, payment layouts, tariffs and volumes.

type Request = { method: string; path: string; body: string };

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const colleague = { ...user, id: "manager-2", display_name: "Второй менеджер", role: "MANAGER" };

type Fixtures = { services?: unknown[]; detail?: Record<string, unknown>; extra?: (path: string, url: URL, request: Request) => unknown };

async function fixtures(page: Page, requests: Request[] = [], options: Fixtures = {}) {
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const entry = { method: request.method(), path: url.pathname + url.search, body: request.postData() || "" };
    requests.push(entry);
    const path = url.pathname;
    let json: unknown = options.extra?.(path, url, entry);
    if (json === undefined) {
      json = { items: [], total: 0, page: 1, pages: 1 };
      if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
      else if (path.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
      else if (path.endsWith("/crm/services")) json = options.services ?? [];
      else if (path.endsWith("/crm/order-statuses")) json = [];
      else if (path.endsWith("/crm/topics")) json = { items: [] };
      else if (path.endsWith("/applications/managers")) json = [colleague, user];
      else if (path.endsWith("/crm/orders/number-preview")) json = { number: "26-0702" };
      else if (path.endsWith("/api/admin/companies")) json = { items: [{ id: "client-1", name: "ООО Спектр" }] };
      else if (path.endsWith("/companies/client-1/representatives")) json = { items: [{ id: "contact-1", name: "Иван Петров" }] };
      else if (path.endsWith("/crm/pricing/options")) json = { options: [], auto_key: "", resolution: "not_found", message: "" };
      else if (path.endsWith("/crm/orders/wizard")) json = { id: "created-order", works: [] };
      else if (options.detail && path.endsWith(`/crm/orders/${options.detail.id}`)) json = options.detail;
      else if (path.endsWith("/crm/orders")) json = { items: [], total: 0, total_all: 0, page: 1, pages: 1 };
    }
    await route.fulfill({ status: 200, headers, json });
  });
}

const pick = async (page: Page, scope: Locator, label: string, option: string) => {
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

async function openWizard(page: Page, requests: Request[] = [], options: Fixtures = {}, width = 1440) {
  await fixtures(page, requests, options);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: /Новый заказ/ }).first().click();
  return page.locator(".crm-wizard");
}

test("wizard has the five v3 steps and a compact summary right of the title", async ({ page }) => {
  const wizard = await openWizard(page);
  await expect(wizard.locator(".wizard-steps button")).toHaveText(["01Общее и Клиент", "02Работы", "03Расчёт", "04Исполнители", "05Обзор"]);
  const summary = wizard.locator(".order-header-summary");
  // the next free number is shown as provisional, never as an assigned one
  await expect(summary).toContainText("Номер · предв.");
  await expect(summary).toContainText("26-0702");
  await expect(summary).toContainText("Новый");
  // same row as the title, not a separate sidebar; «Номер» left of «Дата» in one line
  // (one synchronous measurement: the wizard is still scrolling into view)
  const geometry = await wizard.evaluate((node) => {
    const rect = (selector: string) => node.querySelector(selector)!.getBoundingClientRect();
    const title = rect("h2");
    const summary = rect(".order-header-summary");
    const cells = [...node.querySelectorAll(".order-header-summary > div")].map((cell) => cell.getBoundingClientRect());
    return { title, summary, number: cells[0], date: cells[1] };
  });
  expect(geometry.summary.x).toBeGreaterThan(geometry.title.x + geometry.title.width);
  expect(Math.abs((geometry.summary.y + geometry.summary.height / 2) - (geometry.title.y + geometry.title.height / 2))).toBeLessThan(40);
  expect(geometry.number.x).toBeLessThan(geometry.date.x);
  expect(Math.abs(geometry.number.y - geometry.date.y)).toBeLessThan(2);
});

test("«Общее и Клиент»: client → contact → responsible → deadline mode are saved in the payload", async ({ page }) => {
  const requests: Request[] = [];
  const wizard = await openWizard(page, requests);
  // the current employee is the default responsible person of a new order
  await expect(wizard.getByLabel("Ответственный", { exact: true })).toContainText("Тестовый администратор");
  await expect(wizard.getByLabel("Контактное лицо")).toBeDisabled();

  await wizard.getByLabel("Клиент", { exact: true }).fill("Спектр");
  await page.getByRole("option", { name: /ООО Спектр/ }).click();
  await wizard.getByLabel("Контактное лицо").fill("Иван");
  await page.getByRole("option", { name: /Иван Петров/ }).click();
  await pick(page, wizard, "Ответственный", "Второй менеджер");
  await wizard.getByLabel("Дата окончания").fill("2026-11-06");
  await expect(wizard.getByLabel("Время окончания")).toContainText("В течение дня");
  await pick(page, wizard, "Время окончания", "До …");
  await wizard.getByLabel("До, время").fill("15:00");

  const summary = wizard.locator(".order-header-summary");
  await expect(summary).toContainText("ООО Спектр");
  await expect(summary).toContainText("Иван Петров");
  await expect(summary).toContainText("06.11.26, до 15:00");

  // going through the steps keeps the manual choice
  await wizard.locator(".wizard-steps button").filter({ hasText: "05" }).click();
  await wizard.locator(".wizard-steps button").filter({ hasText: "01" }).click();
  await expect(wizard.getByLabel("Ответственный", { exact: true })).toContainText("Второй менеджер");
  await wizard.locator(".wizard-steps button").filter({ hasText: "05" }).click();
  await wizard.getByRole("button", { name: "Создать заказ" }).click();
  await expect.poll(() => requests.find((r) => r.path.endsWith("/crm/orders/wizard"))?.body).toBeTruthy();
  const payload = JSON.parse(requests.find((r) => r.path.endsWith("/crm/orders/wizard"))!.body);
  expect(payload).toMatchObject({
    client_id: "client-1", contact_id: "contact-1", manager_id: "manager-2", status: "NEW",
    deadline: "2026-11-06", deadline_time_mode: "BY", deadline_time: "15:00", number: null,
  });
});

for (const width of [1440, 1280, 768, 390]) {
  test(`order header and step 1 stay bounded at ${width}px`, async ({ page }) => {
    const wizard = await openWizard(page, [], {}, width);
    await expect(wizard.locator(".order-general-grid")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const outside = await wizard.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      return [...node.querySelectorAll(".order-header-summary > div, .order-general-grid > *")]
        .filter((cell) => { const box = cell.getBoundingClientRect(); return box.left < frame.left - 1 || box.right > frame.right + 1; })
        .map((cell) => `${cell.className}:${cell.textContent?.slice(0, 30)}`);
    });
    expect(outside).toEqual([]);
    await wizard.evaluate((node) => node.scrollIntoView({ block: "start" }));
    if (process.env.CAPTURE_OWNER_QA) await page.screenshot({ path: `../../test-results/paid-v3/step1-${width}.png`, fullPage: false });
  });
}
