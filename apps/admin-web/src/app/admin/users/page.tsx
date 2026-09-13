"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate, useAuth } from "@/components/auth-provider";
import { Badge, Button, ErrorState, Input, LoadingState, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/lib/types";

type CreateResult = { user: User; temporary_password: string; warning: string };
type PasswordResult = { temporary_password: string; warning: string };

export default function UsersPage() {
  return <AuthGate adminOnly><UsersContent /></AuthGate>;
}

function UsersContent() {
  const { state } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("MANAGER");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("MANAGER");
  const [oneTimeSecret, setOneTimeSecret] = useState<{ title: string; value: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setUsers(await api<User[]>("/api/admin/users")); }
    catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить пользователей"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Fetch is the external source of truth for access management.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const result = await api<CreateResult>("/api/admin/users", { method: "POST", body: JSON.stringify({ email, display_name: name, role }) });
      setOneTimeSecret({ title: `Временный пароль для ${result.user.email}`, value: result.temporary_password });
      setEmail(""); setName(""); setRole("MANAGER"); setFormOpen(false); await load();
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось создать пользователя"); }
  }

  async function patch(user: User, changes: Partial<User>) {
    setError("");
    try { await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(changes) }); await load(); }
    catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось обновить доступ"); }
  }

  function beginEdit(user: User) {
    setEditingUser(user);
    setEditName(user.display_name);
    setEditRole(user.role);
    setFormOpen(false);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    setError("");
    try {
      await api(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ display_name: editName, role: editRole }),
      });
      setEditingUser(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось сохранить сотрудника");
    }
  }

  async function resetPassword(user: User) {
    const result = await api<PasswordResult>(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    setOneTimeSecret({ title: `Новый временный пароль для ${user.email}`, value: result.temporary_password });
    await load();
  }

  async function reset2fa(user: User) {
    if (!window.confirm(`Сбросить 2FA для ${user.email}? Все активные сессии пользователя завершатся.`)) return;
    await api(`/api/admin/users/${user.id}/reset-2fa`, { method: "POST" });
    await load();
  }

  async function removeUser(user: User) {
    if (user.id === state?.user.id) return;
    if (!window.confirm(`Удалить пользователя ${user.display_name} (${user.email})?\n\nЭто действие нельзя отменить.`)) return;
    setError("");
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (editingUser?.id === user.id) setEditingUser(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось удалить пользователя");
    }
  }

  return <>
    <header className="page-head"><div><span className="overline overline--accent">АДМИН-ПАНЕЛЬ / A1</span><h1>Пользователи</h1><p>Доступ сотрудников, роли и обязательные security-состояния. HR-функции не входят в этот раздел.</p></div><Button onClick={() => setFormOpen(true)}>Добавить сотрудника +</Button></header>
    {error && <ErrorState message={error} />}
    {oneTimeSecret && <div className="secret-notice" role="status"><div><span className="overline">Показывается один раз</span><strong>{oneTimeSecret.title}</strong><code>{oneTimeSecret.value}</code><p>Передайте пароль сотруднику безопасным каналом. При первом входе он будет обязан заменить его.</p></div><Button variant="secondary" onClick={() => navigator.clipboard.writeText(oneTimeSecret.value)}>Копировать</Button><button className="close-button" onClick={() => setOneTimeSecret(null)} aria-label="Закрыть">×</button></div>}
    {formOpen && <section className="inline-form"><div className="section-head"><div><span className="overline">Новая учетная запись</span><h2>Добавить сотрудника</h2></div><Button variant="quiet" onClick={() => setFormOpen(false)}>Закрыть ×</Button></div><form className="form-grid" onSubmit={create}><Input label="Имя" hint="Можно заполнить позже" value={name} onChange={(event) => setName(event.target.value)} /><Input label="Рабочий email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Select label="Роль" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="MANAGER">Менеджер</option><option value="ADMIN">Администратор</option></Select><Button type="submit">Создать доступ →</Button></form></section>}
    {editingUser && <section className="inline-form"><div className="section-head"><div><span className="overline">Учетная запись</span><h2>Редактировать сотрудника</h2><p>{editingUser.email}</p></div><Button variant="quiet" onClick={() => setEditingUser(null)}>Закрыть ×</Button></div><form className="form-grid" onSubmit={saveEdit}><Input label="Имя" hint="Можно изменить позже" value={editName} onChange={(event) => setEditName(event.target.value)} /><Select label="Роль" value={editRole} disabled={editingUser.id === state?.user.id} onChange={(event) => setEditRole(event.target.value as Role)}><option value="MANAGER">Менеджер</option><option value="ADMIN">Администратор</option></Select><Button type="submit">Сохранить →</Button></form></section>}
    <section className="table-surface users-table">
      <div className="table-caption"><span>{users.length.toString().padStart(2, "0")} учетных записей</span><span>Пароли и 2FA-секреты не отображаются</span></div>
      {loading ? <LoadingState /> : <div className="table-wrap"><table><thead><tr><th>Сотрудник</th><th>Роль</th><th>2FA</th><th>Статус</th><th>Последний вход</th><th><span className="sr-only">Действия</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.display_name}</strong><span>{user.email}</span></td><td><Select label={`Роль сотрудника ${user.display_name}`} hideLabel value={user.role} disabled={user.id === state?.user.id} onChange={(event) => patch(user, { role: event.target.value as Role })}><option value="ADMIN">Администратор</option><option value="MANAGER">Менеджер</option></Select></td><td><Badge tone={user.two_factor_enabled ? "success" : "warning"}>{user.two_factor_enabled ? "Включена" : "Требуется"}</Badge></td><td><Badge tone={user.is_active ? "neutral" : "warning"}>{user.is_active ? "Активен" : "Отключён"}</Badge>{user.must_change_password && <small>Смена пароля</small>}</td><td>{user.last_login_at ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.last_login_at)) : "—"}</td><td><details className="row-menu"><summary aria-label={`Действия для ${user.display_name}`}>•••</summary><div><button onClick={() => beginEdit(user)}>Редактировать</button><button onClick={() => resetPassword(user)}>Сбросить пароль</button><button onClick={() => reset2fa(user)} disabled={!user.two_factor_enabled}>Сбросить 2FA</button><button onClick={() => patch(user, { is_active: !user.is_active })} disabled={user.id === state?.user.id}>{user.is_active ? "Деактивировать" : "Активировать"}</button><button className="row-menu__danger" onClick={() => removeUser(user)} disabled={user.id === state?.user.id}>Удалить</button></div></details></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
