import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "phase5-user",
  display_name: "Lilazylent",
  email: "phase5@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: "2026-09-15T08:00:00Z",
};

const financial = {
  revenue: 26631,
  executor_cost: 9860,
  profit: 16771,
  margin_percent: 62.98,
  client_paid: 10000,
  client_debt: 16631,
};

const application = {
  id: "application-review",
  number: "LC-A-000501",
  source: "website",
  status_code: "IN_PROGRESS",
  name: "Мария Иванова",
  email: "maria@example.invalid",
  phone: "+79990000001",
  contact_method: "email",
  contact: "maria@example.invalid",
  requested_service: "written_translation",
  message: "Нужен перевод договора.",
  company: "ООО Атлас",
  source_language: "Русский",
  target_language: "Английский",
  desired_date: "2026-09-22",
  submitted_at: "2026-09-15T08:30:00Z",
  responsible_manager: user,
  version: 1,
};

const order = {
  id: "order-phase5",
  number: "LC-O-000501",
  title: "Перевод договора и приложения",
  client_id: "company-atlas",
  contact_id: "contact-atlas",
  manager_id: user.id,
  application_id: "application-atlas",
  deadline: "2026-09-22",
  status: "IN_PROGRESS",
  notes: "Согласовать терминологию до финальной вычитки.",
  version: 3,
  archived: false,
  created_at: "2026-09-15T08:30:00Z",
  client_name: "ООО Атлас",
  contact_name: "Мария Иванова",
  manager_name: "Lilazylent",
  financial,
};

const work = {
  id: "work-phase5",
  service_code: "written_translation",
  work_type: "written_translation",
  source_language: "Русский",
  target_language: "Английский",
  tariff_ids: "tariff-1",
  topic: "Юридический",
  urgent: true,
  urgency_multiplier: 1.5,
  native_speaker: false,
  discount_percent: 5,
  discount_overridden: false,
  character_count: 12400,
  page_count: 6.89,
  word_count: 2100,
  billing_unit: "CONDITIONAL_PAGE",
  client_rate: 2550,
  auto_price: 26631,
  price: 26631,
  price_overridden: false,
  price_override_reason: "",
  executor_id: "executor-anna",
  executor_rate: 900,
  executor_billing_unit: "CONDITIONAL_PAGE",
  executor_auto_cost: 9860,
  executor_cost: 9860,
  executor_cost_overridden: false,
  deadline: "2026-09-21",
  deadline_time: "18:00",
  executor_deadline: "2026-09-20",
  executor_deadline_time: "18:00",
  status: "IN_PROGRESS",
  notes: "",
  version: 1,
  sort_order: 10,
  executor_assignments: [{
    id: "assignment-1",
    executor_id: "executor-anna",
    executor_name: "Анна Переводчик",
    character_count: 12400,
    page_count: 6.89,
    billing_unit: "CONDITIONAL_PAGE",
    rate: 900,
    auto_cost: 9860,
    cost: 9860,
    cost_overridden: false,
    deadline: "2026-09-20",
    deadline_time: "18:00",
    status: "IN_PROGRESS",
    notes: "",
  }],
};

const detail = {
  ...order,
  works: [work],
  payment: {
    id: "payment-1",
    amount_due: 26631,
    amount_paid: 10000,
    payment_method: "Безналичный расчёт",
    invoice_number: "LC-501",
    invoice_date: "2026-09-15",
    paid_at: null,
    notes: "",
    version: 1,
  },
  files: [{
    id: "file-1",
    original_name: "contract-source.docx",
    page_count: 7,
    character_count: 12400,
    word_count: 2100,
    analysis_status: "OK",
    analysis_note: "Распознано автоматически",
    created_at: "2026-09-15T08:40:00Z",
  }],
};

