import { expect, test, type Page } from "@playwright/test";
import { formatCrmDate, formatCrmDateTime } from "../src/lib/format-date";

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const statuses = Array.from({ length: 7 }, (_, index) => ({ code: ["NEW", "ESTIMATING", "APPROVED", "IN_PROGRESS", "REVIEW", "READY", "DELIVERED"][index], name: index === 1 ? "В расчёте" : `Этап ${index + 1}`, color: "violet", board: "MAIN", active: true, sort_order: index * 10 }));
const order = { id: "owner-order", number: "26-0665", client_name: "Тестовый клиент", created_at: "2026-09-13T10:00:00Z", deadline: "2026-09-20", status: "ESTIMATING", archived: false, financial: { revenue: 1000, client_debt: 500, payment_state: "PARTIAL" } };
const assignment = { id: "assignment-owner", executor_id: "executor-owner", executor_name: "Мария Переводчик", character_count: 14400, page_count: 8, document_count: null, duration_seconds: null, hour_count: null, billing_unit: "CONDITIONAL_PAGE", rate: 230, cost: 1840, auto_cost: 1840, cost_overridden: false, status: "IN_PROGRESS", route_stage_index: null, route_source_language: "Русский", route_target_language: "Английский" };
const work = { id: "work-owner", service_code: "written_translation", work_type: "written_translation", source_language: "Русский", target_language: "Английский", character_count: 16115, page_count: 9, document_count: null, duration_seconds: null, hour_count: null, billing_unit: "CONDITIONAL_PAGE", client_rate: 500, price: 4500, urgent: false, urgency_multiplier: 1, discount_percent: 0, price_overridden: false, client_billable: true, deadline: "2026-09-20", deadline_time: "", start_date: null, start_time: "", status: "IN_PROGRESS", executor_id: "executor-owner", executor_rate: 230, executor_billing_unit: "CONDITIONAL_PAGE", executor_cost: 1840, executor_assignments: [assignment], version: 1 };
const detail = { ...order, client_name: "Тестовый клиент", contact_name: "", manager_name: "Тестовый администратор", client_id: null, contact_id: null, manager_id: user.id, application_id: null, notes: "", version: 1, works: [work], files: [], payment: { amount_due: 4500, amount_paid: 500, paid_at: null, invoice_number: "", payment_method: "cashless", invoice_date: null, notes: "", version: 1 }, financial: { revenue: 4500, client_debt: 4000, client_paid: 500, executor_cost: 1840, profit: 2660, margin_percent: 59, payment_state: "PARTIAL", executor_breakdown: [{ work_id: work.id, service_code: work.service_code, source_language: work.source_language, target_language: work.target_language, client_price: 4500, client_billable: true, executor_cost: 1840, legacy_cost: false, assignments: [{ ...assignment, assignment_id: assignment.id, amount_paid: 0 }] }] } };

