"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { stageRoute, useAuth } from "@/components/auth-provider";
import { Button, ErrorState, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AuthState } from "@/lib/types";

export default function LoginPage() {
  return <Suspense fallback={<AuthLayout eyebrow="AUTH / 01" title="Вход в систему" text="Загружаем защищённую форму входа." />}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const state = await api<AuthState>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      router.replace(stageRoute[state.stage]);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Сервис входа временно недоступен");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout eyebrow="AUTH / 01" title="Вход в систему" text="Используйте рабочую учетную запись. После первого входа система потребует сменить пароль и подключить 2FA.">
      {params.get("expired") && <div className="notice"><strong>Сессия завершена</strong><span>Войдите снова, чтобы продолжить работу.</span></div>}
      {error && <ErrorState message={error} />}
      <form className="form" onSubmit={submit}>
        <Input label="Рабочий email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
        <Input label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        <Button type="submit" disabled={loading}>{loading ? "Проверяем…" : "Продолжить →"}</Button>
      </form>
      <p className="form-note">Доступ предоставляется администратором. Попытки входа ограничены и фиксируются в журнале безопасности.</p>
    </AuthLayout>
  );
}
