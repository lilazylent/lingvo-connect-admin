import { expect, test, type Locator, type Page } from "@playwright/test";
import serviceDefinitions from "./fixtures/service-definitions.json";

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

// ---------------------------------------------------------------- S2: work forms by the DOCX v3 tables
// The services come from the real backend metadata (apps/api/app/service_definitions.py).

const TEXT_TAIL = ["Тип переводчика", "Статус", "Тематика", "Комментарий", "Наценка / Срочность", "Скидка, %", "Прикрепить документы клиента", "Не учитывать в расчёте для клиента", "Название документа (-ов)"];
const PRICE = ["Тариф", "Стоимость"];
const WRITTEN = ["Услуга", "Количество знаков", "Количество условных страниц", "Язык оригинала", "Язык перевода", ...PRICE, ...TEXT_TAIL];
const SIMPLE_TAIL = ["Наценка / Срочность", "Скидка, %", ...PRICE, "Не учитывать в расчёте для клиента", "Статус", "Комментарий"];
// 16 logical work types of DOCX v3, in Oleg's order: picker entry → field labels in DOM order
const V3_FORMS: [string, string[]][] = [
  ["Письменный перевод (полный)", WRITTEN],
  ["Письменный перевод (повторения)", WRITTEN],
  ["Письменный перевод (шаблон)", ["Услуга", "Количество документов", "Язык оригинала", "Язык перевода", ...PRICE, ...TEXT_TAIL]],
  ["Вычитка", WRITTEN],
  ["Набор текста", ["Услуга", "Количество знаков", "Количество условных страниц", "Язык оригинала", ...PRICE, ...TEXT_TAIL]],
  ["Нотариальное заверение", ["Услуга", "Количество документов", ...SIMPLE_TAIL]],
  ["Заверение печатью «Лингво Коннект»", ["Услуга", "Количество документов", "Вариант заверения", ...PRICE, "Наценка / Срочность", "Скидка, %", "Статус", "Не учитывать в расчёте для клиента", "Комментарий"]],
  ["Апостиль", ["Услуга", "Количество документов", ...SIMPLE_TAIL]],
  ["Нотариальная копия", ["Услуга", "Количество страниц", ...SIMPLE_TAIL]],
  ["Вёрстка текста", ["Услуга", "Количество страниц", ...SIMPLE_TAIL]],
  ["Вёрстка чертежей", ["Услуга", "Количество страниц", ...SIMPLE_TAIL]],
  ["Распознавание", ["Услуга", "Количество страниц", ...SIMPLE_TAIL]],
  // «Скан» (owner, 2026-10-31): per actual page, enabled by the owner in the settings
  ["Скан", ["Услуга", "Количество страниц (фактических)", ...SIMPLE_TAIL]],
  ["Доставка", ["Услуга", "Дата", "Время", ...SIMPLE_TAIL]],
  ["Аудирование", ["Услуга", "Длительность, секунд", ...SIMPLE_TAIL]],
  ["Транскрибация", ["Услуга", "Количество знаков", "Количество условных страниц", "Язык оригинала", ...PRICE, ...TEXT_TAIL]],
  ["Устный перевод", ["Услуга", "Количество часов", "Тип перевода", ...PRICE, "Язык оригинала", "Язык перевода", "Статус", "Тип переводчика", "Комментарий", "Тематика", "Наценка / Срочность", "Скидка, %", "Прикрепить документы клиента", "Не учитывать в расчёте для клиента", "Название документа (-ов)"]],
];
const services = serviceDefinitions as unknown[];
const topics = { items: [{ name: "юридическая" }, { name: "техническая" }] };
const formLabels = (work: Locator) =>
  work.locator(".work-layout > .work-layout__row").evaluateAll((rows) =>
    rows.flatMap((row) => [...row.querySelectorAll(".field__label, .manual-switch b, .file-drop > span")].map((node) => node.textContent?.trim() ?? "")),
  );

test("every v3 work type shows its own fields in the agreed order", async ({ page }) => {
  const wizard = await openWizard(page, [], { services, extra: (path) => (path.endsWith("/crm/topics") ? topics : undefined) });
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  for (const [choice, labels] of V3_FORMS) {
    await pick(page, work, "Услуга", choice);
    await expect.poll(() => formLabels(work), { message: choice }).toEqual(labels);
  }
  if (process.env.CAPTURE_OWNER_QA) await work.screenshot({ path: "../../test-results/paid-v3/work-interpreting.png" });
});

