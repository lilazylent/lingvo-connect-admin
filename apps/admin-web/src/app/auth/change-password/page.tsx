"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { stageRoute, useAuth } from "@/components/auth-provider";
import { Button, ErrorState, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AuthState } from "@/lib/types";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    setLoading(true); setError("");
    try {
      const state = await api<AuthState>("/api/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ new_password: password }),
      });
      await refresh();
      router.replace(stageRoute[state.stage]);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Не удалось изменить пароль");
    } finally { setLoading(false); }
  }

  return <AuthLayout eyebrow="SECURITY / 02" title="Создайте постоянный пароль" text="Временный пароль больше не будет действовать. Используйте длинную уникальную фразу, которой нет в других сервисах.">
    {error && <ErrorState message={error} />}
    <form className="form" onSubmit={submit}>
      <Input label="Новый пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" hint="Не менее 10 символов. Лучше использовать уникальную парольную фразу." required />
      <Input label="Повторите пароль" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
      <Button type="submit" disabled={loading}>{loading ? "Сохраняем…" : "Сохранить и продолжить →"}</Button>
    </form>
  </AuthLayout>;
}
