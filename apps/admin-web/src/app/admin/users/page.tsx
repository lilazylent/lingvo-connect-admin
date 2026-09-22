"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "@/components/auth-provider";
import {
  ActionMenu,
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { Icon, Pictogram } from "@/components/icons";

type PasswordResult = { temporary_password: string; warning: string };
type InvitationStatus = "PENDING" | "EXPIRED";
type UserInvitation = {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
  status: InvitationStatus;
};
type InviteCreateResult = { invitation: UserInvitation; registration_url: string };
type EditorState = { mode: "create" } | { mode: "edit"; user: User } | null;
type UserStatusFilter = "all" | "active" | "inactive" | "2fa";

export default function UsersPage() {
  return <AuthGate adminOnly><UsersContent /></AuthGate>;
}

function UsersContent() {
  const { state } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [oneTimeSecret, setOneTimeSecret] = useState<{ title: string; value: string } | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteCreateResult | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");

  const fetchUsers = useCallback(() => api<User[]>("/api/admin/users"), []);
  const fetchInvitations = useCallback(() => api<UserInvitation[]>("/api/admin/users/invitations"), []);

  const applyRows = useCallback((rows: User[]) => {
    setUsers(rows);
    setSelectedUser((current) => current ? rows.find((row) => row.id === current.id) ?? null : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchUsers(), fetchInvitations()])
      .then(([rows, pending]) => {
        if (cancelled) return;
        applyRows(rows);
        setInvitations(pending);
        setError("");
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить пользователей");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [applyRows, fetchInvitations, fetchUsers]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, pending] = await Promise.all([fetchUsers(), fetchInvitations()]);
      applyRows(rows);
      setInvitations(pending);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }, [applyRows, fetchInvitations, fetchUsers]);

  async function patch(user: User, changes: Partial<User>) {
    setError("");
    try {
      await api(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось обновить доступ");
    }
  }

  async function resetPassword(user: User) {
    try {
      const result = await api<PasswordResult>(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      setOneTimeSecret({ title: `Новый временный пароль для ${user.email}`, value: result.temporary_password });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось сбросить пароль");
    }
  }

  async function reset2fa(user: User) {
    if (!window.confirm(`Сбросить 2FA для ${user.email}? Все активные сессии пользователя завершатся.`)) return;
    try {
      await api(`/api/admin/users/${user.id}/reset-2fa`, { method: "POST" });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось сбросить 2FA");
    }
  }

  async function removeUser(user: User) {
    if (user.id === state?.user.id) return;
    if (!window.confirm(`Удалить пользователя ${user.display_name} (${user.email})?\n\nЭто действие нельзя отменить.`)) return;
    setError("");
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setEditor((current) => current?.mode === "edit" && current.user.id === user.id ? null : current);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось удалить пользователя");
    }
  }

  async function renewInvitation(invitation: UserInvitation) {
    setError("");
    try {
      const result = await api<InviteCreateResult>(`/api/admin/users/invitations/${invitation.id}/new-link`, { method: "POST" });
      setInviteResult(result);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось создать новую ссылку");
    }
  }

  async function cancelInvitation(invitation: UserInvitation) {
    if (!window.confirm(`Отменить приглашение для ${invitation.email}? Текущая ссылка перестанет работать.`)) return;
    setError("");
    try {
      await api(`/api/admin/users/invitations/${invitation.id}`, { method: "DELETE" });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось отменить приглашение");
    }
  }

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const managerCount = users.filter((user) => user.role === "MANAGER").length;
  const inactiveCount = users.filter((user) => !user.is_active).length;

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    return users.filter((user) => {
      if (needle && !`${user.display_name} ${user.email}`.toLocaleLowerCase("ru-RU").includes(needle)) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.is_active) return false;
      if (statusFilter === "inactive" && user.is_active) return false;
      if (statusFilter === "2fa" && !user.two_factor_enabled) return false;
      return true;
    });
  }, [query, roleFilter, statusFilter, users]);

  const panelOpen = Boolean(editor || selectedUser);

  return <div className="phase6-users">
    <header className="page-head page-head--compact phase6-users__head">
      <div>
        <span className="overline overline--accent">Лингво Коннект / Пользователи</span>
        <h1>Пользователи</h1>
        <p>Команда, роли, 2FA и доступы — в том же рабочем формате, что остальные справочники CRM.</p>
      </div>
      <Button onClick={() => { setSelectedUser(null); setEditor({ mode: "create" }); }}>
        <Icon name="plus" size={17}/> Добавить пользователя
      </Button>
    </header>

    <section className="lc-module-metrics lc-module-metrics--4" aria-label="Сводка по пользователям">
      <UserMetric icon="users" tone="pink" value={users.length} label="Всего пользователей" />
      <UserMetric icon="shield" tone="green" value={users.length - inactiveCount} label="Активные" />
      <UserMetric icon="user" tone="blue" value={managerCount} label="Менеджеры" />
      <UserMetric icon="settings" tone="orange" value={adminCount} label="Администраторы" />
    </section>

    {error && <ErrorState message={error} />}
    {oneTimeSecret && <div className="secret-notice phase6-secret" role="status">
      <div>
        <span className="overline">Показывается один раз</span>
        <strong>{oneTimeSecret.title}</strong>
        <code>{oneTimeSecret.value}</code>
        <p>Передайте пароль сотруднику безопасным каналом. При следующем входе он будет обязан заменить его.</p>
      </div>
      <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(oneTimeSecret.value)}>Копировать</Button>
      <button className="close-button" onClick={() => setOneTimeSecret(null)} aria-label="Закрыть">×</button>
    </div>}

    {invitations.length > 0 && <section className="phase6-invitations" aria-label="Ожидают регистрации">
      <header>
        <div><span className="overline">Доступы</span><h2>Ожидают регистрации</h2></div>
        <Badge tone="info">{invitations.length}</Badge>
      </header>
      <div className="phase6-invitations__list">
        {invitations.map((invitation) => <article key={invitation.id} className={invitation.status === "EXPIRED" ? "is-expired" : ""}>
          <div className="phase6-invitations__identity">
            <strong>{invitation.email}</strong>
            <span>{roleLabel(invitation.role)}</span>
          </div>
          <div className="phase6-invitations__status">
            <Badge tone={invitation.status === "EXPIRED" ? "warning" : "info"}>{invitation.status === "EXPIRED" ? "Срок истёк" : "Ожидает регистрации"}</Badge>
            <small>{invitation.status === "EXPIRED" ? "Истекло" : "Действует до"} {formatDateTime(invitation.expires_at, false)}</small>
          </div>
          <ActionMenu
            label={`Действия для приглашения ${invitation.email}`}
            items={[
              { label: "Создать новую ссылку", onSelect: () => void renewInvitation(invitation) },
              { label: "Отменить приглашение", danger: true, onSelect: () => void cancelInvitation(invitation) },
            ]}
          />
        </article>)}
      </div>
    </section>}

    <section className="phase6-commandbar" aria-label="Фильтры пользователей">
      <Input label="Поиск" placeholder="Имя или рабочий email" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Select label="Роль" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | Role)}>
        <option value="all">Все роли</option>
        <option value="MANAGER">MANAGER</option>
        <option value="ADMIN">ADMIN</option>
      </Select>
      <Select label="Состояние" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}>
        <option value="all">Все состояния</option>
        <option value="active">Активные</option>
        <option value="inactive">Отключённые</option>
        <option value="2fa">С настроенной 2FA</option>
      </Select>
      {(query || roleFilter !== "all" || statusFilter !== "all") && <Button variant="quiet" onClick={() => { setQuery(""); setRoleFilter("all"); setStatusFilter("all"); }}>Сбросить</Button>}
    </section>

    <div className={`lc-split-workspace phase6-users-workspace ${panelOpen ? "has-selection" : ""}`}>
      <section className="table-surface users-table phase6-users-table">
        <div className="table-caption">
          <span>{visibleUsers.length.toString().padStart(2, "0")} из {users.length.toString().padStart(2, "0")} учётных записей</span>
          <span>Пароли и 2FA-секреты не отображаются</span>
        </div>
        {loading ? <LoadingState /> : <div className="table-wrap">
          <table>
            <thead><tr><th>Сотрудник</th><th>Роль</th><th>2FA</th><th>Статус</th><th>Последний вход</th><th><span className="sr-only">Действия</span></th></tr></thead>
            <tbody>{visibleUsers.map((user) => <tr
              key={user.id}
              className={selectedUser?.id === user.id ? "is-selected clickable-row" : "clickable-row"}
              tabIndex={0}
              aria-selected={selectedUser?.id === user.id}
              onClick={() => { setSelectedUser(user); setEditor(null); }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                setSelectedUser(user);
                setEditor(null);
              }}
            >
              <td><strong>{user.display_name}</strong><span>{user.email}</span></td>
              <td><Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge></td>
              <td><Badge tone={user.two_factor_enabled ? "success" : "warning"}>{user.two_factor_enabled ? "Включена" : "Требуется"}</Badge></td>
              <td><Badge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Активен" : "Отключён"}</Badge>{user.must_change_password && <small>Смена пароля</small>}</td>
              <td>{formatDateTime(user.last_login_at) || "—"}</td>
              <td onClick={(event) => event.stopPropagation()}>
                <ActionMenu
                  label={`Действия для ${user.display_name}`}
                  items={[
                    { label: "Редактировать", onSelect: () => { setSelectedUser(user); setEditor({ mode: "edit", user }); } },
                    { label: "Сбросить пароль", onSelect: () => void resetPassword(user) },
                    { label: "Сбросить 2FA", disabled: !user.two_factor_enabled, onSelect: () => void reset2fa(user) },
                    { label: user.is_active ? "Деактивировать" : "Активировать", disabled: user.id === state?.user.id, onSelect: () => void patch(user, { is_active: !user.is_active }) },
                    { label: "Удалить", danger: true, disabled: user.id === state?.user.id, onSelect: () => void removeUser(user) },
                  ]}
                />
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      {editor ? <UserEditorPanel
        key={editor.mode === "edit" ? editor.user.id : "new-user"}
        state={editor}
        currentUserId={state?.user.id ?? ""}
        onClose={() => setEditor(null)}
        onInvited={(result) => {
          setInviteResult(result);
          setEditor(null);
          void reload();
        }}
        onSaved={() => { setEditor(null); void reload(); }}
      /> : selectedUser ? <UserPreview
        user={selectedUser}
        isSelf={selectedUser.id === state?.user.id}
        onClose={() => setSelectedUser(null)}
        onEdit={() => setEditor({ mode: "edit", user: selectedUser })}
        onResetPassword={() => void resetPassword(selectedUser)}
        onReset2fa={() => void reset2fa(selectedUser)}
        onToggle={() => void patch(selectedUser, { is_active: !selectedUser.is_active })}
      /> : null}
    </div>

    {inviteResult && <InviteLinkDialog result={inviteResult} onClose={() => setInviteResult(null)} />}
  </div>;
}

function UserEditorPanel({
  state,
  currentUserId,
  onClose,
  onInvited,
  onSaved,
}: {
  state: Exclude<EditorState, null>;
  currentUserId: string;
  onClose: () => void;
  onInvited: (result: InviteCreateResult) => void;
  onSaved: () => void;
}) {
  const editing = state.mode === "edit" ? state.user : null;
  const [email, setEmail] = useState(editing?.email ?? "");
  const [name, setName] = useState(editing?.display_name ?? "");
  const [role, setRole] = useState<Role>(editing?.role ?? "MANAGER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/api/admin/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_name: name, role }),
        });
        onSaved();
      } else {
        const result = await api<InviteCreateResult>("/api/admin/users/invitations", {
          method: "POST",
          body: JSON.stringify({ email, role }),
        });
        onInvited(result);
      }
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : editing ? "Не удалось сохранить сотрудника" : "Не удалось создать приглашение");
    } finally {
      setBusy(false);
    }
  }

  return <aside className="lc-detail-panel phase6-user-editor" aria-label={editing ? "Редактирование пользователя" : "Добавление пользователя"}>
    <header>
      <div><span>{editing ? "Редактирование" : "Новое приглашение"}</span><h2>{editing?.display_name || "Добавить пользователя"}</h2></div>
      <button type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={18}/></button>
    </header>
    <form className="phase6-user-editor__form" onSubmit={submit}>
      {error && <ErrorState message={error} />}
      {!editing && <p className="phase6-user-editor__hint">Укажите рабочий email и роль. После создания вы получите одноразовую ссылку для регистрации сотрудника.</p>}
      <fieldset disabled={busy}>
        {editing && <Input label="Имя" value={name} onChange={(event) => setName(event.target.value)} />}
        <Input label="Рабочий email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={Boolean(editing)} autoComplete="off" />
        <Select label="Роль" value={role} disabled={editing?.id === currentUserId} onChange={(event) => setRole(event.target.value as Role)}>
          <option value="MANAGER">Менеджер</option>
          <option value="ADMIN">Администратор</option>
        </Select>
      </fieldset>
      <div className="phase6-user-editor__actions">
        <Button disabled={busy}>{busy ? "Сохраняем…" : editing ? "Сохранить" : "Создать приглашение"}</Button>
        <Button type="button" variant="quiet" onClick={onClose} disabled={busy}>Отмена</Button>
      </div>
    </form>
  </aside>;
}