test("written variants, interpreting type, topic and per-work documents reach the payload", async ({ page }) => {
  const requests: Request[] = [];
  const wizard = await openWizard(page, requests, {
    services,
    extra: (path) =>
      path.endsWith("/crm/topics") ? topics
        : path.endsWith("/crm/files/analyze-preview") ? { page_count: 2, character_count: 3600, word_count: 500, analysis_note: "" }
          : path.endsWith("/crm/orders/wizard") ? { id: "created-order", works: [{ id: "w-1" }, { id: "w-2" }] }
            : undefined,
  });
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const first = wizard.locator(".work-draft").nth(0);
  await pick(page, first, "Услуга", "Письменный перевод (повторения)");
  await pick(page, first, "Тематика", "юридическая");
  await first.getByLabel("Носитель").check();
  await expect(first.getByLabel("Обычный")).not.toBeChecked();
  await first.locator(".work-files input[type=file]").setInputFiles([{ name: "Договор поставки.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") }]);
  await expect(first.getByLabel("Количество знаков")).toHaveValue("3600");
  await expect(first.getByText("Подсчитано по документам, можно исправить")).toBeVisible();
  await expect(first.getByLabel("Название документа (-ов)")).toHaveValue("Договор поставки");
  // a manual name is kept (the А/З of the legend is a hint, not part of the label)
  await first.getByLabel("Название документа (-ов)").fill("Договор №5");
  await expect(first.getByLabel("Название документа (-ов)")).toHaveValue("Договор №5");
  await expect(first.locator(".work-layout__cell--document_names")).toContainText("Введено вручную");


  await wizard.getByRole("button", { name: "Добавить работу +" }).click();
  const second = wizard.locator(".work-draft").nth(1);
  await pick(page, second, "Услуга", "Устный перевод");
  await second.getByLabel("Синхронный").check();
  await second.getByLabel("Количество часов").fill("3");
  await second.locator(".work-files input[type=file]").setInputFiles([{ name: "agenda.txt", mimeType: "text/plain", buffer: Buffer.from("y") }]);

  await wizard.locator(".wizard-steps button").filter({ hasText: "05" }).click();
  await wizard.getByRole("button", { name: "Создать заказ" }).click();
  await expect.poll(() => requests.filter((r) => r.path.endsWith("/files/analyze")).length).toBe(2);
  const payload = JSON.parse(requests.find((r) => r.path.endsWith("/crm/orders/wizard"))!.body);
  expect(payload.works[0]).toMatchObject({
    service_code: "written_translation", certification_mode: "REPETITIONS", topic: "юридическая", native_speaker: true,
    character_count: 3600, character_count_source: "AUTO", measured_character_count: 3600, document_names: "Договор №5", document_names_source: "MANUAL",
  });
  expect(payload.works[1]).toMatchObject({ service_code: "simultaneous_interpreting", hour_count: 3 });
  // each document is uploaded into its own work
  const uploads = requests.filter((r) => r.path.endsWith("/files/analyze")).map((r) => r.body);
  expect(uploads[0]).toContain("w-1");
  expect(uploads[0]).toContain("work_id");
  expect(uploads[1]).toContain("w-2");
});

