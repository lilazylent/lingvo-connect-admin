import { test, expect, type Page } from "@playwright/test";

// Browser-only fixtures. These routes never write to a real API or bypass auth in the app.
const user = { id: "qa-manager", display_name: "Тестовый менеджер", email: "manager@example.invalid", role: "ADMIN", is_active: true, must_change_password: false, two_factor_enabled: true, created_at: "2026-09-06T09:00:00Z", updated_at: "2026-09-06T09:00:00Z", last_login_at: null };
async function fixtures(page: Page, multiple = false) {
  let item = { id: "qa-application", number: "LC-A-000042", name: "Анна Смирнова", contact_method: "email", contact: "anna@example.invalid", email: "anna@example.invalid", phone: null, company: "ООО «Атлас»", requested_service: "written_translation", source_language: "Русский", target_language: "Английский", message: "Нужен перевод договора поставки и приложений. Просим уточнить сроки и стоимость.", desired_date: null, status_code: "NEW", responsible_manager: null as typeof user | null, internal_summary: null as string | null, source: "website", source_identifier: "homepage", submitted_at: "2026-09-06T09:00:00Z", created_at: "2026-09-06T09:00:00Z", updated_at: "2026-09-06T09:00:00Z", version: 1, comments: [] as object[], files: [], activity: [] };
  await page.route("**/api/admin/**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const headers = { "Access-Control-Allow-Origin": "http://localhost:3011", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" };
    if (method === "OPTIONS") return route.fulfill({status:204,headers});
    let body: unknown;
    if (url.pathname.endsWith("/auth/session")) body = {stage:"AUTHENTICATED",user};
    else if (url.pathname.endsWith("/managers")) body = [user];
    else if (url.pathname.endsWith("/companies")) body = {items:[],total:0,page:1,pages:1};
    else if (url.pathname.endsWith("/orders")) body = {items:[],total:0,page:1,pages:1};
    else if (url.pathname.endsWith("/client")) body = {client_id:null};
    else if (url.pathname.endsWith("/users")) body = [user, {...user,id:"qa-other",display_name:"Другой сотрудник",role:"MANAGER"}];
    else if (url.pathname.endsWith("/status")) {item = {...item,status_code:route.request().postDataJSON().status_code}; body = item;}
    else if (url.pathname.endsWith("/comments")) {item = {...item, comments:[{id:"comment-1",body:route.request().postDataJSON().body,author:user,created_at:"2026-09-06T10:00:00Z",edited_at:null}]}; body = item.comments[0];}
    else if (url.pathname.endsWith("/applications") && method === "POST") { item = {...item,...route.request().postDataJSON(),source:"manual"}; body=item; }
    else if (url.pathname.endsWith("/applications")) body = {items:multiple ? [item,{...item,id:'qa-second',number:'LC-A-000043'}] : [item],total:multiple?2:1,page:1,pages:1,page_size:20};
    else if (url.pathname.endsWith("/qa-application")) {
      if(method === "PATCH") { const data=route.request().postDataJSON(); item={...item,...data,version:item.version+1,responsible_manager:data.responsible_user_id ? user : null}; }
      body=item;
    } else return route.fulfill({status:404,headers,json:{detail:"Unknown test endpoint"}});
    await route.fulfill({status:200,headers,json:body});
  });
}

test.beforeEach(async ({page}, info) => {await fixtures(page, info.title.includes("hover boundary"));});

test("dropdown: custom hover, selection, Escape, keyboard and disabled roles", async ({page}) => {
  await page.goto("/admin/applications/new");
  const trigger = page.getByRole("combobox", {name:"Способ связи",exact:true});
  await trigger.click();
  const phone=page.getByRole("option",{name:"Телефон",exact:true});
  await phone.hover();
  await expect(phone).toHaveAttribute("data-highlighted", "");
  await expect(phone).toHaveCSS("background-color","rgb(237, 240, 239)");
  await phone.click();
  await expect(trigger).toContainText("Телефон");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press("ArrowDown"); await page.keyboard.press("End"); await page.keyboard.press("Escape");
  await expect(trigger).toContainText("Телефон");
  await trigger.press("ArrowDown"); await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Мессенджер");
  await page.goto("/admin/users");
  await expect(page.getByRole("combobox",{name:`Роль сотрудника ${user.display_name}`})).toBeDisabled();
  await expect(page.locator("select")).toHaveCount(0);
});

test("list has a real keyboard link, filters update URL, reset and entity explanations", async ({page}) => {
  await page.goto("/admin/applications");
  await page.getByText("Фильтры",{exact:false}).filter({hasText:"Статус, менеджер"}).click();
  await page.getByRole("combobox",{name:"Источник",exact:true}).click();
  await page.getByRole("option",{name:"Вручную",exact:true}).click();
  await expect(page).toHaveURL(/source=manual/);
  await page.getByRole("button",{name:/Сбросить фильтры/}).click();
  await expect(page).toHaveURL(/\/admin\/applications$/);
  const link=page.getByRole("link",{name:"Открыть заявку LC-A-000042"});
  await link.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Кто обратился"})).toBeVisible();
  await expect(page.getByText("Это контакт по заявке",{exact:false})).toBeVisible();
});

