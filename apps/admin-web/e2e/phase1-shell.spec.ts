import { test, expect } from "@playwright/test";
import { expectDocumentBounded, gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase1-user",
  display_name: "Lilazylent",
  email: "phase1@example.invalid",
  role: "ADMIN",
  is_active: true,
  two_factor_enabled: true,
};

const dashboard = {
  new_leads: 6,
  active_orders: 1,
  due_today: 0,
  overdue: 0,
  unassigned: 1,
  awaiting_payment: 1,
  revenue: 26631,
  executor_cost: 0,
  profit: 26631,
  recent_orders: [],
};

test.beforeEach(async ({ page }) => {
  let interfaceTheme = "light";
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3011",
      "Access-Control-Allow-Credentials": "true",
    };
    let json: unknown = { items: [], total: 0, page: 1, pages: 1, page_size: 20 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) {
      if (route.request().method() === "PATCH") {
        interfaceTheme = (route.request().postDataJSON() as { interface_theme: string }).interface_theme;
      }
      json = { interface_theme: interfaceTheme };
    } else if (path.endsWith("/crm/dashboard")) json = dashboard;
    else if (path.endsWith("/managers") || path.endsWith("/users")) json = [user];
    await route.fulfill({ status: 200, headers, json });
  });
});

for (const width of [1440, 1180, 1024, 768, 430, 390, 360, 320]) {
  test(`phase 1 shell reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 820 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin");

    const sidebar = page.locator(".lc-sidebar");
    const menu = page.getByRole("button", { name: "Открыть меню" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(sidebar).toBeAttached();
    if (width > 1180) {
      await expect(menu).toBeHidden();
      expect((await sidebar.boundingBox())?.width).toBeCloseTo(236, 0);
    } else {
      await expect(menu).toBeVisible();
      await expect(sidebar).not.toHaveClass(/sidebar--open/);
      const transform = await sidebar.evaluate((node) => getComputedStyle(node).transform);
      expect(transform).not.toBe("none");

      await menu.click();
      await expect(sidebar).toHaveClass(/sidebar--open/);
      await expect(sidebar.getByRole("button", { name: "Закрыть меню" })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(sidebar).not.toHaveClass(/sidebar--open/);
    }

    await expectDocumentBounded(page);
    const fakeNotification = await page.evaluate(() => {
      const el = document.querySelector(".lc-notification-button");
      return el ? getComputedStyle(el, "::after").content : "none";
    });
    expect(fakeNotification).toBe("none");
  });
}

test("shell keeps the same geometry in Dark and has no light shell islands", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWithCrmTheme(page, "/admin", "dark");

  const sidebar = page.locator(".lc-sidebar");
  const topbar = page.locator(".lc-topbar");
  const sidebarBg = await sidebar.evaluate((node) => getComputedStyle(node).backgroundColor);
  const topbarBg = await topbar.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(sidebarBg).not.toBe("rgb(255, 255, 255)");
  expect(topbarBg).not.toBe("rgb(255, 255, 255)");
  expect((await sidebar.boundingBox())?.width).toBeCloseTo(236, 0);
});

test("profile and global search remain functional", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");

  const profile = page.locator(".lc-profile__trigger");
  await profile.click();
  await expect(page.getByText("phase1@example.invalid", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("phase1@example.invalid", { exact: true })).toBeHidden();

  const search = page.getByRole("textbox", { name: "Поиск по CRM" });
  await search.fill("Альфа");
  await expect(page.locator(".lc-search-results")).toBeVisible();
});
