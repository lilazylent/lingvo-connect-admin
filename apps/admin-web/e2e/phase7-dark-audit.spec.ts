import { expect, test, type Page } from "@playwright/test";
import { contrastRatio, gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase7-admin",
  display_name: "Lilazylent",
  email: "phase7@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: "2026-09-15T08:00:00Z",
};

const application = {
  id: "application-phase7",
  number: "LC-A-000701",
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

const company = {
  id: "company-phase7",
  name: "ООО Атлас",
  kind: "company",
  email: "office@atlas.example.invalid",
  phone: "+79990001122",
  manager_id: user.id,
  tax_id: "7812345678",
  notes: "Основной клиент Phase 07",
  archived: false,
  version: 1,
};

const financial = {
  revenue: 26631,
  executor_cost: 9860,
  profit: 16771,
  margin_percent: 62.98,
  client_paid: 10000,
  client_debt: 16631,
};

const work = {
  id: "work-phase7",
  service_code: "written_translation",
  work_type: "written_translation",
  source_language: "Русский",
  target_language: "Английский",
  tariff_ids: "",
  topic: "Юридический",
  urgent: false,
  urgency_multiplier: 1,
  native_speaker: false,
  discount_percent: 0,
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
  executor_id: "executor-phase7",
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
    id: "assignment-phase7",
    executor_id: "executor-phase7",
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

const order = {
  id: "order-phase7",
  number: "LC-O-000701",
  title: "Перевод договора",
  client_id: company.id,
  contact_id: "contact-phase7",
  manager_id: user.id,
  application_id: application.id,
  deadline: "2026-09-22",
  status: "READY",
  notes: "",
  version: 3,
  archived: false,
  created_at: "2026-09-15T08:30:00Z",
  client_name: company.name,
  contact_name: "Мария Иванова",
  manager_name: user.display_name,
  financial,
};

const detail = {
  ...order,
  works: [work],
  payment: {
    id: "payment-phase7",
    amount_due: 26631,
    amount_paid: 10000,
    payment_method: "Безналичный расчёт",
    invoice_number: "LC-701",
    invoice_date: "2026-09-15",
    paid_at: null,
    notes: "",
    version: 1,
  },
  files: [{
    id: "file-phase7",
    original_name: "contract.pdf",
    page_count: 7,
    character_count: 12400,
    word_count: 2100,
    analysis_status: "OK",
    analysis_note: "Распознано автоматически",
    created_at: "2026-09-15T08:40:00Z",
  }],
};

const statuses = [
  ["NEW", "Новый"], ["ESTIMATING", "В расчёте"], ["APPROVED", "Согласован"],
  ["IN_PROGRESS", "В работе"], ["REVIEW", "На проверке"], ["READY", "Готов"],
  ["DELIVERED", "Выдан"], ["COMPLETED", "Завершён"], ["CANCELLED", "Отменён"],
].map(([code, name], index) => ({ code, name, color: "neutral", board: code === "CANCELLED" ? "ARCHIVE" : "MAIN", active: true, sort_order: (index + 1) * 10 }));

const services = [{ id: "service-written", code: "written_translation", name: "Письменный перевод", billing_mode: "CONDITIONAL_PAGE", active: true, sort_order: 10, notes: "" }];
const languages = [{ id: "lang-ru", name: "Русский", active: true, sort_order: 10 }, { id: "lang-en", name: "Английский", active: true, sort_order: 20 }];
const file = {
  id: "file-phase7", source: "order", entity_id: order.id, entity_number: order.number,
  entity_title: order.title, original_name: "contract.pdf", mime_type: "application/pdf",
  size_bytes: 245760, page_count: 7, character_count: 12400, word_count: 2100,
  analysis_status: "OK", analysis_note: "", uploaded_at: "2026-09-15T08:40:00Z", extension: "pdf",
  download_path: `/api/admin/orders/${order.id}/files/file-phase7/download`,
  preview_path: `/api/admin/orders/${order.id}/files/file-phase7/preview`,
  entity_path: `/admin/orders?open=${order.id}`,
};

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

    let json: unknown = { items: [], total: 0, page: 1, pages: 1, page_size: 20 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) {
      if (method === "PATCH") theme = (route.request().postDataJSON() as { interface_theme: string }).interface_theme;
      json = { interface_theme: theme };
    } else if (path.endsWith("/crm/order-statuses")) json = statuses;
    else if (path.endsWith("/crm/services")) json = services;
    else if (path.endsWith("/crm/languages")) json = { items: languages };
    else if (path.endsWith("/crm/tariffs")) json = [];
    else if (path.endsWith("/crm/pricing-rules")) json = [];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith(`/applications/${application.id}`)) json = { ...application, internal_summary: "", comments: [], files: [], activity: [] };
    else if (path.endsWith("/applications")) json = { items: [application], total: 1, page: 1, pages: 1, page_size: 20 };
    else if (path.endsWith(`/crm/clients/${company.id}/summary`)) json = { client: company, orders: [order], order_count: 1, active_orders: 1, revenue: financial.revenue, debt: financial.client_debt, last_order: order };
    else if (path.endsWith(`/companies/${company.id}/representatives`)) json = { items: [{ id: "contact-phase7", company_id: company.id, name: "Мария Иванова", email: application.email, phone: application.phone, archived: false, version: 1 }], total: 1, page: 1, pages: 1 };
    else if (path.endsWith(`/companies/${company.id}/activity`)) json = { items: [], total: 0, page: 1, pages: 1 };
    else if (path.endsWith("/companies")) json = { items: [company], total: 1, page: 1, pages: 1 };
    else if (path.endsWith(`/crm/orders/${order.id}`)) json = detail;
    else if (path.endsWith(`/orders/${order.id}/activity`)) json = { items: [], total: 0, page: 1, pages: 1 };
    else if (path.endsWith("/crm/orders")) json = { items: [order], total: 1, page: 1, pages: 1 };
    else if (path.endsWith("/files")) json = { items: [file], total: 1, total_bytes: file.size_bytes, order_files: 1, application_files: 0, page: 1, pages: 1 };
    else if (path.endsWith("/executors")) json = { items: [{ id: "executor-phase7", name: "Анна Переводчик", email: "anna@example.invalid", phone: "+79990000000", archived: false, directions: [] }], total: 1, page: 1, pages: 1 };
    else if (path.endsWith("/users")) json = [user];
    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => fixtures(page));

