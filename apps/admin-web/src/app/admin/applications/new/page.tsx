"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button, ErrorState, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import { serviceOptions } from "@/lib/applications";
import type { ApplicationDetail, UserSummary } from "@/lib/types";

export default function NewApplicationPage() {
  const router = useRouter();
  const { notify } = useToast();
  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    name: "", contact_method: "email", contact: "", company: "",
    requested_service: "not_sure", source_language: "", target_language: "",
    message: "", desired_date: "", responsible_user_id: "",
  });

  useEffect(() => { void api<UserSummary[]>("/api/admin/applications/managers").then(setManagers).catch(() => setError("Не удалось загрузить список менеджеров")); }, []);
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await api<ApplicationDetail>("/api/admin/applications", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          company: values.company || null,
          source_language: values.source_language || null,
          target_language: values.target_language || null,
          desired_date: values.desired_date || null,
          responsible_user_id: values.responsible_user_id || null,
        }),
      });
      notify(`Заявка ${result.number} создана`);
      router.replace(`/admin/applications/${result.id}`);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось создать заявку");
    } finally { setSaving(false); }
  }

  return <>
    <header className="page-head page-head--compact"><div><span className="overline overline--accent">Входящие / регистрация</span><h1>Добавить обращение</h1><p>Запишите запрос, полученный по телефону, почте или в мессенджере. В списке он будет отмечен «Вручную». Клиент и заказ при этом не создаются.</p></div><Link className="text-link" href="/admin/applications">← Все заявки</Link></header>
    {error && <ErrorState message={error} />}
    <form className="manual-application-form" onSubmit={submit}>
      <section className="form-section"><div className="form-section__head"><span>01</span><div><h2>Кто обратился</h2><p>Запишите то, что уже известно. Любое поле можно дополнить позже.</p></div></div><div className="form-section__grid"><Input label="Имя контакта" hint="Можно заполнить позже" placeholder="Имя и фамилия" value={values.name} onChange={(event) => update("name", event.target.value)} maxLength={100} /><Input label="Компания по заявке" hint="Можно оставить пустым. Отдельная карточка компании пока не создаётся." placeholder="Название компании" value={values.company} onChange={(event) => update("company", event.target.value)} /><Select label="Способ связи" value={values.contact_method} onChange={(event) => update("contact_method", event.target.value)}><option value="email">Email</option><option value="phone">Телефон</option><option value="messenger">Мессенджер</option></Select><Input label={values.contact_method === "email" ? "Email" : values.contact_method === "phone" ? "Телефон" : "Контакт в мессенджере"} type={values.contact_method === "email" ? "email" : "text"} placeholder={values.contact_method === "email" ? "name@company.ru" : values.contact_method === "phone" ? "+7 …" : "Номер или имя пользователя"} value={values.contact} hint="Можно оставить пустым и заполнить после уточнения" onChange={(event) => update("contact", event.target.value)} /></div></section>
      <section className="form-section"><div className="form-section__head"><span>02</span><div><h2>Задача</h2><p>Исходные параметры обращения</p></div></div><div className="form-section__grid"><Select label="Услуга" value={values.requested_service} onChange={(event) => update("requested_service", event.target.value)}>{serviceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select><Input label="Язык оригинала" value={values.source_language} onChange={(event) => update("source_language", event.target.value)} /><Input label="Язык перевода" value={values.target_language} onChange={(event) => update("target_language", event.target.value)} /><Input label="Желаемая дата" type="date" value={values.desired_date} onChange={(event) => update("desired_date", event.target.value)} /><div className="form-span"><Textarea label="Описание задачи" hint="Можно заполнить позже" rows={4} value={values.message} onChange={(event) => update("message", event.target.value)} /></div></div></section>
      <section className="form-section"><div className="form-section__head"><span>03</span><div><h2>Обработка</h2><p>Ответственный сотрудник</p></div></div><div className="form-section__grid form-section__grid--short"><Select label="Ответственный" value={values.responsible_user_id} onChange={(event) => update("responsible_user_id", event.target.value)}><option value="">Не назначен</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.display_name}</option>)}</Select></div></section>
      <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? "Создаём…" : "Создать заявку →"}</Button><Link className="button button--secondary button-link" href="/admin/applications">Отмена</Link></div>
    </form>
  </>;
}
