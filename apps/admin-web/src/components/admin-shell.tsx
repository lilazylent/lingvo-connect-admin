"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button } from "@/components/ui";
import { CrmThemeLoader } from "@/components/crm-theme-loader";

const operational = [
  ["Обзор", "/admin", "01"],
  ["Заявки", "/admin/applications", "02"],
  ["Клиенты", "/admin/clients", "03"],
  ["Заказы", "/admin/orders", "04"],
  ["Исполнители", "/admin/translators", "05"],
  ["Файлы", "/admin/files", "06"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!state) return null;
  const admin = state.user.role === "ADMIN";
  const items = admin ? [...operational, ["Пользователи", "/admin/users", "A1"], ["Настройки", "/admin/settings", "A2"]] : [...operational, ["Настройки", "/admin/settings", "07"]];
  const planned = new Set(["/admin/files"]);
  const current = items.find(([, href]) => href === "/admin" ? pathname === href : pathname.startsWith(href))?.[0] ?? "Рабочая область";

  async function logout() {
    await api("/api/admin/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="admin-layout">
      <CrmThemeLoader />
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand"><span className="brand__monogram">LC/</span><span className="brand__wordmark"><strong>Лингво Коннект</strong><small>CRM · РАБОЧАЯ СРЕДА</small></span></div>
        <nav className="sidebar__nav" aria-label="Основная навигация">
          <span className="nav-label">Рабочая область</span>
          {items.map(([label, href, index]) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
            <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={active ? "nav-link nav-link--active" : "nav-link"}>
              <span>{index}</span><strong>{label}</strong>{planned.has(href) ? <small className="nav-planned">Позже</small> : <i>↗</i>}
            </Link>
          )})}
        </nav>
        <div className="sidebar__foot"><span className="security-dot" />Защищённая сессия</div>
      </aside>
      {open && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Открыть меню">☰</button>
          <div className="breadcrumbs"><span>Лингво Коннект</span><i>/</i><strong>{current}</strong></div>
          <div className="user-menu">
            <div><strong>{state.user.display_name || state.user.email.split("@")[0]}</strong><span>{state.user.email}</span></div>
            <Badge tone={admin ? "accent" : "neutral"}>{state.user.role}</Badge>
            <Button variant="quiet" onClick={logout}>Выйти</Button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
