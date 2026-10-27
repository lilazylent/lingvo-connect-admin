import { expect, test, type Page } from "@playwright/test";

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const client = { id: "client-passport", name: "Паспортный стол", email: "", phone: "", notes: "", archived: false, version: 1, kind: "company", stats: { orders_count: 0, revenue: 0, executor_cost: 0, profit: 0 } };
const services = [
  {
    id: "s1", code: "written_translation", name: "Письменный перевод", billing_mode: "CONDITIONAL_PAGE", active: true, sort_order: 1,
    definition: {
      category: "text", fields: ["source_language", "target_language", "certification_mode", "character_count", "page_count", "status", "notes"],
      billing_unit: "CONDITIONAL_PAGE", allowed_billing_units: ["CONDITIONAL_PAGE", "PER_DOCUMENT"], page_from_characters: true, matching_mode: "LANGUAGE_PAIR", supports_routing: true,
      variant_label: "Способ расчёта", default_variant: "CHARACTERS",
      variants: {
        CHARACTERS: { label: "По знакам (условные страницы)", billing_unit: "CONDITIONAL_PAGE", fields: ["character_count", "page_count"] },
        DOCUMENT: { label: "Шаблонные документы (за документ)", billing_unit: "PER_DOCUMENT", fields: ["document_count"] },
      },
    },
  },
  {
    id: "s2", code: "notarial_certification", name: "Заверение нотариальное", billing_mode: "PER_DOCUMENT", active: true, sort_order: 2,
    definition: { category: "certification", fields: ["document_count", "markup", "discount", "status", "notes"], billing_unit: "PER_DOCUMENT", allowed_billing_units: ["PER_DOCUMENT"], page_from_characters: false, matching_mode: "SERVICE_ONLY", supports_routing: false },
  },
];
const tariffItems = [
  { id: "t1", service_code: "notarial_certification", variant: "", source_language: "", target_language: "", quantity_from: 1, amount: 500, notes: "" },
  { id: "t2", service_code: "notarial_certification", variant: "", source_language: "", target_language: "", quantity_from: 5, amount: 450, notes: "" },
];
const clientOption = {
  key: "client:t1", tariff_ids: ["client:t1"], resolution: "client_tariff", rate: 500, unit: "PER_DOCUMENT", amount: 900, quantity: 2, base_amount: 1000,
  surcharge_multiplier: 1, before_discount: 1000, discount_percent: 10, discount_amount: 100, source_language: "", target_language: "", directions: [], components: [],
  discount_name: "Скидка клиента", is_auto: true, client_tariff: { client_name: "Паспортный стол", tier_id: "t1", quantity_from: 1, tiers: 2 },
};