const statuses = [
  { code: "NEW", name: "Новый", color: "blue", board: "MAIN", active: true, sort_order: 10 },
  { code: "ESTIMATING", name: "В расчёте", color: "violet", board: "MAIN", active: true, sort_order: 20 },
  { code: "APPROVED", name: "Согласован", color: "cyan", board: "MAIN", active: true, sort_order: 30 },
  { code: "IN_PROGRESS", name: "В работе", color: "amber", board: "MAIN", active: true, sort_order: 40 },
  { code: "REVIEW", name: "На проверке", color: "violet", board: "MAIN", active: true, sort_order: 50 },
  { code: "READY", name: "Готов", color: "green", board: "MAIN", active: true, sort_order: 60 },
  { code: "DELIVERED", name: "Выдан", color: "cyan", board: "MAIN", active: true, sort_order: 70 },
  { code: "COMPLETED", name: "Завершён", color: "green", board: "MAIN", active: true, sort_order: 80 },
  { code: "CANCELLED", name: "Отменён", color: "rose", board: "ARCHIVE", active: true, sort_order: 90 },
];

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
    } else if (path.endsWith("/crm/order-statuses")) json = statuses;
    else if (path.endsWith("/crm/services")) json = [{ id: "service-1", code: "written_translation", name: "Письменный перевод", billing_mode: "volume", active: true }];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith(`/applications/${application.id}`)) json = { ...application, internal_summary: "", comments: [], files: [], activity: [] };
    else if (path.endsWith("/applications")) json = { items: [application], total: 1, page: 1, pages: 1, page_size: 20 };
    else if (path.endsWith(`/crm/orders/${order.id}`)) json = detail;
    else if (path.endsWith(`/orders/${order.id}/activity`)) json = { items: [{ id: "event-1", action: "order.updated", created_at: "2026-09-15T09:00:00Z" }], total: 1, page: 1, pages: 1 };
    else if (path.endsWith(`/orders/${order.id}/works/${work.id}/executor-candidates`)) json = {
      order_id: order.id,
      work: { id: work.id, service_code: "written_translation", service_name: "Письменный перевод", source_language: "Русский", target_language: "Английский", deadline: work.deadline, executor_deadline: work.executor_deadline },
      match_type: "DIRECT",
      matchable: true,
      missing_fields: [],
      required_date: "2026-09-20",
      required_date_source: "executor_deadline",
      counts: { available: 1, unknown: 1, unavailable: 1, total: 3 },
      candidates: [
        { executor_id: "executor-vasily", executor_name: "Василий Переводчик", service_code: "written_translation", service_name: "Письменный перевод", matched_pair: { source_language: "Русский", target_language: "Английский", bidirectional: true }, default_rate: 720, rate_unit: "CONDITIONAL_PAGE", availability: { state: "FREE", start_date: "2026-09-18", end_date: "2026-09-22", notes: "" }, candidate_state: "AVAILABLE", deadline_compatible: true },
        { executor_id: "executor-anna", executor_name: "Анна Переводчик", service_code: "written_translation", service_name: "Письменный перевод", matched_pair: { source_language: "Русский", target_language: "Английский", bidirectional: true }, default_rate: 900, rate_unit: "CONDITIONAL_PAGE", availability: { state: "FREE", start_date: null, end_date: null, notes: "" }, candidate_state: "UNKNOWN", deadline_compatible: null },
        { executor_id: "executor-busy", executor_name: "Занятый Переводчик", service_code: "written_translation", service_name: "Письменный перевод", matched_pair: { source_language: "Русский", target_language: "Английский", bidirectional: true }, default_rate: 650, rate_unit: "CONDITIONAL_PAGE", availability: { state: "BUSY", start_date: "2026-09-19", end_date: "2026-09-21", notes: "Другой заказ" }, candidate_state: "UNAVAILABLE", deadline_compatible: false },
      ],
    };
    else if (path.endsWith("/crm/orders")) json = { items: [order], total: 1, page: 1, pages: 1 };
    else if (path.endsWith("/executors")) json = { items: [
      { id: "executor-anna", name: "Анна Переводчик", email: "anna@example.invalid", phone: "+79990000000", archived: false, directions: [] },
      { id: "executor-vasily", name: "Василий Переводчик", email: "vasily@example.invalid", phone: "+79990000002", archived: false, directions: [] },
      { id: "executor-busy", name: "Занятый Переводчик", email: "busy@example.invalid", phone: "+79990000003", archived: false, directions: [] },
    ], total: 3, page: 1, pages: 1 };
    else if (path.endsWith("/users")) json = [user];

    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("Orders command surface keeps Archive and Table/Kanban as one compact edge group", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");

  const viewbar = page.locator(".phase5-orders-viewbar");
  await expect(viewbar).toBeVisible();
  const archive = viewbar.locator(".archive-toggle");
  const switcher = viewbar.locator(".view-switch");
  await expect(archive).toBeVisible();
  await expect(switcher).toBeVisible();

  const [archiveBox, switchBox] = await Promise.all([archive.boundingBox(), switcher.boundingBox()]);
  expect(archiveBox).not.toBeNull();
  expect(switchBox).not.toBeNull();
  expect((switchBox?.x ?? 0) - ((archiveBox?.x ?? 0) + (archiveBox?.width ?? 0))).toBeLessThanOrEqual(16);
});

