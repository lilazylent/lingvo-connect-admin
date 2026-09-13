import { test, expect } from "@playwright/test";

// Isolated UI fixtures: never authenticate against or change the user's database.
const user = { id: "visual-user", display_name: "Мария Иванова", email: "visual@example.invalid", role: "ADMIN", is_active: true, two_factor_enabled: true };
const order = { id: "visual-order", number: "LC-O-000042", title: "Перевод технической документации", status: "IN_PROGRESS", deadline: "2026-10-02", client_id: null, contact_id: null, manager_id: null, application_id: null, notes: "", version: 1, archived: false, created_at: "2026-09-13T09:00:00Z", client_name: "Международная производственная компания", contact_name: "Анна Смирнова", manager_name: "Мария Иванова", files: [], payment: null, financial: {revenue:12000,executor_cost:7000,profit:5000,margin_percent:41.67,client_paid:0,client_debt:12000}, works: [{id:"visual-work", service_code:"written_translation", source_language:"Русский",target_language:"Английский", character_count:18000, page_count:10, price:12000, executor_cost:7000,executor_id:null,status:"IN_PROGRESS",deadline:"2026-10-02",version:1}] };
const pageData = (items: unknown[] = []) => ({items,total:items.length,page:1,pages:1,page_size:20});
const statuses = [
  {code:"NEW",name:"Новый",color:"blue",active:true,sort_order:10},
  {code:"ESTIMATING",name:"В расчёте",color:"violet",active:true,sort_order:20},
  {code:"APPROVED",name:"Согласован",color:"cyan",active:true,sort_order:30},
  {code:"IN_PROGRESS",name:"В работе",color:"amber",active:true,sort_order:40},
  {code:"REVIEW",name:"На проверке",color:"violet",active:true,sort_order:50},
  {code:"READY",name:"Готов",color:"green",active:true,sort_order:60},
  {code:"DELIVERED",name:"Выдан",color:"cyan",active:true,sort_order:70},
  {code:"COMPLETED",name:"Завершён",color:"green",active:true,sort_order:80},
  {code:"CANCELLED",name:"Отменён",color:"rose",active:true,sort_order:90},
];

test.beforeEach(async ({page}) => {
  let interfaceTheme = "light";
  await page.route("**/api/admin/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = {"Access-Control-Allow-Origin":"http://localhost:3011","Access-Control-Allow-Credentials":"true"};
    let json: unknown = pageData();
    if (path.endsWith("/auth/session")) json = {stage:"AUTHENTICATED",user};
    else if (path.endsWith("/users/me/preferences")) {
      if (route.request().method() === "PATCH") {
        interfaceTheme = (route.request().postDataJSON() as {interface_theme:string}).interface_theme;
      }
      json = {interface_theme:interfaceTheme};
    }
    else if (path.endsWith("/managers") || path.endsWith("/users")) json = [user];
    else if (path.endsWith("/crm/dashboard")) json = {new_leads:6,active_orders:1,due_today:0,overdue:0,unassigned:1,awaiting_payment:1,revenue:12000,executor_cost:7000,profit:5000,recent_orders:[order]};
    else if (path.endsWith("/crm/orders/visual-order")) json = order;
    else if (path.endsWith("/crm/orders")) json = pageData([order]);
    else if (path.endsWith("/crm/services")) json = [{id:"service",code:"written_translation",name:"Письменный перевод",billing_mode:"CONDITIONAL_PAGE",active:true,sort_order:1,notes:""}];
    else if (path.endsWith("/crm/order-statuses")) json = statuses;
    else if (path.includes("/crm/order-statuses/")) json = statuses[0];
    else if (path.endsWith("/crm/tariffs") || path.endsWith("/crm/pricing-rules")) json = [];
    await route.fulfill({status:200,headers,json});
  });
});

for (const width of [1440, 1024, 768, 390]) {
  test(`CRM modules and work actions at ${width}px`, async ({page}, info) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:"reduce"});
    for (const route of ["", "/clients", "/translators", "/settings", "/users", "/files", "/imports", "/orders?open=visual-order"]) {
      await page.goto(`/admin${route}`);
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      await expect(page.locator(".state--loading")).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),route).toBeLessThanOrEqual(width);
      await page.screenshot({path:info.outputPath(`${route.split('?')[0].replaceAll('/','')||'dashboard'}.png`),fullPage:true});
    }
    const work = page.locator(".order-work-table article");
    await expect(work.getByRole("button", {name:"Изменить",exact:true})).toBeVisible();
    await expect(work.getByRole("button", {name:"Дублировать",exact:true})).toBeVisible();
    await expect(work.getByText("7 000 ₽",{exact:false})).toBeVisible();
    await work.getByRole("button", {name:"Изменить",exact:true}).click();
    await expect(page.locator(".work-inline-editor")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath('work-editor.png'),fullPage:true});
    expect(errors).toEqual([]);
    const activeAnimations = await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
    expect(activeAnimations).toBe(0);
  });
}

test("orders controls, Kanban colors and persistent themes",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/admin/orders?open=visual-order");
  await expect(page.getByRole("heading",{level:1,name:"Заказы"})).toBeVisible();
  const switcher=page.locator(".view-switch");
  const buttons=page.locator(".view-switch button");
  expect((await switcher.boundingBox())!.width).toBeLessThan(180);
  expect((await switcher.boundingBox())!.width).toBeGreaterThanOrEqual((await buttons.nth(0).boundingBox())!.width+(await buttons.nth(1).boundingBox())!.width);
  await page.getByRole("button",{name:"Kanban"}).click();
  await expect(page.locator(".kanban-column")).toHaveCount(8);
  await expect(page.locator(".kanban-column.status-color--amber")).toBeVisible();
  await page.screenshot({path:info.outputPath("kanban.png"),fullPage:true});

  await page.goto("/admin/settings");
  await expect(page.locator(".settings-modules button")).toHaveCount(6);
  await page.getByRole("button",{name:/Заказы и статусы/}).click();
  await expect(page.locator(".status-directory__row")).toHaveCount(9);
  await page.getByRole("button",{name:"Изменить",exact:true}).first().click();
  await expect(page.getByRole("dialog",{name:"Изменить статус"})).toBeVisible();
  await page.getByRole("button",{name:"Закрыть окно"}).click();
  await page.screenshot({path:info.outputPath("statuses.png"),fullPage:true});
  await page.getByRole("button",{name:/Оформление/}).click();
  await page.getByRole("radio",{name:/Тёмная/}).click();
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
  await page.waitForTimeout(400);
  await page.screenshot({path:info.outputPath("dark-theme.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);

  await page.goto("/admin/orders");
  const firstHeader = page.locator("thead th").first();
  await expect(firstHeader).toHaveCSS("color","rgb(245, 243, 244)");
  await expect(firstHeader).toHaveCSS("background-color","rgb(32, 32, 39)");

  for (const [route,name] of [["/admin/applications","applications"],["/admin/clients","clients"],["/admin/translators","translators"]] as const) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await page.screenshot({path:info.outputPath(`dark-${name}.png`),fullPage:true});
  }
});
