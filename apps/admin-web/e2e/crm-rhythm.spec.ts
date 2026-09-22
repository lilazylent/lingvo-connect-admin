import { test, expect } from "@playwright/test";

// Isolated UI fixtures: never authenticate against or change the user's database.
const user = { id: "visual-user", display_name: "Мария Иванова", email: "visual@example.invalid", role: "ADMIN", is_active: true, two_factor_enabled: true };
const order = { id: "visual-order", number: "LC-O-000042", title: "Перевод технической документации", status: "IN_PROGRESS", deadline: "2026-10-02", client_id: null, contact_id: null, manager_id: null, application_id: null, notes: "", version: 1, archived: false, created_at: "2026-09-13T09:00:00Z", client_name: "Международная производственная компания", contact_name: "Анна Смирнова", manager_name: "Мария Иванова", files: [], payment: null, financial: {revenue:12000,executor_cost:7000,profit:5000,margin_percent:41.67,client_paid:0,client_debt:12000}, works: [{id:"visual-work", service_code:"written_translation", source_language:"Русский",target_language:"Английский", character_count:18000, page_count:10, price:12000, executor_cost:7000,executor_id:null,status:"IN_PROGRESS",deadline:"2026-10-02",version:1}] };
const application = { id:"visual-application", number:"LC-A-000042", name:"Анна Смирнова", contact_method:"email", contact:"anna@example.invalid", email:"anna@example.invalid", phone:null, company:"Международная производственная компания", requested_service:"written_translation", source_language:"Русский", target_language:"Английский", message:"Нужно перевести техническое руководство и сохранить структуру документа.", desired_date:"2026-10-02", status_code:"IN_PROGRESS", responsible_manager:user, internal_summary:"Согласовать итоговый формат.", source:"website", source_identifier:null, submitted_at:"2026-09-13T09:00:00Z", created_at:"2026-09-13T09:00:00Z", updated_at:"2026-09-13T09:00:00Z", version:1, comments:[], files:[], activity:[] };
const pageData = (items: unknown[] = []) => ({items,total:items.length,page:1,pages:1,page_size:20});
const fileRegistry = {
  items:[{id:"visual-file",source:"order",entity_id:"visual-order",entity_number:"LC-O-000042",entity_title:"Перевод технической документации",original_name:"technical-manual.pdf",mime_type:"application/pdf",size_bytes:245760,page_count:12,character_count:19800,word_count:3200,analysis_status:"OK",analysis_note:"",uploaded_at:"2026-09-13T09:20:00Z",extension:"pdf",download_path:"/api/admin/orders/visual-order/files/visual-file/download",entity_path:"/admin/orders?open=visual-order"}],
  total:1,total_bytes:245760,order_files:1,application_files:0,page:1,pages:1
};
const statuses = [
  {code:"NEW",name:"Новый",color:"blue",board:"MAIN",active:true,sort_order:10},
  {code:"ESTIMATING",name:"В расчёте",color:"violet",board:"MAIN",active:true,sort_order:20},
  {code:"APPROVED",name:"Согласован",color:"cyan",board:"MAIN",active:true,sort_order:30},
  {code:"IN_PROGRESS",name:"В работе",color:"amber",board:"MAIN",active:true,sort_order:40},
  {code:"REVIEW",name:"На проверке",color:"violet",board:"MAIN",active:true,sort_order:50},
  {code:"READY",name:"Готов",color:"green",board:"MAIN",active:true,sort_order:60},
  {code:"DELIVERED",name:"Выдан",color:"cyan",board:"MAIN",active:true,sort_order:70},
  {code:"COMPLETED",name:"Завершён",color:"green",board:"MAIN",active:true,sort_order:80},
  {code:"CANCELLED",name:"Отменён",color:"rose",board:"ARCHIVE",active:true,sort_order:90},
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
    else if (path.endsWith("/orders/visual-order/activity")) json = pageData([{id:"event-1",action:"ORDER_STATUS_CHANGED",created_at:"2026-09-13T09:30:00Z"}]);
    else if (path.endsWith("/crm/orders/visual-order")) json = order;
    else if (path.endsWith("/crm/orders")) json = pageData([order]);
    else if (path.endsWith("/files")) json = fileRegistry;
    else if (path.endsWith("/applications/visual-application")) json = application;
    else if (path.endsWith("/applications/managers")) json = [user];
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
    await page.goto("/admin/files");
    await expect(page.getByText("technical-manual.pdf",{exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:"Экспорт XLSX"})).toHaveAttribute("href",/\/api\/admin\/files\/export\.xlsx/);
    await expect(page.getByRole("link",{name:/Скачать technical-manual\.pdf/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath('files-registry.png'),fullPage:true});

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
  await page.getByRole("button",{name:/Статусы заказов/}).click();
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
  await expect(firstHeader).toHaveCSS("color","rgb(243, 245, 247)");
  await expect(firstHeader).toHaveCSS("background-color","rgb(24, 29, 36)");

  for (const [route,name] of [["/admin","dashboard"],["/admin/orders?open=visual-order","order"],["/admin/applications/visual-application","application-detail"],["/admin/files","files"],["/admin/users","users"]] as const) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await page.screenshot({path:info.outputPath(`dark-${name}.png`),fullPage:true});
  }

  await page.goto("/admin");
  await expect(page.locator(".page-head__meta")).toHaveCSS("background-color","rgb(19, 23, 28)");
  await expect(page.locator(".metric-strip a").first()).toHaveCSS("background-color","rgb(24, 29, 36)");
  await expect(page.locator(".dashboard-finance strong").first()).toHaveCSS("color","rgb(243, 245, 247)");

  await page.goto("/admin/orders?open=visual-order");
  await expect(page.locator(".order-stage")).toHaveCount(9);
  await expect(page.locator(".order-stage.is-current")).toHaveText(/В работе/);
  await expect(page.locator(".order-stage.is-current")).toHaveCSS("background-color","rgb(162, 60, 96)");
  await expect(page.locator(".order-core-editor")).toHaveCSS("background-color","rgb(15, 18, 22)");
  await expect(page.locator(".order-work-table article > div > strong").first()).toHaveCSS("color","rgb(243, 245, 247)");
  await expect(page.locator(".payment-summary strong").first()).toHaveCSS("color","rgb(243, 245, 247)");
  const timeline = page.locator(".order-history .activity-list");
  const marker = timeline.locator("li > span").first();
  const [timelineBox,markerBox] = await Promise.all([timeline.boundingBox(),marker.boundingBox()]);
  expect(markerBox!.x).toBeGreaterThanOrEqual(timelineBox!.x);
  await expect(marker).toHaveCSS("background-color","rgb(19, 23, 28)");
  await page.getByRole("button",{name:"Новый заказ +"}).click();
  await expect(page.locator(".crm-wizard__head")).toHaveCSS("background-color","rgb(24, 29, 36)");
  await expect(page.locator(".crm-wizard__head h2")).toHaveCSS("color","rgb(243, 245, 247)");
  await expect(page.locator(".wizard-draft-note")).toHaveCSS("background-color","rgb(24, 29, 36)");
  await expect(page.locator(".wizard-draft-note")).toHaveCSS("color","rgb(194, 200, 208)");
  await page.screenshot({path:info.outputPath("dark-order-wizard.png"),fullPage:true});

  await page.goto("/admin/applications/visual-application");
  await expect(page.locator(".detail-sections")).toHaveCSS("background-color","rgb(15, 18, 22)");
  await expect(page.locator(".detail-sections a span").first()).toHaveCSS("color","rgb(194, 200, 208)");
  await page.locator(".operational-group").first().hover();
  await expect(page.locator(".operational-group").first()).toHaveCSS("background-color","rgb(32, 39, 49)");

  for (const [route,name] of [["/admin/applications","applications"],["/admin/clients","clients"],["/admin/translators","translators"]] as const) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await page.screenshot({path:info.outputPath(`dark-${name}.png`),fullPage:true});
  }
});


