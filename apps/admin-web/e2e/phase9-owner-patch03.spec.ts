import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "phase9-patch03-user",
  display_name: "Lilazylent",
  email: "phase9-patch03@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-16T10:00:00Z",
  updated_at: "2026-09-16T10:00:00Z",
  last_login_at: "2026-09-16T10:00:00Z",
};

const statuses = [
  { code: "NEW", name: "Новый", color: "blue", board: "MAIN", active: true, sort_order: 10 },
  { code: "ESTIMATING", name: "В расчёте", color: "violet", board: "MAIN", active: true, sort_order: 20 },
  { code: "APPROVED", name: "Согласован", color: "cyan", board: "MAIN", active: true, sort_order: 30 },
  { code: "IN_PROGRESS", name: "В работе", color: "amber", board: "MAIN", active: true, sort_order: 40 },
  { code: "COMPLETED", name: "Завершён", color: "green", board: "MAIN", active: true, sort_order: 80 },
  { code: "CANCELLED", name: "Отменён", color: "rose", board: "ARCHIVE", active: true, sort_order: 90 },
  { code: "CUSTOM_DELAYED", name: "Отложен", color: "violet", board: "ARCHIVE", active: true, sort_order: 100 },
];

const financial = {
  revenue: 26631,
  executor_cost: 0,
  profit: 26631,
  margin_percent: 100,
  client_paid: 0,
  client_debt: 26631,
};

function makeOrder(archived: boolean, status: string) {
  return {
    id: "order-patch03",
    number: "LC-O-000001",
    title: "Заказ без названия",
    client_id: null,
    contact_id: null,
    manager_id: user.id,
    application_id: null,
    deadline: null,
    status,
    notes: "",
    version: 1,
    archived,
    created_at: "2026-09-16T10:00:00Z",
    client_name: "Дмитрий",
    contact_name: "",
    manager_name: "Lilazylent",
    financial,
  };
}

function makeDetail(archived: boolean, status: string) {
  return {
    ...makeOrder(archived, status),
    works: [],
    payment: {
      id: "payment-patch03",
      amount_due: 26631,
      amount_paid: 0,
      payment_method: "",
      invoice_number: "",
      invoice_date: null,
      paid_at: null,
      notes: "",
      version: 1,
    },
    files: [
      {
        id: "file-patch03",
        original_name: "Multisim_Lab1_Variant14_RU_UI_Absolute_Beginner.pdf",
        page_count: 17,
        character_count: 14534,
        word_count: 2500,
        analysis_status: "OK",
        analysis_note: "Страницы и текстовый слой PDF определены автоматически.",
        created_at: "2026-09-16T10:05:00Z",
      },
    ],
  };
}

async function installFixtures(page: Page) {
  let archived = false;
  let status = "IN_PROGRESS";
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

    let json: unknown = { items: [], total: 0, page: 1, pages: 1, page_size: 100 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) json = { interface_theme: "dark" };
    else if (path.endsWith("/crm/order-statuses")) json = statuses;
    else if (path.endsWith("/crm/services")) json = [];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith("/crm/orders/order-patch03/archive") && method === "POST") {
      const body = route.request().postDataJSON() as { archived: boolean };
      archived = body.archived;
      status = archived ? "CANCELLED" : "NEW";
      json = makeOrder(archived, status);
    } else if (path.endsWith("/crm/orders/order-patch03/status") && method === "PATCH") {
      const body = route.request().postDataJSON() as { status: string };
      status = body.status;
      archived = statuses.find((item) => item.code === status)?.board === "ARCHIVE";
      json = makeOrder(archived, status);
    } else if (path.endsWith("/crm/orders/order-patch03")) {
      json = makeDetail(archived, status);
    } else if (path.endsWith("/crm/orders")) {
      const wantsArchive = url.searchParams.get("archived") === "true";
      const statusFilter = url.searchParams.get("status") || "";
      const matchesArchive = wantsArchive === archived;
      const matchesStatus = !statusFilter || statusFilter === status;
      const items = matchesArchive && matchesStatus ? [makeOrder(archived, status)] : [];
      json = { items, total: items.length, page: 1, pages: 1, page_size: 100 };
    } else if (path.includes("/orders/order-patch03/activity")) {
      json = { items: [], total: 0, page: 1, pages: 1 };
    }
    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => installFixtures(page));

test("cancelled orders enter the archive Kanban and archive reasons stay separate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/orders?open=order-patch03");

  const card = page.locator(".phase5-order-card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Действия с заказом" }).click();
  await page.getByRole("menuitem", { name: "Добавить в архив" }).click();

  await expect(card.getByText("Архив", { exact: true })).toBeVisible();
  await expect(card.locator(".order-stage-flow")).toContainText("Отменён");
  await expect(card.locator(".order-stage-flow")).toContainText("Отложен");
  await expect(card.locator(".order-stage-flow")).not.toContainText("В работе");

  await page.locator(".archive-toggle input").check();
  await page.getByRole("button", { name: "Kanban" }).click();
  const board = page.locator(".kanban-board");
  await expect(board).toContainText("Отменён");
  await expect(board).toContainText("Отложен");
  await expect(board).not.toContainText("В работе");
  await expect(board.getByText("LC-O-000001", { exact: true })).toBeVisible();
});

test("finance client quote aligns with the primary finance row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/orders?open=order-patch03");
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: "Финансы" }).click();

  const total = card.locator(".finance-metric--total");
  const quote = card.locator(".phase5-client-quote");
  const [totalBox, quoteBox] = await Promise.all([total.boundingBox(), quote.boundingBox()]);
  expect(totalBox).not.toBeNull();
  expect(quoteBox).not.toBeNull();
  if (totalBox && quoteBox) expect(Math.abs(totalBox.y - quoteBox.y)).toBeLessThanOrEqual(2);
});

test("order file actions remain on the same horizontal row as file metadata", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/orders?open=order-patch03");
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /Файлы/ }).click();

  const row = card.locator(".file-metric-row");
  const copy = row.locator(".file-metric-row__copy");
  const actions = row.locator(".file-metric-row__actions");
  const [rowBox, copyBox, actionsBox] = await Promise.all([
    row.boundingBox(),
    copy.boundingBox(),
    actions.boundingBox(),
  ]);
  expect(rowBox).not.toBeNull();
  expect(copyBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  if (rowBox && copyBox && actionsBox) {
    const copyCenter = copyBox.y + copyBox.height / 2;
    const actionsCenter = actionsBox.y + actionsBox.height / 2;
    expect(Math.abs(copyCenter - actionsCenter)).toBeLessThanOrEqual(12);
    expect(actionsBox.y).toBeLessThan(rowBox.y + rowBox.height / 2);
  }
});