async function fixtures(page: Page) {
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let json: unknown = { items: [], total: 0, page: 1, pages: 1 };
    if (url.pathname.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (url.pathname.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
    else if (url.pathname.endsWith("/crm/dashboard")) json = { total_orders: 669, new_leads: 0, active_orders: 1, due_today: 0, overdue: 1, unassigned: 0, awaiting_payment: 1, revenue: 1000, executor_cost: 0, profit: 1000, recent_orders: [] };
    else if (url.pathname.endsWith("/crm/order-statuses")) json = statuses;
    else if (url.pathname.endsWith("/crm/services")) json = [{ code: "written_translation", name: "Письменный перевод", billing_mode: "CONDITIONAL_PAGE" }];
    else if (url.pathname.endsWith("/applications/managers")) json = [user];
    else if (url.pathname.endsWith("/crm/orders/owner-order")) json = detail;
    else if (url.pathname.endsWith("/crm/orders")) json = { items: [order], total: 1, total_all: 669, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
}

test("dashboard shortcut applies the overdue order filter", async ({ page }) => {
  await fixtures(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: /Просрочено/ }).click();
  await expect(page).toHaveURL(/\/admin\/orders\?overdue=true/);
  await expect(page.getByText("26-0665").first()).toBeVisible();
});

test("order list localizes status, payment and dates without displaying debt", async ({ page }) => {
  await fixtures(page);
  await page.goto("/admin/orders");
  const row = page.locator(".crm-order-table tbody tr").first();
  await expect(row).toContainText("Рассчитан");
  await expect(row).toContainText("Частично оплачено");
  await expect(row).toContainText("20.09.26");
  await expect(row).not.toContainText("20.09.2026");
  await expect(row).not.toContainText("500 ₽");
  await expect(page.getByText("Всего заказов").first().locator("..")).toContainText("669");
});

test("all Kanban columns are reachable from top controls at narrow widths", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: "Kanban" }).click();
  const board = page.locator(".kanban-board");
  await expect(board.locator(".kanban-column")).toHaveCount(7);
  await page.getByRole("button", { name: "Прокрутить этапы вправо" }).click();
  await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("CRM date helpers use the owner format DD.MM.YY", () => {
  expect(formatCrmDate("2026-09-20")).toBe("20.09.26");
  expect(formatCrmDate("2025-12-25")).toBe("25.12.25");
  expect(formatCrmDateTime("2026-09-20T09:05:00")).toBe("20.09.26, 09:05");
  expect(formatCrmDate(null, "Не указан")).toBe("Не указан");
});

test("work, executor and finance views keep client and executor quantities separate", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.locator(".crm-order-table tbody tr").first().getByRole("button", { name: "26-0665" }).click();
  const card = page.locator(".phase5-order-card");
  await expect(card).toBeInViewport();
  await card.getByRole("tab", { name: "Работы 1" }).click();
  await expect(card.locator(".order-work-card__segment").first()).toContainText("9 усл. стр.");
  await expect(card.locator(".order-work-card__segment").last()).toContainText("8 усл. стр.");
  if (process.env.CAPTURE_OWNER_QA) await page.screenshot({ path: "test-results/owner-work-card.png", fullPage: true });
  await card.getByRole("tab", { name: "Исполнители 1" }).click();
  await expect(card.locator("#order-executors")).toContainText("Мария Переводчик");
  await card.getByRole("tab", { name: "Финансы" }).click();
  await expect(card.locator(".executor-finance-stage")).toContainText("230 ₽/усл.стр.");
  await expect(card.locator(".executor-finance-stage")).not.toContainText("1800 знаков");
});

test("copied client estimate uses compact client units and no executor finance", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.locator(".crm-order-table tbody tr").first().getByRole("button", { name: "26-0665" }).click();
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: "Финансы" }).click();
  await card.getByText("Показать", { exact: true }).click();
  const estimate = card.locator("pre");
  await expect(estimate).toContainText("Объём: 9 усл. стр.");
  await expect(estimate).toContainText("Ставка: 500 ₽/усл.стр.");
  const text = await estimate.innerText();
  for (const forbidden of ["знаков", "16 115", "230", "1 840", "2 660", "Мария", "исполнител", "Прибыль", "маржа"]) {
    expect(text, `client estimate must not contain ${forbidden}`).not.toContain(forbidden);
  }
});

test("dashboard, orders and Kanban avoid page overflow across target widths and themes", async ({ page }) => {
  test.setTimeout(60_000);
  await fixtures(page);
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("lc-crm-theme", value), theme);
    for (const width of [1920, 1440, 1280, 1024, 768, 410]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      await expect(page.getByText("Просрочено", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${theme} dashboard ${width}`).toBe(true);
      await page.goto("/admin/orders");
      await page.getByRole("button", { name: "Kanban" }).click();
      await expect(page.locator(".kanban-board")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${theme} Kanban ${width}`).toBe(true);
    }
  }
});