test("save state and comments preserve unsaved work; status saves immediately", async ({page}) => {
  await page.goto("/admin/applications/qa-application");
  const save=page.getByRole("button",{name:"Сохранить изменения →"});
  await expect(save).toBeDisabled();
  await page.getByLabel("Компания по заявке",{exact:true}).fill("Обновлённая компания");
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await page.getByLabel("Новый комментарий").fill("Проверили исходные документы");
  await page.getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.getByLabel("Компания по заявке",{exact:true})).toHaveValue("Обновлённая компания");
  await save.click();
  await expect(save).toBeDisabled();
  await expect(page.locator(".contact-identity")).toContainText("Обновлённая компания");
  await page.getByRole("combobox",{name:"Статус заявки",exact:true}).click();
  await page.getByRole("option",{name:"В работе",exact:true}).click();
  await expect(page.locator(".detail-head .badge")).toHaveText("В работе");
});

test("manual creation keeps API contract and uses a clear contact label", async ({page}) => {
  await page.goto("/admin/applications/new");
  await page.getByLabel("Имя контакта",{exact:true}).fill("Тестовый заказчик");
  await page.getByLabel("Email",{exact:true}).fill("customer@example.invalid");
  await page.getByLabel("Описание задачи",{exact:true}).fill("Перевод технической документации на английский язык.");
  const request=page.waitForRequest(r=>r.method()==="POST" && r.url().endsWith("/api/admin/applications"));
  await page.getByRole("button",{name:"Создать заявку →"}).click();
  expect((await request).postDataJSON()).toMatchObject({name:"Тестовый заказчик",contact_method:"email",contact:"customer@example.invalid",company:null});
  await expect(page).toHaveURL(/qa-application$/);
});

test("validation errors are text, not a React crash", async ({page}) => {
  await page.route("**/api/admin/applications/qa-application", async route => {
    if(route.request().method()!=="PATCH") return route.fallback();
    await route.fulfill({status:422,headers:{"Access-Control-Allow-Origin":"http://localhost:3011","Access-Control-Allow-Credentials":"true"},json:{detail:[{msg:"invalid"}]}});
  });
  await page.goto("/admin/applications/qa-application");
  await page.getByLabel("Компания по заявке",{exact:true}).fill("Новая компания");
  await page.getByRole("button",{name:"Сохранить изменения →"}).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Проверьте заполнение полей");
  await expect(page.getByLabel("Компания по заявке",{exact:true})).toHaveValue("Новая компания");
});

for (const width of [1920,1440,1024,768,390,375]) {
  test(`visual QA ${width}px: responsive, popup bounds, console`, async ({page},testInfo) => {
    const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.setViewportSize({width,height:width<600?844:1000});
    await page.emulateMedia({reducedMotion:"reduce"});
    for(const [path,label] of [["/admin/applications","list"],["/admin/applications/qa-application","detail"],["/admin/clients","clients"],["/admin/applications/new","new"]]) {
      await page.goto(path); await expect(page.getByRole("heading",{level:1})).toBeVisible();
      const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>el.className).slice(0,15)}));
      expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(width);
      await page.screenshot({path:testInfo.outputPath(`${label}-${width}.png`),fullPage:true});
    }
    const select=page.getByRole("combobox",{name:"Услуга",exact:true});
    await select.click(); await expect(page.getByRole("listbox")).toBeVisible();
    const bounds=await page.locator(".select-popup").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:testInfo.outputPath(`select-${width}.png`)});
    await page.keyboard.press("Escape"); expect(errors).toEqual([]);
  });
}

test("hover boundary: stable row boxes and document width", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/admin/applications");
  const rows=page.locator(".clickable-row");
  await expect(rows).toHaveCount(2);
  const original=await rows.evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  const first=original[0];
  for(const offset of [1,first.height/2,first.height-.5,first.height,first.height+.5,first.height-1]) {
    await page.mouse.move(first.x+40,first.y+offset);
    const frames=await rows.evaluateAll(async elements=>{
      const samples=[];
      for(let i=0;i<20;i++) {await new Promise(requestAnimationFrame);samples.push(elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));}
      return samples;
    });
    for(const frame of frames) expect(frame).toEqual(original);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  }
  for(let i=0;i<20;i++) await page.mouse.move(first.x+60,first.y+first.height+(i%2?2:-2));
  await page.getByRole("link",{name:"Открыть заявку LC-A-000042"}).hover();
  await page.screenshot({path:"test-results/stage2-hover.png"});
});