test("Order detail is tabbed instead of rendering one giant vertical document", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/orders?open=${order.id}`);

  // ?open= is consumed after hydration and the detail itself is loaded from a
  // real API request. Anchor the test to the mounted card before touching tabs.
  const card = page.locator(".phase5-order-card");
  await expect(card).toBeVisible();

  const overview = card.getByRole("tab", { name: "Основное" });
  const works = card.getByRole("tab", { name: /Работы/ });
  const finance = card.getByRole("tab", { name: "Финансы" });
  const files = card.getByRole("tab", { name: /Файлы/ });
  const history = card.getByRole("tab", { name: "История" });

  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(card.locator("#order-core")).toBeVisible();
  await expect(card.locator("#order-works")).toBeHidden();

  await works.click();
  await expect(works).toHaveAttribute("aria-selected", "true");
  await expect(card.locator("#order-works")).toBeVisible();
  await expect(card.getByText("Русский → Английский", { exact: true })).toBeVisible();
  await expect(card.getByText("Анна Переводчик", { exact: false })).toBeVisible();

  await finance.click();
  await expect(card.locator("#order-finance")).toBeVisible();
  await expect(card.locator("#order-finance")).toContainText(/26[\s\u00a0]*631[\s\u00a0]*₽/);
  await expect(card.locator(".order-payment-card")).toBeVisible();
  const quote = card.locator(".phase5-client-quote");
  await expect(quote).not.toHaveAttribute("open", "");
  await quote.locator("summary").click();
  await expect(quote).toHaveAttribute("open", "");
  await expect(quote.locator("pre")).not.toContainText("Исполнителю");
  await expect(quote.locator("pre")).not.toContainText("Прибыль");

  await files.click();
  await expect(card.locator("#order-files")).toBeVisible();
  await expect(card.getByText("contract-source.docx", { exact: true })).toBeVisible();

  await history.click();
  await expect(card.locator("#order-history")).toBeVisible();
  await expect(card.getByText("Последние события", { exact: true })).toBeVisible();
});

test("Owner readability scale is applied without inflating the page title", async ({ page }) => {
  await page.goto("/admin/orders");
  const labelSize = await page.locator(".phase5-orders-filters .field__label").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const tableSize = await page.locator(".crm-order-table tbody td").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const titleSize = await page.getByRole("heading", { name: "Заказы", exact: true }).evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(labelSize).toBeGreaterThanOrEqual(15);
  expect(tableSize).toBeGreaterThanOrEqual(15);
  expect(titleSize).toBeGreaterThan(tableSize);
});

for (const width of [900, 620, 430, 390, 360, 320]) {
  test(`Phase 05 Orders stays document-bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/admin/orders?open=${order.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}


test("Owner review: sidebar subtitle stays inside the wordmark right edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  const strong = await page.locator(".lc-brand__copy strong").boundingBox();
  const small = await page.locator(".lc-brand__copy small").boundingBox();
  expect(strong).not.toBeNull();
  expect(small).not.toBeNull();
  expect(Math.abs(((strong?.x ?? 0) + (strong?.width ?? 0)) - ((small?.x ?? 0) + (small?.width ?? 0)))).toBeLessThanOrEqual(2);
  expect(small?.width ?? 0).toBeLessThanOrEqual((strong?.width ?? 0) + 1);
});

test("Owner review: Applications row menu closes on outside click and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/applications");
  const menu = page.locator(".applications-table details.row-menu").first();
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.locator(".application-toolbar").click({ position: { x: 8, y: 8 } });
  await expect(menu).not.toHaveAttribute("open", "");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
});

test("Owner review: order work identity and finance summary remain compact", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/orders?open=${order.id}`);
  await page.getByRole("tab", { name: /Работы/ }).click();
  const lead = page.locator(".phase5-order-card .order-work-card__lead").first();
  await expect(lead).toBeVisible();
  expect(await lead.evaluate((node) => getComputedStyle(node).alignItems)).toBe("center");
  expect(await page.locator(".phase5-order-card .order-work-table__index").first().evaluate((node) => parseFloat(getComputedStyle(node).width))).toBeGreaterThanOrEqual(33);

  await page.getByRole("tab", { name: "Финансы" }).click();
  const financeTiles = page.locator(".phase5-order-card .finance-strip > div");
  await expect(financeTiles).toHaveCount(5);
  const heights = await financeTiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThanOrEqual(112);
});


test("Phase 10.3 shows factual direct candidates and keeps manager selection manual", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin/orders?open=${order.id}`);
  const card = page.locator(".phase5-order-card");
  await expect(card).toBeVisible();
  await card.getByRole("tab", { name: /Работы/ }).click();
  await card.getByRole("button", { name: "Изменить" }).first().click();

  const matchingButton = card.getByRole("button", { name: "Подобрать исполнителя" });
  await expect(matchingButton).toBeVisible();
  await matchingButton.click();

  const matching = card.locator(".executor-matching");
  await expect(matching.getByText("Василий Переводчик", { exact: true })).toBeVisible();
  await expect(matching.getByText("Доступность не указана", { exact: true })).toBeVisible();
  await expect(matching.getByRole("button", { name: "Недоступен на срок" })).toBeDisabled();
  await expect(matching.getByText("Уже выбран", { exact: true })).toBeVisible();

  const vasily = matching.locator(".executor-candidate-card").filter({ hasText: "Василий Переводчик" });
  await vasily.getByRole("button", { name: "Выбрать" }).click();
  await expect(vasily.getByRole("button", { name: "Уже выбран" })).toBeDisabled();

  const assignmentCards = card.locator(".executor-assignment-card");
  await expect(assignmentCards).toHaveCount(2);
  await expect(assignmentCards.nth(1).getByLabel("Ставка исполнителя, ₽")).toHaveValue("720");
  await expect(card.getByRole("button", { name: "Сохранить работу" })).toBeVisible();
});
