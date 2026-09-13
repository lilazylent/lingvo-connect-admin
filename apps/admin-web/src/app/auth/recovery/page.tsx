"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorState, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export default function RecoveryPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await api("/api/admin/auth/recovery", { method: "POST", body: JSON.stringify({ code }) });
      await refresh(); router.replace("/admin");
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Recovery временно недоступен"); }
  }
  return <AuthLayout eyebrow="RECOVERY / 05" title="Резервный вход" text="Введите один из recovery codes, полученных при настройке 2FA. После использования код будет безвозвратно погашен.">
    {error && <ErrorState message={error} />}
    <form className="form" onSubmit={submit}><Input label="Recovery code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoComplete="one-time-code" required /><Button type="submit">Использовать код →</Button></form>
  </AuthLayout>;
}
