import { expect, test, type Page } from "@playwright/test";
import { expectDocumentBounded } from "./test-helpers";

const user = {
  id: "phase9-user",
  display_name: "Lilazylent",
  email: "phase9@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-16T00:00:00Z",
  updated_at: "2026-09-16T00:00:00Z",
  last_login_at: "2026-09-16T00:00:00Z",
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

async function installDashboardFixtures(page: Page) {
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
    else if (path.endsWith("/users/me/preferences")) json = { interface_theme: "dark" };
    else if (path.endsWith("/crm/dashboard")) json = dashboard;
    else if (path.endsWith("/applications")) json = { items: [], total: 0, page: 1, pages: 1, page_size: 20 };
    await route.fulfill({ status: 200, headers, json });
  });
}

test.beforeEach(async ({ page }) => installDashboardFixtures(page));

for (const width of [1440, 1024, 768, 390]) {
  test(`Phase 09 Dashboard KPI navigation sits in a deliberate lower-right zone at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/admin");

    const cards = page.locator(".lc-metric-card");
    await expect(cards).toHaveCount(6);
    await expectDocumentBounded(page);

    for (let index = 0; index < 6; index += 1) {
      const card = cards.nth(index);
      const arrow = card.locator(".lc-circle-arrow");
      const label = card.locator(".lc-metric-card__label");
      const [cardBox, arrowBox, labelBox] = await Promise.all([
        card.boundingBox(),
        arrow.boundingBox(),
        label.boundingBox(),
      ]);
      expect(cardBox).not.toBeNull();
      expect(arrowBox).not.toBeNull();
      expect(labelBox).not.toBeNull();
      if (!cardBox || !arrowBox || !labelBox) continue;

      expect(arrowBox.x).toBeGreaterThan(cardBox.x + cardBox.width * 0.55);
      expect(arrowBox.x + arrowBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width - 8 + 1);
      expect(arrowBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height + 4);
      expect(arrowBox.y + arrowBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 8 + 1);
    }
  });
}

test("Phase 09 build provenance is exposed in the DOM", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveAttribute("data-build-id", "phase15-pre-release-audit-20260922-r4");
});