test("executors step opens «Автоподбор» only on request", async ({ page }) => {
  const requests: Request[] = [];
  const empty = { available: 0, unknown: 0, unavailable: 0, total: 0 };
  const candidates = {
    order_id: null, work: { id: null, service_code: "apostille", service_name: "Апостиль", source_language: "", target_language: "", deadline: null, executor_deadline: null },
    match_type: "DIRECT", matching_mode: "SERVICE_ONLY", matchable: true, missing_fields: [], required_date: null, required_date_source: null,
    candidates: [], counts: empty, direct_viable: false, routed_match: { eligible: false, via_language: null, reason: null, complete: false, stages: [] },
  };
  const wizard = await openWizard(page, requests, { services, extra: (path) => (path.endsWith("/executor-candidates/preview") ? candidates : undefined) });
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  await pick(page, wizard.locator(".work-draft").first(), "Услуга", "Апостиль");
  await wizard.locator(".wizard-steps button").filter({ hasText: "04" }).click();
  await expect(wizard.getByRole("button", { name: "Автоподбор" })).toBeVisible();
  await expect(wizard.locator(".executor-matching")).toHaveCount(0);
  expect(requests.some((r) => r.path.includes("executor-candidates"))).toBe(false);
  await wizard.getByRole("button", { name: "Автоподбор" }).click();
  await expect(wizard.locator(".executor-matching")).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`v3 work grid stays bounded at ${width}px`, async ({ page }) => {
    const wizard = await openWizard(page, [], { services }, width);
    await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
    const work = wizard.locator(".work-draft").first();
    await pick(page, work, "Услуга", "Письменный перевод (полный)");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const outside = await work.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      return [...node.querySelectorAll(".work-layout__cell")].filter((cell) => {
        const box = cell.getBoundingClientRect();
        return box.left < frame.left - 1 || box.right > frame.right + 1;
      }).length;
    });
    expect(outside).toBe(0);
    // the work card itself stays inside the wizard (the wizard clips overflow)
    const [workBox, wizardBox] = await Promise.all([work.boundingBox(), wizard.boundingBox()]);
    expect(workBox!.x + workBox!.width).toBeLessThanOrEqual(wizardBox!.x + wizardBox!.width + 1);
    if (process.env.CAPTURE_OWNER_QA) await work.screenshot({ path: `../../test-results/paid-v3/work-written-${width}.png` });
  });
}

// ---------------------------------------------------------------- S3: payment layouts, tariff choice, volumes
const option = (key: string, extra: Record<string, unknown> = {}) => ({
  key, tariff_ids: [key], resolution: "direct", rate: 500, unit: "PER_DOCUMENT", amount: 1000, quantity: 2, base_amount: 1000,
  surcharge_multiplier: 1, before_discount: 1000, discount_percent: 0, discount_amount: 0, source_language: "", target_language: "",
  directions: [], components: [], is_auto: true, ...extra,
});

test("«Расчёт»: cash and deposit layouts share one payment state", async ({ page }) => {
  const requests: Request[] = [];
  const wizard = await openWizard(page, requests, {
    services,
    extra: (path) =>
      path.endsWith("/companies/client-1/deposit") ? { company_id: "client-1", balance: 300, transactions: [] }
        : path.endsWith("/crm/pricing/options") ? { options: [option("t-apostille")], auto_key: "t-apostille", resolution: "direct", message: "" }
          : undefined,
  });
  await wizard.getByLabel("Клиент", { exact: true }).fill("Спектр");
  await page.getByRole("option", { name: /ООО Спектр/ }).click();
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  await pick(page, work, "Услуга", "Апостиль");
  await work.getByLabel("Количество документов").fill("2");
  await wizard.locator(".wizard-steps button").filter({ hasText: "03" }).click();

  const block = wizard.locator(".payment-block");
  await expect(block.getByLabel("Способ оплаты")).toContainText("Не выбран");
  await expect(block).toContainText("Стоимость заказа, р.");
  await expect(block).toContainText("1 000 ₽");
  await block.getByLabel("Оплачено, р.").fill("200");
  await expect(block.locator(".payment-block__value--remaining")).toContainText("500 ₽");
  // invoice number/date stay available but folded away
  await expect(block.locator(".payment-block__invoice")).not.toHaveAttribute("open", "");

  await pick(page, block, "Способ оплаты", "Депозит");
  await expect(block.getByLabel("Оплачено, р.")).toHaveCount(0);
  await expect(block).toContainText("Депозит, р.");
  await expect(block).toContainText("300 ₽");
  await block.getByLabel("Комментарий").fill("Счёт 757 от 28.01 — 300 р. из депозита");
  await pick(page, block, "Способ оплаты", "Безналичный расчёт");
  // switching the layout keeps the same values
  await expect(block.getByLabel("Оплачено, р.")).toHaveValue("200");
  await pick(page, block, "Способ оплаты", "Депозит");
  if (process.env.CAPTURE_OWNER_QA) await block.screenshot({ path: "../../test-results/paid-v3/payment-deposit.png" });

  await wizard.locator(".wizard-steps button").filter({ hasText: "05" }).click();
  await wizard.getByRole("button", { name: "Создать заказ" }).click();
  await expect.poll(() => requests.find((r) => r.path.endsWith("/crm/orders/wizard"))?.body).toBeTruthy();
  expect(JSON.parse(requests.find((r) => r.path.endsWith("/crm/orders/wizard"))!.body).payment).toMatchObject({
    payment_method: "deposit", amount_paid: 200, notes: "Счёт 757 от 28.01 — 300 р. из депозита", invoice_number: "",
  });
});

