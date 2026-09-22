import { expect, test, type Page } from "@playwright/test";
import { gotoWithCrmTheme } from "./test-helpers";

const user = {
  id: "phase3-user",
  display_name: "Lilazylent",
  email: "phase3@example.invalid",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  two_factor_enabled: true,
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  last_login_at: "2026-09-15T08:00:00Z",
};

const application = {
  id: "phase3-application",
  number: "LC-A-000303",
  name: "Анна Смирнова",
  contact_method: "email",
  contact: "anna@example.invalid",
  email: "anna@example.invalid",
  phone: "+79990001122",
  company: "ООО Атлас",
  requested_service: "written_translation",
  source_language: "Русский",
  target_language: "Английский",
  message: "Проверка передачи тестового документа из публичной формы в админ-панель.",
  desired_date: "2026-09-20",
  status_code: "IN_PROGRESS",
  responsible_manager: user,
  internal_summary: null,
  source: "website",
  source_identifier: null,
  submitted_at: "2026-09-15T08:00:00Z",
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
  version: 1,
};

const applicationDetail = {
  ...application,
  comments: [],
  files: [{
    id: "phase3-file",
    original_name: "contract-source.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: 148240,
    uploader: user,
    uploaded_at: "2026-09-15T08:10:00Z",
  }],
  activity: [],
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
  recent_orders: [{ id: "order-1", number: "LC-O-000001", title: "Перевод договора", deadline: "2026-09-20", status: "IN_PROGRESS" }],
};

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
    } else if (path.endsWith("/crm/dashboard")) json = dashboard;
    else if (path.endsWith("/applications/phase3-application")) json = applicationDetail;
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith("/applications")) json = { items: [application], total: 1, page: 1, pages: 1, page_size: 20 };
    else if (path.endsWith("/users")) json = [user];
    await route.fulfill({ status: 200, headers, json });
  });
}

function contrastRatio(foreground: string, background: string) {
  const rgb = (value: string) => value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const luminance = (value: string) => {
    const [r, g, b] = rgb(value).map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("Dashboard Dark uses semantic action surfaces and readable compact rows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWithCrmTheme(page, "/admin", "dark");

  const secondaryAction = page.locator(".lc-quick-action").filter({ hasText: "Новый заказ" });
  await expect(secondaryAction).toBeVisible();
  const actionBg = await secondaryAction.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(actionBg).not.toBe("rgb(255, 255, 255)");

  const compactStrong = page.locator(".lc-applications-table .lc-compact-table__row strong").first();
  await expect(compactStrong).toBeVisible();
  const colors = await compactStrong.evaluate((node) => {
    const style = getComputedStyle(node);
    const parent = node.closest(".lc-surface") as HTMLElement | null;
    return { foreground: style.color, background: parent ? getComputedStyle(parent).backgroundColor : "rgb(0, 0, 0)" };
  });
  expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
});

test("Applications selected preview exposes real interactive tabs and real files", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/applications");
  const row = page.locator(".applications-table tbody tr").first();
  await expect(row).toBeVisible();
  const detailResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/admin/applications/phase3-application") && response.request().method() === "GET";
  });
  await row.focus();
  await page.keyboard.press("Enter");

  const preview = page.locator(".lc-application-preview");
  await expect(preview).toBeVisible();
  await detailResponse;
  await expect(preview).toHaveAttribute("aria-busy", "false");
  const infoTab = preview.getByRole("tab", { name: "Информация" });
  const contactsTab = preview.getByRole("tab", { name: "Контакты" });
  const filesTab = preview.getByRole("tab", { name: /Файлы/ });
  await expect(infoTab).toHaveAttribute("aria-selected", "true");

  // The counter appears only after the real detail request resolves. Waiting
  // for it makes the tab contract deterministic instead of racing hydration.
  await expect(filesTab).toHaveText(/Файлы\s*·\s*1/);

  await contactsTab.click();
  await expect(contactsTab).toHaveAttribute("aria-selected", "true");
  const contactsGrid = preview.locator(".lc-detail-data--contacts");
  const emailField = contactsGrid.locator(":scope > div").filter({ hasText: "Email" });
  const phoneField = contactsGrid.locator(":scope > div").filter({ hasText: "Телефон" });
  await expect(emailField.getByText("anna@example.invalid", { exact: true })).toBeVisible();
  await expect(phoneField.getByText("+79990001122", { exact: true })).toBeVisible();

  await filesTab.click();
  await expect(filesTab).toHaveAttribute("aria-selected", "true");
  const file = preview.getByText("contract-source.docx", { exact: true });
  await expect(file).toBeVisible();
  const fileLink = file.locator("xpath=ancestor::a");
  await expect(fileLink).toHaveAttribute("href", /\/api\/admin\/applications\/phase3-application\/files\/phase3-file\/download$/);
});

test("Applications preview Dark text keeps readable semantic contrast", async ({ page }) => {
  await gotoWithCrmTheme(page, "/admin/applications", "dark");
  await page.locator(".applications-table tbody tr").first().click();

  const value = page.locator(".lc-detail-data strong").first();
  const label = page.locator(".lc-detail-data span").first();
  for (const locator of [value, label]) {
    const colors = await locator.evaluate((node) => {
      const style = getComputedStyle(node);
      const panel = node.closest(".lc-detail-panel") as HTMLElement;
      return { foreground: style.color, background: getComputedStyle(panel).backgroundColor };
    });
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
});

test("Login form keeps submit action clear of the password control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login?expired=1");
  const password = page.getByLabel("Пароль", { exact: true });
  const submit = page.getByRole("button", { name: "Продолжить →" });
  const passwordBox = await password.boundingBox();
  const submitBox = await submit.boundingBox();
  expect(passwordBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect((submitBox?.y ?? 0) - ((passwordBox?.y ?? 0) + (passwordBox?.height ?? 0))).toBeGreaterThanOrEqual(8);
});

for (const width of [900, 620, 430, 390, 360, 320]) {
  test(`Phase 03 pages keep document width bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/applications");
    await page.locator(".applications-table tbody tr").first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.goto("/admin");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