test("shell stays coherent under browser-zoom equivalent widths and role badge stays flat", async ({page}, info) => {
  await page.emulateMedia({reducedMotion:"reduce"});

  for (const width of [1097, 960, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading",{level:1,name:"Настройки CRM"})).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(width);

    await expect(page.getByRole("button",{name:"Открыть меню"})).toBeVisible();

    const badge = page.locator(".user-menu .badge");
    if (width <= 820) {
      await expect(badge).toBeHidden();
    } else {
      await expect(badge).toBeVisible();
      await expect(badge).toHaveCSS("box-shadow","none");
    }

    await page.screenshot({path:info.outputPath(`zoom-equivalent-${width}.png`),fullPage:true});
  }

  await page.setViewportSize({width:1440,height:900});
  await page.goto("/admin/settings");
  const roleBadge = page.locator(".user-menu .badge");
  await expect(roleBadge).toBeVisible();
  await expect(roleBadge).toHaveCSS("box-shadow","none");

  await page.getByRole("button",{name:/Оформление/}).click();
  await page.getByRole("radio",{name:/Тёмная/}).click();
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
  await expect(roleBadge).toHaveCSS("box-shadow","none");
});

test("dark login keeps both panels readable",async({page},info)=>{
  await page.route("**/api/admin/auth/session",route=>route.fulfill({status:200,json:{stage:"ANONYMOUS",user:null}}));
  await page.addInitScript(()=>localStorage.setItem("lc-crm-theme","dark"));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-crm-theme","dark");
  await expect(page.locator(".auth-brand")).toHaveCSS("background-color","rgb(15, 18, 22)");
  await expect(page.locator(".auth-brand__copy p")).toHaveCSS("color","rgb(243, 245, 247)");
  await page.screenshot({path:info.outputPath("dark-login.png"),fullPage:true});
});