const cardWork = {
  id: "work-1", work_type: "written_translation", service_code: "written_translation", source_language: "Английский", target_language: "Русский",
  topic: "", character_count: 3600, character_count_source: "AUTO", measured_character_count: 3600, final_character_count: null, final_volume_at: null,
  page_count: 2, word_count: null, document_count: null, duration_seconds: null, hour_count: null, billing_unit: "CONDITIONAL_PAGE",
  client_rate: 500, auto_price: 1000, price: 1000, urgent: false, urgency_multiplier: 1, native_speaker: false, discount_percent: 0, discount_overridden: false,
  price_overridden: false, price_override_reason: "", client_billable: true, deadline: "2026-11-10", deadline_time: "", start_date: null, start_time: "",
  document_names: "", document_names_source: "", certification_mode: "CHARACTERS", tariff_ids: "t-standard", status: "NEW", executor_id: null,
  executor_rate: 0, executor_billing_unit: "CONDITIONAL_PAGE", executor_cost: 0, executor_cost_overridden: false, executor_deadline: null,
  executor_deadline_time: "", executor_assignments: [], notes: "", version: 3, sort_order: 10,
};
const cardDetail = (files: unknown[] = []) => ({
  id: "card-order", number: "26-0710", title: "26-0710", client_id: "client-1", contact_id: null, manager_id: user.id, application_id: null,
  deadline: "2026-11-10", deadline_manual: true, deadline_time_mode: "BY", deadline_time: "15:00", status: "NEW", notes: "", version: 2,
  archived: false, created_at: "2026-10-31T09:00:00Z", client_name: "ООО Спектр", contact_name: "", manager_name: user.display_name,
  works: [cardWork], files,
  payment: { id: "pay-1", amount_due: 1000, amount_paid: 300, payment_method: "deposit", invoice_number: "757", invoice_date: "2026-10-28", paid_at: null, notes: "", version: 4 },
  deposit_applied: 300,
  financial: { revenue: 1000, executor_cost: 0, profit: 1000, margin_percent: 100, client_paid: 300, client_debt: 700, payment_state: "DEPOSIT", executor_breakdown: [] },
});

