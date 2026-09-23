"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { CrmThemeLoader } from "@/components/crm-theme-loader";
import { Icon, type IconName } from "@/components/icons";

const operational: Array<[string, string, IconName, string]> = [
  ["Обзор", "/admin", "overview", "OVERVIEW_VIEW"],
  ["Заявки", "/admin/applications", "applications", "APPLICATIONS_VIEW"],
  ["Клиенты", "/admin/clients", "clients", "CLIENTS_VIEW"],
  ["Заказы", "/admin/orders", "orders", "ORDERS_VIEW"],
  ["Исполнители", "/admin/translators", "executors", "EXECUTORS_VIEW"],
  ["Файлы", "/admin/files", "files", "FILES_VIEW"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; label: string; meta: string; href: string; kind: string }>>([]);

  const admin = state?.user.role === "ADMIN";
  const permissions = state?.user.permissions ?? [];
  const allowed = (permission: string) => admin || permissions.includes(permission);
  const items = useMemo(() => {
    if (!state) return [];
    const next: Array<[string, string, IconName]> = operational
      .filter(([, , , permission]) => admin || state.user.permissions.includes(permission))
      .map(([label, href, icon]) => [label, href, icon] as [string, string, IconName]);
    if (admin || state.user.permissions.includes("USERS_MANAGE")) next.push(["Пользователи", "/admin/users", "users"]);
    if (admin || state.user.permissions.includes("SETTINGS_MANAGE")) next.push(["Настройки", "/admin/settings", "settings"]);
    return next;
  }, [admin, state]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const [applications, clients, executors, orders] = await Promise.allSettled([
          api<{ items: Array<{ id: string; number: string; company: string | null; name: string }> }>(`/api/admin/applications?search=${encodeURIComponent(query)}&page=1`, { signal: controller.signal }),
          api<{ items: Array<{ id: string; name: string; email: string }> }>(`/api/admin/companies?q=${encodeURIComponent(query)}&archived=false&page=1&language=&work_type=`, { signal: controller.signal }),
          api<{ items: Array<{ id: string; name: string; email: string }> }>(`/api/admin/executors?q=${encodeURIComponent(query)}&archived=false&page=1&language=&work_type=`, { signal: controller.signal }),
          api<{ items: Array<{ id: string; number: string; title: string }> }>(`/api/admin/crm/orders?q=${encodeURIComponent(query)}&status=&archived=false&page=1&page_size=5`, { signal: controller.signal }),
        ]);
        const next: Array<{ id: string; label: string; meta: string; href: string; kind: string }> = [];
        if (applications.status === "fulfilled") applications.value.items.slice(0, 3).forEach((item) => next.push({ id: `a-${item.id}`, label: item.company || item.name || item.number, meta: item.number, href: `/admin/applications/${item.id}`, kind: "Заявка" }));
        if (clients.status === "fulfilled") clients.value.items.slice(0, 3).forEach((item) => next.push({ id: `c-${item.id}`, label: item.name || item.email || "Клиент", meta: item.email || "Карточка клиента", href: `/admin/clients`, kind: "Клиент" }));
        if (executors.status === "fulfilled") executors.value.items.slice(0, 2).forEach((item) => next.push({ id: `e-${item.id}`, label: item.name || item.email || "Исполнитель", meta: item.email || "Карточка исполнителя", href: `/admin/translators`, kind: "Исполнитель" }));
        if (orders.status === "fulfilled") orders.value.items.slice(0, 3).forEach((item) => next.push({ id: `o-${item.id}`, label: item.title || item.number, meta: item.number, href: `/admin/orders?open=${item.id}`, kind: "Заказ" }));
        setSearchResults(next.slice(0, 9));
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    if (!open && !profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setProfileOpen(false);
      setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, profileOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeProfileOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || profileRef.current?.contains(target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("pointerdown", closeProfileOutside);
    return () => document.removeEventListener("pointerdown", closeProfileOutside);
  }, [profileOpen]);

  function closeTransientUi() {
    setOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }

  function closeTransientUiAndSearch() {
    closeTransientUi();
    setSearch("");
  }

  if (!state) return null;

  const current = items.find(([, href]) => href === "/admin" ? pathname === href : pathname.startsWith(href))?.[0] ?? "Рабочая область";
  const initials = (state.user.display_name || state.user.email)
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LC";

  async function logout() {
    await api("/api/admin/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function submitGlobalSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    const first = searchResults[0];
    if (first) {
      closeTransientUi();
      router.push(first.href);
      return;
    }
    closeTransientUi();
    router.push(`/admin/applications?search=${encodeURIComponent(query)}`);
  }

  return (
    <div className="admin-layout lc-reference-shell">
      <CrmThemeLoader />
      <a className="lc-skip-link" href="#crm-main-content">К основному содержимому</a>
      <aside className={`sidebar lc-sidebar ${open ? "sidebar--open" : ""}`} aria-label="Навигация CRM">
        <div className="lc-sidebar__brand-row">
          <Link href="/admin" className="lc-brand" onClick={closeTransientUi} aria-label="Лингво Коннект — на обзор">
            <span className="lc-brand__mark" aria-hidden="true">LC/</span>
            <span className="lc-brand__copy"><strong>Лингво Коннект</strong><small>АДМИН-ПАНЕЛЬ</small></span>
          </Link>
          <button type="button" className="lc-sidebar-close" aria-label="Закрыть меню" onClick={() => setOpen(false)}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <nav className="sidebar__nav lc-sidebar-nav" aria-label="Основная навигация">
          {items.map(([label, href, icon]) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeTransientUi}
                aria-current={active ? "page" : undefined}
                className={active ? "nav-link nav-link--active" : "nav-link"}
              >
                <Icon name={icon} size={21} />
                <strong>{label}</strong>
              </Link>
            );
          })}
        </nav>
        <div className="lc-sidebar-promo" aria-hidden="true">
          <strong>Надёжные<br />переводы.<br />Больше<br />возможностей.</strong>
          <div className="lc-sidebar-promo__art"><i/><i/><b>A</b><b>文</b></div>
        </div>
      </aside>

      {open && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={() => setOpen(false)} />}

      <div className="workspace lc-workspace">
        <header className="topbar lc-topbar">
          <button className="menu-button lc-menu-button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Icon name="menu" /></button>
          <form className="lc-global-search" onSubmit={submitGlobalSearch} role="search" onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}>
            <Icon name="search" size={19} />
            <input
              aria-label="Поиск по CRM"
              placeholder="Поиск по заявкам, клиентам, исполнителям..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {searchOpen && search.trim().length >= 2 && (
              <div className="lc-search-results" role="listbox" aria-label="Результаты быстрого поиска">
                {searching ? <span className="lc-search-results__state">Ищем по CRM…</span> : searchResults.length ? searchResults.map((item) => (
                  <Link href={item.href} key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={closeTransientUiAndSearch}>
                    <span>{item.kind}</span><strong>{item.label}</strong><small>{item.meta}</small>
                  </Link>
                )) : <span className="lc-search-results__state">Совпадений не найдено</span>}
              </div>
            )}
          </form>
          <div className="lc-topbar-actions">
            {allowed("SETTINGS_MANAGE") && <Link className="lc-icon-button" href="/admin/settings" onClick={closeTransientUi} aria-label="Настройки" title="Настройки"><Icon name="settings" /></Link>}
            <div className="lc-profile" ref={profileRef}>
              <button type="button" className="lc-profile__trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span className="lc-profile__avatar">{initials.slice(0, 1)}</span>
                <span className="lc-profile__copy"><strong>{state.user.role_name || state.user.role}</strong><small>{admin ? "Администратор" : "Сотрудник"}</small></span>
                <Icon name="chevron-down" size={16} />
              </button>
              {profileOpen && (
                <div className="lc-profile__menu">
                  <div><strong>{state.user.display_name}</strong><small>{state.user.email}</small></div>
                  {allowed("SETTINGS_MANAGE") && <Link href="/admin/settings" onClick={closeTransientUi}>Настройки</Link>}
                  <button type="button" onClick={logout}>Выйти</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="crm-main-content" className="content lc-content" data-route-title={current} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
