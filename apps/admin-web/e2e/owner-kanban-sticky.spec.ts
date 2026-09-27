import { expect, test, type Page } from "@playwright/test";

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const codes = ["NEW", "ESTIMATING", "APPROVED", "IN_PROGRESS", "REVIEW", "READY", "DELIVERED", "COMPLETED"];
const statuses = codes.map((code, index) => ({ code, name: `Этап ${index + 1}`, color: "violet", board: "MAIN", active: true, sort_order: index * 10 }));
// Enough cards in the first columns to make the board much taller than the viewport.
const orders = Array.from({ length: 45 }, (_, index) => ({ id: `order-${index}`, number: `26-${String(index + 1).padStart(4, "0")}`, client_name: `Клиент ${index + 1}`, created_at: "2026-09-13T10:00:00Z", deadline: "2026-09-20", status: codes[index % 3], archived: false, financial: { revenue: 1000, client_debt: 0, payment_state: "PAID" } }));

async function fixtures(page: Page) {
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let json: unknown = { items: [], total: 0, page: 1, pages: 1 };
    if (url.pathname.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (url.pathname.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
    else if (url.pathname.endsWith("/crm/order-statuses")) json = statuses;
    else if (url.pathname.endsWith("/crm/orders")) json = { items: orders, total: orders.length, total_all: orders.length, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
}

for (const width of [1920, 1440, 1280, 1024, 768, 410]) {
  test(`Kanban stage arrows stay reachable while scrolling at ${width}px`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Kanban" }).click();
    const nav = page.locator(".kanban-navigation");
    const board = page.locator(".kanban-board");
    const left = page.getByRole("button", { name: "Прокрутить этапы влево" });
    const right = page.getByRole("button", { name: "Прокрутить этапы вправо" });
    await expect(left).toBeDisabled();
    await expect(board.locator(".kanban-card")).toHaveCount(orders.length);

    const topbar = await page.evaluate(() => document.querySelector(".lc-topbar")!.getBoundingClientRect().bottom);
    const sectionBottom = async () => page.evaluate(() => document.querySelector(".kanban-workspace")!.getBoundingClientRect().bottom + window.scrollY);

    // Halfway down the board the controls are pinned just below the global top bar.
    await page.evaluate(() => {
      const top = document.querySelector(".kanban-navigation")!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + 700);
    });
    await expect(nav).toHaveClass(/is-stuck/);
    const pinned = await nav.boundingBox();
    expect(pinned!.y).toBeGreaterThanOrEqual(topbar - 1);
    expect(pinned!.y).toBeLessThan(topbar + 24);
    expect(pinned!.height).toBeLessThan(90);

    // Arrows still move the board horizontally from there, up to the last column.
    for (let step = 0; step < 12 && !(await right.isDisabled()); step++) {
      await right.click();
      await page.waitForTimeout(450);
    }
    await expect(right).toBeDisabled();
    await expect(left).toBeEnabled();
    const lastColumn = await board.locator(".kanban-column").last().boundingBox();
    const boardBox = await board.boundingBox();
    expect(lastColumn!.x + lastColumn!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + 1);
    expect(lastColumn!.x).toBeGreaterThanOrEqual(boardBox!.x - 1);
    // The controls did not scroll away horizontally with the columns.
    const afterMove = await nav.boundingBox();
    expect(afterMove!.x).toBeGreaterThanOrEqual(0);
    expect(afterMove!.x + afterMove!.width).toBeLessThanOrEqual(width + 1);

    // Near the end of the board the sticky row is released together with the section.
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
    const released = await nav.boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(released!.y + scrollY + released!.height).toBeLessThanOrEqual((await sectionBottom()) + 1);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
