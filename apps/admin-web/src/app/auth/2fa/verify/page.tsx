"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorState, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await api("/api/admin/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code }) });
      await refresh(); router.replace("/admin");
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Проверка временно недоступна"); }
  }
  return <AuthLayout eyebrow="SECURITY / 04" title="Подтвердите вход" text="Введите текущий шестизначный код из приложения-аутентификатора.">
    {error && <ErrorState message={error} />}
    <form className="form" onSubmit={submit}><Input label="Одноразовый код" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /><Button type="submit">Подтвердить →</Button></form>
    <Link className="text-link" href="/auth/recovery">Использовать recovery code</Link>
  </AuthLayout>;
}
