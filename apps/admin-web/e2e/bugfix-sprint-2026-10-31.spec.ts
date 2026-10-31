import { expect, test, type Locator, type Page } from "@playwright/test";

// Bug-fix sprint 2026-10-31 (owner report): order form reveal, disabled services on existing
// works, client tariff kept on volume edits, manual character count on the «Расчёт» step.

type Request = { method: string; path: string; body: string };

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const written = {
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
};
// retired by migration 0024, still used by historical works
const scan = { id: "s2", code: "scan", name: "Скан", billing_mode: "PER_PAGE", active: false, sort_order: 2, definition: null };

const baseWork = {
  work_type: "written_translation", service_code: "written_translation", source_language: "Английский", target_language: "Русский", topic: "",
  character_count: 3600, page_count: 2, word_count: null, document_count: null, duration_seconds: null, hour_count: null, billing_unit: "CONDITIONAL_PAGE",
  client_rate: 500, auto_price: 1000, price: 1000, urgent: false, urgency_multiplier: 1, native_speaker: false, discount_percent: 0, discount_overridden: false,
  price_overridden: false, price_override_reason: "", client_billable: true, deadline: "2026-11-10", deadline_time: "", start_date: null, start_time: "",
  certification_mode: "CHARACTERS", tariff_ids: "", status: "NEW", executor_id: null, executor_rate: 0, executor_billing_unit: "CONDITIONAL_PAGE",
  executor_cost: 0, executor_cost_overridden: false, executor_deadline: null, executor_deadline_time: "", executor_assignments: [], notes: "", version: 1,
};
const works = [
  { ...baseWork, id: "work-client", tariff_ids: "client:t1" },
  ...Array.from({ length: 5 }, (_, index) => ({ ...baseWork, id: `work-filler-${index}` })),
  { ...baseWork, id: "work-scan", service_code: "scan", work_type: "scan", source_language: "", target_language: "", character_count: null, page_count: 3, billing_unit: "PER_PAGE", client_rate: 50, auto_price: 150, price: 150, certification_mode: "" },
];
const order = { id: "sprint-order", number: "26-0701", client_name: "Паспортный стол", created_at: "2026-10-30T10:00:00Z", deadline: "2026-11-10", status: "COMPLETED", archived: false, financial: { revenue: 6150, client_debt: 0, payment_state: "PAID" } };
const detail = {
  ...order, contact_name: "", manager_name: user.display_name, client_id: "client-passport", contact_id: null, manager_id: user.id, application_id: null, notes: "", version: 1,
  works, files: [], payment: { amount_due: 6150, amount_paid: 6150, paid_at: null, invoice_number: "", payment_method: "cashless", invoice_date: null, notes: "", version: 1 },
  financial: { revenue: 6150, client_debt: 0, client_paid: 6150, executor_cost: 0, profit: 6150, margin_percent: 100, payment_state: "PAID", executor_breakdown: [] },
};

async function fixtures(page: Page, requests: Request[] = []) {
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
    // the wizard asks for active services only, the order card for all of them
    else if (path.endsWith("/crm/services")) json = url.searchParams.get("active") === "true" ? [written] : [written, scan];
    else if (path.endsWith("/crm/order-statuses")) json = [];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith("/crm/orders/number-preview")) json = { number: "26-0702" };
    else if (path.endsWith("/crm/files/analyze-preview")) json = { page_count: 3, character_count: 5000, word_count: 800, analysis_note: "" };
    else if (path.endsWith("/crm/pricing/options")) json = { options: [], auto_key: "", resolution: "not_found", message: "" };
    else if (path.endsWith(`/crm/orders/${order.id}`)) json = detail;
    else if (path.includes(`/crm/orders/${order.id}/works/`)) json = works[0];
    else if (path.endsWith("/crm/orders")) json = { items: [order], total: 1, total_all: 1, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
}

// the form start must be on screen, below the sticky topbar
async function expectRevealed(page: Page, panel: Locator) {
  await expect.poll(async () => {
    const box = await panel.boundingBox();
    const topbar = await page.locator(".lc-topbar").boundingBox();
    const viewport = page.viewportSize()!;
    return Boolean(box && topbar && box.y >= topbar.y + topbar.height - 1 && box.y < viewport.height - 120);
  }).toBe(true);
  await expect(panel).toBeFocused();
}

const pick = async (page: Page, scope: Locator, label: string, option: string) => {
  await scope.getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

for (const viewport of [{ width: 1280, height: 640 }, { width: 390, height: 760 }]) {
  test(`«Новый заказ» brings the wizard into view (${viewport.width}px)`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize(viewport);
    await page.goto("/admin/orders");
    await expect(page.getByText("26-0701").first()).toBeVisible();
    await page.getByRole("button", { name: /Новый заказ/ }).click();
    const wizard = page.locator(".crm-wizard");
    await expectRevealed(page, wizard);

    // a second click while the wizard is open reveals it again instead of doing nothing
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /Новый заказ/ }).click();
    await expectRevealed(page, wizard);
  });
}

test("«Изменить» on a work far down the card opens its editor in view", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto(`/admin/orders?open=${order.id}`);
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /Работы/ }).click();
  const rows = card.locator(".order-work-card");
  await expect(rows).toHaveCount(works.length);
  await rows.last().getByRole("button", { name: "Изменить", exact: true }).click();
  await expectRevealed(page, card.locator(".work-inline-editor"));
});