test("Phase 07 makes Order Finance compact, semantic and readable in Dark", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWithCrmTheme(page, `/admin/orders?open=${order.id}`, "dark");
  const card = page.locator(".phase5-order-card");
  await expect(card).toBeVisible();
  await card.getByRole("tab", { name: "Финансы" }).click();

  const finance = card.locator("#order-finance");
  await expect(finance).toContainText("Итоговая стоимость заказа");
  await expect(finance).toContainText("Остаток к оплате");
  await expect(finance).toContainText("Выплаты исполнителям");
  await expect(finance).toContainText("Маржинальность");
  await expect(finance).not.toContainText("Итого заказа");

  const strip = finance.locator(".finance-strip");
  const box = await strip.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 9999).toBeLessThanOrEqual(1042);
  const metricHeights = await strip.locator(".finance-metric").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.max(...metricHeights)).toBeLessThanOrEqual(96);

  const surface = await strip.locator(".finance-metric--total").evaluate((node) => {
    const style = getComputedStyle(node);
    const label = node.querySelector("span") as HTMLElement;
    return { bg: style.backgroundColor, fg: getComputedStyle(label).color };
  });
  expect(surface.bg).not.toBe("rgb(255, 255, 255)");
  expect(contrastRatio(surface.fg, surface.bg)).toBeGreaterThanOrEqual(4.5);
});

test("Phase 07 pipeline keeps 01–09 readable and uses a thin motion-ready ring", async ({ page }) => {
  await gotoWithCrmTheme(page, `/admin/orders?open=${order.id}`, "dark");
  const stages = page.locator(".phase5-order-card .order-stage");
  await expect(stages).toHaveCount(9);
  await expect(stages.nth(8).locator(".order-stage__index")).toHaveText("09");

  const current = page.locator('.order-stage[data-stage-state="current"]');
  await expect(current).toHaveCount(1);
  const geometry = await current.locator(".order-stage__glyph").evaluate((node) => {
    const index = node.querySelector(".order-stage__index") as HTMLElement;
    const progress = node.querySelector(".order-stage__dial-progress") as SVGCircleElement;
    return {
      width: node.getBoundingClientRect().width,
      size: parseFloat(getComputedStyle(index).fontSize),
      weight: Number(getComputedStyle(index).fontWeight),
      fg: getComputedStyle(index).color,
      bg: getComputedStyle(node).backgroundColor,
      stroke: parseFloat(getComputedStyle(progress).strokeWidth),
    };
  });
  expect(geometry.width).toBeLessThanOrEqual(32);
  expect(geometry.stroke).toBeLessThanOrEqual(2);
  expect(geometry.size).toBeLessThanOrEqual(13);
  expect(geometry.weight).toBeLessThanOrEqual(700);
  expect(contrastRatio(geometry.fg, geometry.bg)).toBeGreaterThanOrEqual(4.5);

  const future = stages.nth(8).locator(".order-stage__glyph");
  const futureColors = await future.evaluate((node) => {
    const index = node.querySelector(".order-stage__index") as HTMLElement;
    return { fg: getComputedStyle(index).color, bg: getComputedStyle(node).backgroundColor };
  });
  expect(contrastRatio(futureColors.fg, futureColors.bg)).toBeGreaterThanOrEqual(4.5);
});