async function fixtures(page: Page, requests: Array<{ method: string; path: string; body: string }>) {
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push({ method: request.method(), path: url.pathname + url.search, body: request.postData() || "" });
    const path = url.pathname;
    let json: unknown = { items: [], total: 0, page: 1, pages: 1 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
    else if (path.endsWith("/crm/services")) json = services;
    else if (path.endsWith("/crm/order-statuses")) json = [];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith("/crm/orders/number-preview")) json = { number: "26-0700" };
    else if (path.endsWith("/crm/pricing/options")) json = { options: [clientOption], auto_key: "client:t1", resolution: "client_tariff", message: "" };
    else if (path.endsWith(`/companies/${client.id}/tariffs`) || path.endsWith(`/companies/${client.id}/pricing`) || path.includes(`/companies/${client.id}/tariffs/`)) json = { company_id: client.id, pricing_mode: "CLIENT", client_discount_percent: 10, items: tariffItems };
    else if (path.endsWith(`/companies/${client.id}/deposit`)) json = { company_id: client.id, balance: 0, transactions: [] };
    else if (path.endsWith(`/crm/clients/${client.id}/summary`)) json = { order_count: 0, active_orders: 0, revenue: 0, debt: 0, deposit_balance: 0, last_order: null, orders: [] };
    else if (path.endsWith(`/companies/${client.id}`)) json = client;
    else if (path.endsWith("/companies")) json = { items: [client], total: 1, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
}

const pick = async (page: Page, scope: ReturnType<Page["locator"]>, label: string, option: string) => {
  await scope.getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("sidebar follows the owner's order", async ({ page }) => {
  await fixtures(page, []);
  await page.goto("/admin/clients");
  // the navigation renders after the session bootstrap: wait for it instead of reading it once
  await expect.poll(async () => (await page.locator(".sidebar nav a, aside nav a").allInnerTexts()).map((item) => item.trim()).filter(Boolean))
    .toEqual(["Обзор", "Заявки", "Заказы", "Статистика", "Клиенты", "Исполнители", "Пользователи", "Файлы", "Настройки"]);
});

test("client card manages its own price list and default pricing mode", async ({ page }) => {
  const requests: Array<{ method: string; path: string; body: string }> = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/clients");
  await page.locator(".directory-table tbody tr").first().click();
  const panel = page.locator(".directory-detail-panel");
  await panel.getByRole("tab", { name: "Тарифы" }).click();
  const tariffs = panel.getByRole("region", { name: "Тарифы клиента" });
  await expect(tariffs).toContainText("Заверение нотариальное");
  await expect(tariffs).toContainText("от 5 док.");
  await expect(tariffs).toContainText("450 ₽/док.");

  await pick(page, tariffs, "Тарифы по умолчанию", "Тарифы этого клиента");
  await tariffs.getByLabel("Скидка клиента, %").fill("10");
  await tariffs.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => requests.find((r) => r.method === "PUT" && r.path.endsWith("/pricing"))?.body).toContain('"pricing_mode":"CLIENT"');

  await tariffs.getByRole("button", { name: "Добавить тариф" }).click();
  const form = tariffs.getByRole("group", { name: "Новый тариф клиента" });
  await pick(page, form, "Услуга", "Письменный перевод");
  await pick(page, form, "Способ расчёта", "Шаблонные документы (за документ)");
  await form.getByLabel("Цена, ₽/док.").fill("100");
  await form.getByRole("button", { name: "Добавить тариф" }).click();
  await expect.poll(() => requests.find((r) => r.method === "POST" && r.path.endsWith("/tariffs"))?.body).toContain('"variant":"DOCUMENT"');
  const body = JSON.parse(requests.find((r) => r.method === "POST" && r.path.endsWith("/tariffs"))!.body);
  expect(body).toMatchObject({ service_code: "written_translation", variant: "DOCUMENT", amount: 100, quantity_from: 1 });
  if (process.env.CAPTURE_OWNER_QA) await tariffs.screenshot({ path: "test-results/owner-client-tariffs.png" });
  // each tariff row keeps its text readable in the narrow panel
  for (const row of await tariffs.locator(".client-tariffs__row").all()) expect((await row.locator("b").boundingBox())!.width).toBeGreaterThan(150);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("wizard prices template documents per document and offers the client tariff", async ({ page }) => {
  const requests: Array<{ method: string; path: string; body: string }> = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: /Новый заказ/ }).click();
  const wizard = page.locator(".crm-wizard");
  await wizard.getByLabel("Найти клиента").fill("Паспорт");
  await page.getByRole("option", { name: /Паспортный стол/ }).first().click();

  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  await pick(page, work, "Услуга", "Письменный перевод");
  await expect(work.getByLabel("Количество знаков")).toBeVisible();
  await pick(page, work, "Способ расчёта", "Шаблонные документы (за документ)");
  await expect(work.getByLabel("Количество знаков")).toHaveCount(0);
  await work.getByLabel("Количество документов").fill("2");

  await wizard.locator(".wizard-steps button").filter({ hasText: "04" }).click();
  await expect.poll(() => requests.find((r) => r.path.endsWith("/crm/pricing/options"))?.body).toContain('"client_id":"client-passport"');
  const quote = JSON.parse(requests.find((r) => r.path.endsWith("/crm/pricing/options"))!.body);
  expect(quote).toMatchObject({ certification_mode: "DOCUMENT", document_count: 2 });
  await expect(wizard.locator(".price-row").first()).toContainText("Тариф клиента «Паспортный стол»");
  await expect(wizard.locator(".tariff-resolution").first()).toContainText("скидка клиента");
  if (process.env.CAPTURE_OWNER_QA) await wizard.locator(".price-row").first().screenshot({ path: "test-results/owner-wizard-client-tariff.png" });
});
