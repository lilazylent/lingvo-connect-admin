import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "phase10-user",
  display_name: "Admin",
  email: "phase10@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
};

const executor = {
  id: "executor-phase10",
  name: "Дмитрий Переводчик",
  email: "dmitrii@example.invalid",
  phone: "+79990000000",
  telegram: "@dmitrii",
  notes: "",
  archived: false,
  version: 1,
  directions: [{
    executor_id: "executor-phase10",
    source_language: "Японский",
    target_language: "Русский",
    work_type: "written_translation",
    service_name: "Письменный перевод",
    canonical_service: true,
    default_rate: 720,
    rate_unit: "CONDITIONAL_PAGE",
  }],
};

async function fixtures(page: Page) {
  let availability = [{
    id: "availability-1",
    executor_id: executor.id,
    state: "BUSY",
    start_date: "2026-09-20",
    end_date: "2026-09-22",
    notes: "Заказ LC-O-000001",
    archived: false,
    version: 1,
  }];

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

    if (path.endsWith("/auth/session")) return route.fulfill({ status: 200, headers, json: { stage: "AUTHENTICATED", user } });
    if (path.endsWith("/users/me/preferences")) return route.fulfill({ status: 200, headers, json: { interface_theme: "dark" } });
    if (path.endsWith(`/crm/executors/${executor.id}/summary`)) return route.fulfill({ status: 200, headers, json: { executor, assignments: [], works: [], active_works: 0, completed_works: 0, amount_due: 0, amount_paid: 0, owed: 0 } });
    if (path.endsWith(`/executors/${executor.id}/availability`)) {
      if (method === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        availability = [...availability, { id: "availability-2", executor_id: executor.id, archived: false, version: 1, ...body } as typeof availability[number]];
        return route.fulfill({ status: 201, headers, json: availability.at(-1) });
      }
      return route.fulfill({ status: 200, headers, json: { items: availability } });
    }
    if (path.includes(`/executors/${executor.id}/availability/`)) {
      const id = path.split("/").at(-1);
      if (method === "PATCH") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        availability = availability.map((item) => item.id === id ? { ...item, ...body, version: item.version + 1 } as typeof item : item);
        return route.fulfill({ status: 200, headers, json: availability.find((item) => item.id === id) });
      }
      if (method === "DELETE") {
        availability = availability.filter((item) => item.id !== id);
        return route.fulfill({ status: 200, headers, json: { id, archived: true } });
      }
    }
    if (path.endsWith(`/executors/${executor.id}/activity`)) return route.fulfill({ status: 200, headers, json: { items: [], total: 0, page: 1, pages: 1 } });
    if (path.endsWith("/executors")) return route.fulfill({ status: 200, headers, json: { items: [executor], total: 1, page: 1, pages: 1 } });
    if (path.endsWith("/crm/catalog/services")) return route.fulfill({ status: 200, headers, json: { items: [] } });
    if (path.endsWith("/users")) return route.fulfill({ status: 200, headers, json: [user] });
    return route.fulfill({ status: 200, headers, json: { items: [], total: 0, page: 1, pages: 1 } });
  });
}

test.beforeEach(async ({ page }) => { await fixtures(page); });

test("executor availability is a team calendar and unknown is not free", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/translators");
  await page.getByRole("button", { name: "Календарь" }).click();

  await expect(page.getByRole("heading", { name: "Календарь исполнителей" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Дмитрий Переводчик/ })).toBeVisible();
  await expect(page.getByText("Занят", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/пустая ячейка означает, что доступность не указана/i)).toBeVisible();
});

test("executor detail keeps only a compact availability summary", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/translators");
  await page.locator(".directory-table tbody tr").first().click();
  await page.getByRole("tab", { name: "Доступность" }).click();

  await expect(page.getByRole("button", { name: "Открыть календарь исполнителей" })).toBeVisible();
  await expect(page.getByText("Заказ LC-O-000001", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Комментарий")).toHaveCount(0);
});

for (const width of [900, 620, 430, 390, 360, 320]) {
  test(`calendar editor stays inside viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/admin/translators");
    await page.getByRole("button", { name: "Календарь" }).click();
    const cell = page.locator(".executor-calendar__cell").first();
    await cell.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
