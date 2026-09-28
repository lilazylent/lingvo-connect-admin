import { expect, test, type Page } from "@playwright/test";

const user = { id: "owner-qa", display_name: "Тестовый администратор", email: "owner@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true };
const statuses = ["NEW", "ESTIMATING", "APPROVED"].map((code, index) => ({ code, name: `Этап ${index + 1}`, color: "violet", board: "MAIN", active: true, sort_order: index * 10 }));
const order = { id: "order-files", number: "26-0700", client_name: "Тестовый клиент", created_at: "2026-09-13T10:00:00Z", deadline: null, status: "NEW", archived: false, financial: { revenue: 0, client_debt: 0, payment_state: "UNPAID" } };

type StoredFile = { id: string; original_name: string; analysis_status: string; analysis_note: string; page_count: number | null; character_count: number | null; created_at: string };
const txt = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from(`content of ${name}`) });

async function fixtures(page: Page, initial: string[] = []) {
  const files: StoredFile[] = initial.map((name, index) => ({ id: `f-${index}`, original_name: name, analysis_status: "OK", analysis_note: "", page_count: 1, character_count: 100, created_at: "2026-09-13T10:00:00Z" }));
  const uploads: string[] = [];
  let sequence = files.length;
  const detail = () => ({ ...order, client_id: null, contact_id: null, manager_id: null, application_id: null, contact_name: "", manager_name: "", notes: "", version: 1, works: [], files: [...files].reverse(), payment: null, financial: { revenue: 0, client_debt: 0, client_paid: 0, executor_cost: 0, profit: 0, margin_percent: 0, payment_state: "UNPAID", executor_breakdown: [] } });
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = url.pathname;
    const uploadedName = () => /filename="([^"]+)"/.exec(request.postDataBuffer()?.toString("latin1") || "")?.[1] || "file";
    if (path.endsWith("/crm/files/analyze-preview")) {
      return route.fulfill({ status: 200, headers, json: { page_count: 2, character_count: 1800, word_count: 300, analysis_status: "OK", analysis_note: "" } });
    }
    if (path.endsWith(`/crm/orders/${order.id}/files/analyze`) && request.method() === "POST") {
      const name = uploadedName();
      uploads.push(name);
      if (name.startsWith("broken")) return route.fulfill({ status: 422, headers, json: { detail: "Содержимое файла не соответствует PDF" } });
      files.push({ id: `f-${sequence++}`, original_name: name, analysis_status: "OK", analysis_note: "", page_count: 1, character_count: 100, created_at: "2026-09-13T10:00:00Z" });
      return route.fulfill({ status: 201, headers, json: files.at(-1) });
    }
    const deleteMatch = new RegExp(`/orders/${order.id}/files/([^/]+)$`).exec(path);
    if (deleteMatch && request.method() === "DELETE") {
      const index = files.findIndex((item) => item.id === deleteMatch[1]);
      files.splice(index, 1);
      return route.fulfill({ status: 200, headers, json: { id: deleteMatch[1], deleted: true } });
    }
    let json: unknown = { items: [], total: 0, page: 1, pages: 1 };
    if (path.endsWith("/auth/session")) json = { stage: "AUTHENTICATED", user };
    else if (path.endsWith("/users/me/preferences")) json = { interface_theme: "light" };
    else if (path.endsWith("/crm/order-statuses")) json = statuses;
    else if (path.endsWith("/crm/services")) json = [];
    else if (path.endsWith("/applications/managers")) json = [user];
    else if (path.endsWith("/crm/orders/wizard")) json = detail();
    else if (path.endsWith(`/crm/orders/${order.id}`)) json = detail();
    else if (path.endsWith("/crm/orders")) json = { items: [order], total: 1, total_all: 1, page: 1, pages: 1 };
    await route.fulfill({ status: 200, headers, json });
  });
  return { files, uploads };
}

const names = async (page: Page) => page.locator("#order-files .file-metric-row__copy strong").allInnerTexts();

test("order Files tab appends several files, reports a partial failure and deletes one file", async ({ page }) => {
  const state = await fixtures(page, ["A.txt"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.locator(".crm-order-table tbody tr").first().getByRole("button", { name: "26-0700" }).click();
  const card = page.locator(".phase5-order-card");
  await card.getByRole("tab", { name: /^Файлы/ }).click();
  const input = card.getByLabel("Добавить файлы к заказу");
  await expect(input).toHaveAttribute("multiple", "");

  // File B uploaded later: File A is still there.
  await input.setInputFiles([txt("B.txt")]);
  await expect.poll(() => names(page)).toEqual(["B.txt", "A.txt"]);

  // C + D + E in one pick, plus one broken file: the three good ones are attached.
  await input.setInputFiles([txt("C.txt"), txt("D.txt"), { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") }, txt("E.txt")]);
  await expect.poll(async () => (await names(page)).sort()).toEqual(["A.txt", "B.txt", "C.txt", "D.txt", "E.txt"]);
  await expect(card).toContainText("Загружено 3 из 4");
  await expect(card).toContainText("«broken.pdf»: Содержимое файла не соответствует PDF");
  expect(state.uploads).toEqual(["B.txt", "C.txt", "D.txt", "broken.pdf", "E.txt"]);

  // Deleting D removes only D.
  page.once("dialog", (dialog) => void dialog.accept());
  await card.getByRole("button", { name: "Удалить файл D.txt" }).click();
  await expect.poll(async () => (await names(page)).sort()).toEqual(["A.txt", "B.txt", "C.txt", "E.txt"]);
});

test("order wizard keeps every picked document and uploads all of them after creation", async ({ page }) => {
  const state = await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: /Новый заказ/ }).first().click();
  await page.getByRole("button", { name: /03\s*Документы/ }).click();
  const input = page.locator(".document-step input[type=file]");
  await expect(input).toHaveAttribute("multiple", "");

  await input.setInputFiles([txt("passport.txt"), txt("diploma.txt")]);
  await expect(page.locator(".analysis-result--file")).toHaveCount(2);
  // A second pick appends instead of replacing the first documents.
  await input.setInputFiles([txt("contract.txt")]);
  await expect(page.locator(".analysis-result--file")).toHaveCount(3);
  await page.getByRole("button", { name: "Убрать документ diploma.txt" }).click();
  await expect(page.locator(".analysis-result--file")).toHaveCount(2);

  await page.getByRole("button", { name: /06\s*Проверка/ }).click();
  await expect(page.getByText("Файлы (2) будут загружены")).toBeVisible();
  await page.getByRole("button", { name: "Создать заказ" }).click();
  await expect.poll(() => state.uploads).toEqual(["passport.txt", "contract.txt"]);
});