test("order card: deposit layout, then cash layout keeps the structured invoice", async ({ page }) => {
  const requests: Request[] = [];
  await fixtures(page, requests, { services, detail: cardDetail() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders?open=card-order");
  const card = page.locator(".phase5-order-card");
  await expect(card.locator(".order-context-strip")).toContainText("10.11.26, до 15:00");
  await card.getByRole("tab", { name: "Расчёт" }).click();
  const payment = card.locator(".order-payment-card");
  await expect(payment).toContainText("Депозит, р.");
  await expect(payment).toContainText("300 ₽");
  await expect(payment.locator(".payment-block__value--remaining")).toContainText("700 ₽");
  await expect(payment).toContainText("Счёт: 757 от 28.10.26");

  await payment.getByRole("button", { name: "Изменить" }).click();
  await pick(page, payment, "Способ оплаты", "Наличные");
  await expect(payment.getByLabel("Оплачено, р.")).toHaveValue("300");
  await payment.getByLabel("Оплачено, р.").fill("1000");
  await expect(payment.locator(".payment-block__value--remaining")).toContainText("0 ₽");
  await expect(payment.locator(".payment-block__invoice")).toHaveAttribute("open", "");
  await payment.getByRole("button", { name: "Сохранить оплату" }).click();
  await expect.poll(() => requests.find((r) => r.method === "PATCH" && r.path.endsWith("/payment"))?.body).toBeTruthy();
  expect(JSON.parse(requests.find((r) => r.method === "PATCH" && r.path.endsWith("/payment"))!.body)).toMatchObject({
    payment_method: "cash", amount_paid: 1000, invoice_number: "757", invoice_date: "2026-10-28", version: 4,
  });
  if (process.env.CAPTURE_OWNER_QA) await payment.screenshot({ path: "../../test-results/paid-v3/payment-card.png" });
});

test("order card: another allowed tariff, final volume and documents of the work", async ({ page }) => {
  const requests: Request[] = [];
  const uploaded = { id: "file-1", work_id: "work-1", original_name: "Договор поставки.pdf", page_count: 3, character_count: 4200, word_count: 600, analysis_status: "DONE", analysis_note: "", created_at: "2026-10-31T10:00:00Z" };
  let files: unknown[] = [];
  await fixtures(page, requests, {
    services,
    extra: (path, _url, request) => {
      if (path.endsWith("/crm/orders/card-order")) return cardDetail(files);
      if (path.endsWith("/crm/orders/card-order/files/analyze")) {
        files = [uploaded];
        return uploaded;
      }
      if (path.endsWith("/crm/pricing/options")) return {
        options: [
          option("client:ct1", { tariff_ids: ["client:ct1"], unit: "CONDITIONAL_PAGE", rate: 450, amount: 900, is_auto: true, client_tariff: { client_name: "ООО Спектр", tier_id: "ct1", quantity_from: 1, tiers: 1 } }),
          option("t-standard", { unit: "CONDITIONAL_PAGE", rate: 500, is_auto: false, source_language: "Английский", target_language: "Русский", resolution: "to_russian" }),
        ],
        auto_key: "client:ct1", resolution: "client_tariff", message: "",
      };
      if (path.includes("/works/work-1") && request.method === "PATCH") return cardWork;
      return undefined;
    },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders?open=card-order");
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /Работы/ }).click();
  await card.locator(".order-work-card").first().getByRole("button", { name: "Изменить", exact: true }).click();
  const editor = card.locator(".work-inline-editor");
  const form = editor.locator(".work-draft");
  await expect(form.getByLabel("Количество знаков")).toHaveValue("3600");

  // 5.1: the saved work can switch to another allowed tariff (client / standard)
  await expect(form.locator(".work-tariff-picker")).toContainText("Стандартный тариф");
  await form.getByRole("button", { name: "Выбрать другой тариф" }).click();
  await form.getByLabel("Тариф", { exact: true }).click();
  await page.getByRole("option", { name: /Тариф клиента «ООО Спектр»/ }).click();
  await expect(form.locator(".work-tariff-picker")).toContainText("Сейчас: Тариф клиента");

  // documents of this work: uploaded with work_id, the measured volume and names land in the form
  await form.locator(".work-files input[type=file]").setInputFiles([{ name: "Договор поставки.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") }]);
  await expect(form.locator(".work-files__list")).toContainText("Договор поставки.pdf");
  await expect(form.getByLabel("Количество знаков")).toHaveValue("4200");
  await expect(form.getByLabel("Название документа (-ов)")).toHaveValue("Договор поставки");

  // 5.2: the final volume by the delivered translation; the preliminary one stays visible
  await expect(form.locator(".work-final-volume")).toContainText("4 200 знаков · по документам");
  await form.getByLabel("Окончательный объём, знаков").fill("5400");
  await expect(form.getByLabel("Количество условных страниц")).toHaveValue("3");

  await editor.getByRole("button", { name: "Сохранить работу" }).click();
  await expect.poll(() => requests.find((r) => r.method === "PATCH" && r.path.endsWith("/works/work-1"))?.body).toBeTruthy();
  expect(JSON.parse(requests.find((r) => r.method === "PATCH" && r.path.endsWith("/works/work-1"))!.body)).toMatchObject({
    tariff_ids: ["client:ct1"], client_rate: 0, character_count: 4200, character_count_source: "AUTO", measured_character_count: 4200,
    final_character_count: 5400, document_names: "Договор поставки", document_names_source: "AUTO", version: 3,
  });
  const upload = requests.find((r) => r.path.endsWith("/files/analyze"))!;
  expect(upload.body).toContain("work-1");
});

test("new v3 surfaces have no light islands in Dark", async ({ page }) => {
  const wizard = await openWizard(page, [], {
    services,
    extra: (path) => (path.endsWith("/users/me/preferences") ? { interface_theme: "dark" } : undefined),
  });
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme", "dark");
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  await pick(page, wizard.locator(".work-draft").first(), "Услуга", "Письменный перевод (полный)");
  const light = async (selector: string) => wizard.locator(selector).evaluateAll((nodes) =>
    nodes.filter((node) => {
      const match = getComputedStyle(node).backgroundColor.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
      return match.length >= 3 && match[0] > 200 && match[1] > 200 && match[2] > 200 && (match[3] ?? 1) !== 0;
    }).length);
  expect(await light(".order-header-summary > div, .choice-pair__option, .work-files__list li, .file-drop--compact")).toBe(0);
  if (process.env.CAPTURE_OWNER_QA) await wizard.screenshot({ path: "../../test-results/paid-v3/dark-work.png" });
  await wizard.locator(".wizard-steps button").filter({ hasText: "03" }).click();
  expect(await light(".payment-block__value")).toBe(0);
});

test("emptying the character count empties the derived pages (owner report 2026-10-31)", async ({ page }) => {
  const wizard = await openWizard(page, [], { services });
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  await pick(page, work, "Услуга", "Письменный перевод (полный)");
  await work.getByLabel("Количество знаков").fill("5400");
  await expect(work.getByLabel("Количество условных страниц")).toHaveValue("3");
  await expect(work.getByText("Введено вручную")).toBeVisible();
  await work.getByLabel("Количество знаков").fill("");
  await expect(work.getByLabel("Количество условных страниц")).toHaveValue("");
});

test("«Работы»: the tariff is picked as soon as the work is filled, changeable there and on «Расчёт»", async ({ page }) => {
  const requests: Request[] = [];
  const pricing = {
    options: [
      { key: "t-en", tariff_ids: ["t-en"], resolution: "to_russian", rate: 500, unit: "CONDITIONAL_PAGE", amount: 1000, quantity: 2, base_amount: 1000, surcharge_multiplier: 1, before_discount: 1000, discount_percent: 0, discount_amount: 0, source_language: "Английский", target_language: "Русский", directions: ["TO_RUSSIAN"], components: [], is_auto: true },
      { key: "client:c1", tariff_ids: ["client:c1"], resolution: "client_tariff", rate: 400, unit: "CONDITIONAL_PAGE", amount: 800, quantity: 2, base_amount: 800, surcharge_multiplier: 1, before_discount: 800, discount_percent: 0, discount_amount: 0, source_language: "Английский", target_language: "Русский", directions: [], components: [], is_auto: false, client_tariff: { client_name: "ООО Спектр", tier_id: "c1", quantity_from: 1, tiers: 1 } },
    ],
    auto_key: "t-en", resolution: "to_russian", message: "",
  };
  const wizard = await openWizard(page, requests, {
    services,
    extra: (path) => path.endsWith("/crm/pricing/options") ? pricing
      : path.endsWith("/crm/languages") ? { items: [{ id: "en", name: "Английский", active: true, sort_order: 1 }, { id: "ru", name: "Русский", active: true, sort_order: 2 }] }
        : undefined,
  });
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  const work = wizard.locator(".work-draft").first();
  await pick(page, work, "Услуга", "Письменный перевод (полный)");
  await work.getByLabel("Количество знаков").fill("3600");
  // quoted automatically once the work is filled: tariff and cost are real values, not placeholders
  // price per unit and for the whole work are visible at once (owner, 2026-11-01)
  await expect(work.locator(".work-layout__cell--tariff")).toContainText("подобран CRM");
  await expect(work.locator(".work-layout__cell--tariff .field__hint")).toContainText("500");
  await expect(work.locator(".work-layout__cell--price .calculated-value--total")).toBeVisible();
  await expect(work.locator(".work-layout__cell--price")).toContainText("1 000 ₽");
  const quotes = () => requests.filter((r) => r.path.endsWith("/crm/pricing/options")).length;
  const settled = quotes();
  await page.waitForTimeout(700);
  expect(quotes()).toBe(settled); // no re-quoting loop

  // change the tariff on «Работы» → the same choice is shown on «Расчёт», and vice versa
  await work.getByLabel("Тариф", { exact: true }).click();
  await page.getByRole("option", { name: /Тариф клиента «ООО Спектр»/ }).click();
  await expect(work.locator(".work-layout__cell--price")).toContainText("800 ₽");
  await wizard.locator(".wizard-steps button").filter({ hasText: "03" }).click();
  const row = wizard.locator(".price-row").first();
  await expect(row.getByLabel("Тариф", { exact: true })).toContainText("Тариф клиента «ООО Спектр»");
  await row.getByLabel("Тариф", { exact: true }).click();
  await page.getByRole("option", { name: /рекомендован/ }).click();
  await wizard.locator(".wizard-steps button").filter({ hasText: "02" }).click();
  await expect(work.locator(".work-layout__cell--price")).toContainText("1 000 ₽");
  if (process.env.CAPTURE_OWNER_QA) await work.screenshot({ path: "../../test-results/paid-v3/works-tariff.png" });
});