test("an existing work keeps its disabled service and stays editable", async ({ page }) => {
  const requests: Request[] = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/orders?open=${order.id}`);
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /Работы/ }).click();
  await card.locator(".order-work-card").last().getByRole("button", { name: "Изменить", exact: true }).click();
  const editor = card.locator(".work-inline-editor");
  await expect(editor.getByLabel("Услуга")).toContainText("Скан (отключена)");
  await editor.getByLabel("Статус работы").click();
  await page.getByRole("option", { name: "Готово", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить работу" }).click();
  await expect.poll(() => requests.find((r) => r.method === "PATCH" && r.path.endsWith("/works/work-scan"))?.body).toBeTruthy();
  const body = JSON.parse(requests.find((r) => r.method === "PATCH" && r.path.endsWith("/works/work-scan"))!.body);
  expect(body).toMatchObject({ service_code: "scan", status: "COMPLETED" });

  // a new work is offered active services only
  await card.getByRole("button", { name: /Добавить работу/ }).click();
  await card.locator(".work-inline-editor").getByLabel("Услуга").click();
  await expect(page.getByRole("option", { name: /Скан/ })).toHaveCount(0);
});

test("a volume edit keeps the client tariff; a typed rate replaces the tariff", async ({ page }) => {
  const requests: Request[] = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/orders?open=${order.id}`);
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /Работы/ }).click();
  await card.locator(".order-work-card").first().getByRole("button", { name: "Изменить", exact: true }).click();
  const editor = card.locator(".work-inline-editor");
  await editor.getByLabel("Количество знаков").fill("5400");
  // the «Работа» rate is not wiped while the client tariff stays selected
  await expect(editor.getByLabel("Тариф клиенту, ₽")).toHaveValue("500");
  await editor.getByRole("button", { name: "Сохранить работу" }).click();
  await expect.poll(() => requests.filter((r) => r.method === "PATCH" && r.path.endsWith("/works/work-client")).length).toBe(1);
  const kept = JSON.parse(requests.filter((r) => r.method === "PATCH" && r.path.endsWith("/works/work-client"))[0].body);
  expect(kept).toMatchObject({ character_count: 5400, tariff_ids: ["client:t1"] });

  await card.locator(".order-work-card").first().getByRole("button", { name: "Изменить", exact: true }).click();
  await card.locator(".work-inline-editor").getByLabel("Тариф клиенту, ₽").fill("650");
  await card.locator(".work-inline-editor").getByRole("button", { name: "Сохранить работу" }).click();
  await expect.poll(() => requests.filter((r) => r.method === "PATCH" && r.path.endsWith("/works/work-client")).length).toBe(2);
  const manual = JSON.parse(requests.filter((r) => r.method === "PATCH" && r.path.endsWith("/works/work-client"))[1].body);
  expect(manual).toMatchObject({ client_rate: 650, tariff_ids: [] });
});

test("manual character count survives document analysis and is editable on «Расчёт»", async ({ page }) => {
  const requests: Request[] = [];
  await fixtures(page, requests);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: /Новый заказ/ }).click();
  const wizard = page.locator(".crm-wizard");
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  await pick(page, work, "Услуга", "Письменный перевод");

  // the analysed value is marked «А»
  await wizard.locator(".wizard-steps button").filter({ hasText: "03" }).click();
  await wizard.locator(".file-drop input[type=file]").setInputFiles({ name: "contract.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(wizard.locator(".analysis-result")).toContainText("5");
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  await expect(work.getByLabel("Количество знаков (А)")).toHaveValue("5000");

  // the manager corrects it («З»); a later document no longer overwrites the correction
  await work.getByLabel("Количество знаков (А)").fill("4100");
  await expect(work.getByLabel("Количество знаков (З)")).toHaveValue("4100");
  await wizard.locator(".wizard-steps button").filter({ hasText: "03" }).click();
  await wizard.locator(".file-drop input[type=file]").setInputFiles({ name: "annex.txt", mimeType: "text/plain", buffer: Buffer.from("y") });
  await expect(wizard.locator(".analysis-result")).toHaveCount(2);

  // «Расчёт» shows the manual value and allows correcting it again; pages follow
  await wizard.locator(".wizard-steps button").filter({ hasText: "04" }).click();
  const row = wizard.locator(".price-row").first();
  await expect(row.getByLabel("Количество знаков (З)")).toHaveValue("4100");
  await row.getByLabel("Количество знаков (З)").fill("9000");
  await expect(row).toContainText("5");
  await row.getByLabel("Количество знаков (З)").blur();
  await expect.poll(() => requests.filter((r) => r.path.endsWith("/crm/pricing/options")).map((r) => JSON.parse(r.body).character_count)).toContain(9000);
  if (process.env.CAPTURE_OWNER_QA) {
    for (const [width, theme] of [[1440, "light"], [390, "light"], [1440, "dark"]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((next) => { document.documentElement.dataset.crmTheme = next; }, theme);
      await row.screenshot({ path: `test-results/sprint-price-row-${width}-${theme}.png` });
    }
  }
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