function InviteLinkDialog({ result, onClose }: { result: InviteCreateResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(result.registration_url);
    setCopied(true);
  }
  return <div className="phase6-invite-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="phase6-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
      <header>
        <div><span className="overline overline--accent">Приглашение создано</span><h2 id="invite-dialog-title">Ссылка для регистрации</h2></div>
        <button type="button" className="close-button" onClick={onClose} aria-label="Закрыть">×</button>
      </header>
      <div className="phase6-invite-dialog__body">
        <p>Отправьте эту ссылку сотруднику <strong>{result.invitation.email}</strong>. Email уже закреплён за приглашением — при регистрации его изменить нельзя.</p>
        <code>{result.registration_url}</code>
        <div className="phase6-invite-dialog__meta">
          <span><b>Роль</b>{roleLabel(result.invitation.role)}</span>
          <span><b>Срок действия</b>до {formatDateTime(result.invitation.expires_at, false)}</span>
        </div>
        <p className="phase6-invite-dialog__note">Ссылка одноразовая. После регистрации сотрудник сам задаст пароль и подключит 2FA.</p>
      </div>
      <footer>
        <Button type="button" onClick={() => void copyLink()}>{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Готово</Button>
      </footer>
    </section>
  </div>;
}

function UserMetric({ icon, tone, value, label }: { icon: Parameters<typeof Icon>[0]["name"]; tone: string; value: number; label: string }) {
  return <div className={`lc-module-metric lc-module-metric--${tone}`}><span><Pictogram name={icon} size={19} /></span><strong>{value}</strong><b>{label}</b></div>;
}

function UserPreview({ user, isSelf, onClose, onEdit, onResetPassword, onReset2fa, onToggle }: { user: User; isSelf: boolean; onClose: () => void; onEdit: () => void; onResetPassword: () => void; onReset2fa: () => void; onToggle: () => void }) {
  const initials = user.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return <aside className="lc-detail-panel lc-user-preview phase6-user-preview">
    <header><div><span>Пользователь</span><h2>{user.display_name}</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={18}/></button></header>
    <div className="lc-user-preview__identity"><span>{initials}</span><div><strong>{user.display_name}</strong><small>{user.email}</small><Badge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Активен" : "Отключён"}</Badge></div></div>
    <section className="lc-detail-data"><div><span>Роль</span><strong>{user.role}</strong></div><div><span>2FA</span><strong>{user.two_factor_enabled ? "Включена" : "Не настроена"}</strong></div><div><span>Последний вход</span><strong>{formatDateTime(user.last_login_at) || "Не входил"}</strong></div><div><span>Создан</span><strong>{formatDateTime(user.created_at, false)}</strong></div></section>
    <section><div className="lc-detail-section-title"><Icon name="shield" size={17}/><strong>Безопасность</strong></div><p>{user.must_change_password ? "При следующем входе пользователь должен сменить пароль." : "Обязательная смена пароля не требуется."}</p></section>
    <div className="lc-user-preview__actions"><Button onClick={onEdit}>Редактировать</Button><Button variant="secondary" onClick={onResetPassword}>Сбросить пароль</Button><Button variant="secondary" disabled={!user.two_factor_enabled} onClick={onReset2fa}>Сбросить 2FA</Button><Button variant="danger" disabled={isSelf} onClick={onToggle}>{user.is_active ? "Отключить доступ" : "Включить доступ"}</Button></div>
  </aside>;
}

function roleLabel(role: Role) {
  return role === "ADMIN" ? "Администратор" : "Менеджер";
}

function formatDateTime(value: string | null, includeTime = true) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}
