import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

// Dedicated disposable PostgreSQL + API on 8012; no mocked requests or bypassed auth.
test.skip(!process.env.STAGE2_LIVE, "Run with the isolated stage2 QA database and API");
function totp(secret: string) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits=[...secret].map(c=>alphabet.indexOf(c).toString(2).padStart(5,"0")).join("");
  const key=Buffer.from(bits.match(/.{8}/g)!.map(b=>parseInt(b,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",key).update(counter).digest();
  return String((digest.readUInt32BE(digest[19]&15)&0x7fffffff)%1000000).padStart(6,"0");
}

test("real login, client/contact, executors, request/order, two works and reload",async({page})=>{
  test.setTimeout(120000);
  const name=`QA ${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Рабочий email").fill("stage2-qa@example.com");
  await page.getByLabel("Пароль",{exact:true}).fill("QaOnly-StageTwo-123!");
  await page.getByRole("button",{name:"Продолжить →",exact:true}).click();
  await page.getByLabel("Новый пароль",{exact:true}).fill("QaOnly-StageTwo-Permanent!");
  await page.getByLabel("Повторите пароль").fill("QaOnly-StageTwo-Permanent!");
  await page.getByRole("button",{name:"Сохранить и продолжить →"}).click();
  const secret=await page.locator(".manual-key").textContent();
  await page.getByLabel("Код из приложения").fill(totp(secret!.trim()));
  await page.getByRole("button",{name:"Подтвердить 2FA →"}).click();
  await page.getByRole("button",{name:"Я сохранил коды →"}).click();
  await page.waitForURL(/\/admin$/);
  await page.goto("/admin/clients");
  await page.getByRole("button",{name:"Добавить клиента +"}).click();
  await page.getByLabel("Имя / название *",{exact:true}).fill(name);
  await page.getByLabel("Email",{exact:true}).fill("qa@example.com");
  await page.getByRole("button",{name:"Сохранить",exact:true}).click();
  await page.getByRole("button",{name,exact:true}).click();
  await page.getByRole("button",{name:"Добавить контакт",exact:true}).click();
  await page.getByLabel("Имя контактного лица *").fill("Анна QA");
  await page.getByRole("button",{name:"Сохранить контакт"}).click();
  await expect(page.getByText("Анна QA",{exact:true})).toBeVisible();
  for(const suffix of ["А","Б"]){
    await page.goto("/admin/translators");
    await page.getByRole("button",{name:"Добавить исполнителя +"}).click();
    await page.getByLabel("Имя / название *",{exact:true}).fill(`${name} ${suffix}`);
    await page.getByRole("button",{name:"Добавить направление"}).click();
    await page.getByLabel("Исходный язык 1",{exact:true}).fill("Русский");
    await page.getByLabel("Язык перевода 1",{exact:true}).fill("Английский");
    await page.getByRole("button",{name:"Сохранить",exact:true}).click();
    await expect(page.getByRole("button",{name:`${name} ${suffix}`,exact:true})).toBeVisible();
  }
  // Real manual request API, sharing the browser's authenticated cookies and CSRF.
  const cookies=await page.context().cookies();
  const csrf=cookies.find(c=>c.name==="lc_csrf")!.value;
  const response=await page.request.post("http://localhost:8012/api/admin/applications",{headers:{"x-csrf-token":csrf},data:{name,contact_method:"email",contact:"qa@example.com",requested_service:"written_translation",message:"Реальная проверка второго этапа",source_language:"Русский",target_language:"Английский"}});
  expect(response.status()).toBe(201);
  const lead=await response.json();
  await page.goto(`/admin/applications/${lead.id}`);
  await page.getByRole("link",{name:"Создать заказ →"}).click();
  await expect(page.getByLabel("Название заказа *")).not.toHaveValue("");
  await page.getByRole("combobox",{name:"Ответственный менеджер *",exact:true}).click();
  await page.getByRole("option",{name:"Проверка этапа 2"}).click();
  await page.getByLabel("Поиск: клиент *",{exact:true}).fill(name);
  await page.getByRole("combobox",{name:"Клиент *",exact:true}).click();
  await page.getByRole("option",{name,exact:true}).click();
  await page.getByRole("button",{name:"Создать заказ",exact:true}).click();
  await expect(page.getByText("Карточка заказа",{exact:true})).toBeVisible();
  for(const suffix of ["А","Б"]){
    await page.getByRole("button",{name:"Добавить работу +"}).click();
    await page.getByLabel("Поиск: исполнитель",{exact:true}).fill(`${name} ${suffix}`);
    await page.getByRole("combobox",{name:"Исполнитель",exact:true}).click();
    await page.getByRole("option",{name:`${name} ${suffix}`,exact:true}).click();
    await page.getByLabel("Стоимость для клиента, ₽").fill("1250.50");
    await page.getByRole("combobox",{name:"Статус работы",exact:true}).click();
    await page.getByRole("option",{name:"В работе",exact:true}).click();
    await page.getByRole("button",{name:"Сохранить работу",exact:true}).click();
  }
  await expect(page.locator(".crm-work")).toHaveCount(2);
  for(const width of [1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/stage2-order-${width}.png`,fullPage:true});
  }
  await page.reload();
  const record=page.locator(".crm-record-link").first();
  await record.click();
  await expect(page.locator(".crm-work")).toHaveCount(2);
  await page.goto("/admin/clients");
  await page.getByRole("button",{name,exact:true}).click();
  await expect(page.getByRole("link",{name:new RegExp(lead.number)})).toHaveCount(2);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:"test-results/stage2-client.png",fullPage:true});
});