test("Phase 07 aligns calculation controls and clarifies the Review finance summary", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/orders", "dark");
  await page.getByRole("button", { name: /Новый заказ/ }).click();
  const wizard = page.locator(".crm-wizard");
  await wizard.locator(".wizard-steps button").filter({ hasText: "04" }).click();
  await expect(wizard.getByText("Ставка вручную", { exact: true })).toBeVisible();

  const labels = ["Тариф", "Единица тарифа", "Ставка вручную", "Ручной итог", "Авторасчёт"];
  const y = [] as number[];
  for (const text of labels) {
    const locator = wizard.getByText(text, { exact: true }).first();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    y.push(box?.y ?? 0);
  }
  expect(Math.max(...y) - Math.min(...y)).toBeLessThanOrEqual(8);

  await wizard.locator(".wizard-steps button").filter({ hasText: "06" }).click();
  await expect(wizard.locator(".review-hero")).toContainText("Стоимость для клиента");
  await expect(wizard.locator(".review-hero")).toContainText("Выплаты исполнителям");
  await expect(wizard.locator(".review-hero")).toContainText("Маржинальность");
  await expect(wizard.locator(".review-hero")).not.toContainText(/^Клиенту$/);
});

test("Phase 07 keeps Files and Settings free from accidental light islands in Dark", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/files", "dark");
  await page.getByText("contract.pdf", { exact: true }).click();
  const filePanel = page.locator(".phase6-file-preview");
  const download = filePanel.getByRole("link", { name: /Скачать/ });
  await expect(download).toBeVisible();
  const downloadColors = await download.evaluate((node) => ({ bg: getComputedStyle(node).backgroundColor, fg: getComputedStyle(node).color }));
  expect(downloadColors.bg).not.toBe("rgb(255, 255, 255)");
  expect(contrastRatio(downloadColors.fg, downloadColors.bg)).toBeGreaterThanOrEqual(4.5);

  await gotoWithCrmTheme(page, "/admin/settings", "dark");
  const control = page.locator(".phase6-settings select, .phase6-settings .select-trigger, .phase6-settings input").first();
  await expect(control).toBeVisible();
  const style = await control.evaluate((node) => ({ bg: getComputedStyle(node).backgroundColor, fg: getComputedStyle(node).color }));
  expect(style.bg).not.toBe("rgb(255, 255, 255)");
  expect(contrastRatio(style.fg, style.bg)).toBeGreaterThanOrEqual(4.5);
});

test("Phase 07 hides detail scrollbar chrome without breaking scrollable side panels", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/applications", "dark");
  await page.locator(".applications-table tbody tr").first().click();
  const appPanel = page.locator(".lc-detail-panel").first();
  await expect(appPanel).toBeVisible();
  const appScroll = await appPanel.evaluate((node) => {
    const style = getComputedStyle(node);
    return { scrollbarWidth: style.scrollbarWidth, overflowY: style.overflowY };
  });
  expect(appScroll.scrollbarWidth).toBe("none");
  expect(["hidden", "auto", "scroll"]).toContain(appScroll.overflowY);
  const messageScroll = await page.locator(".lc-detail-message").evaluate((node) => getComputedStyle(node).overflowY);
  expect(["auto", "scroll"]).toContain(messageScroll);

  await gotoWithCrmTheme(page, "/admin/clients", "dark");
  await page.locator(".directory-table tbody tr").first().click();
  const clientPanel = page.locator(".directory-detail-panel");
  await expect(clientPanel).toBeVisible();
  const clientScroll = await clientPanel.evaluate((node) => {
    const style = getComputedStyle(node);
    return { scrollbarWidth: style.scrollbarWidth, overflowY: style.overflowY };
  });
  expect(clientScroll.scrollbarWidth).toBe("none");
  expect(["auto", "scroll"]).toContain(clientScroll.overflowY);
});
