"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { AuthLayout } from "@/components/auth-layout";
import { stageRoute, useAuth } from "@/components/auth-provider";
import { Badge, Button, ErrorState, Input, LoadingState } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AuthState, Role } from "@/lib/types";

type Invitation = {
  email: string;
  role: Role;
  expires_at: string;
};

export default function InvitationRegistrationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const token = params.token;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<Invitation>(`/api/admin/auth/invitations/${encodeURIComponent(token)}`)
      .then((value) => {
        if (!cancelled) setInvitation(value);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof ApiError ? nextError.message : "Не удалось открыть приглашение");
      })
      .finally(() => {
        if (!cancelled) setLoadingInvite(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const state = await api<AuthState>(`/api/admin/auth/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      await refresh();
      router.replace(stageRoute[state.stage]);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось завершить регистрацию");
    } finally {
      setSaving(false);
    }
  }

  return <AuthLayout
    eyebrow="ДОСТУП / РЕГИСТРАЦИЯ"
    title="Регистрация сотрудника"
    text="Приглашение уже закреплено за вашим рабочим email. Придумайте пароль — после регистрации система предложит подключить 2FA."
  >
    {loadingInvite && <LoadingState label="Проверяем приглашение" />}
    {error && <ErrorState message={error} />}
    {!loadingInvite && invitation && <>
      <div className="notice">
        <strong>{invitation.email}</strong>
        <span>Роль: <Badge tone={invitation.role === "ADMIN" ? "accent" : "neutral"}>{invitation.role === "ADMIN" ? "Администратор" : "Менеджер"}</Badge></span>
      </div>
      <form className="form" onSubmit={submit}>
        <Input label="Рабочий email" type="email" value={invitation.email} disabled readOnly />
        <Input label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" hint="Не менее 10 символов. Используйте уникальный пароль." required />
        <Input label="Повторите пароль" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
        <Button type="submit" disabled={saving}>{saving ? "Создаём аккаунт…" : "Зарегистрироваться →"}</Button>
      </form>
      <p className="form-note">Ссылка одноразовая и действует до {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}.</p>
    </>}
    {!loadingInvite && !invitation && <p className="form-note"><Link href="/login">Перейти ко входу</Link></p>}
  </AuthLayout>;
}
