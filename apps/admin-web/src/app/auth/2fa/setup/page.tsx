"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorState, Input, LoadingState } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Setup = { manual_key: string; qr_data_uri: string };
type Codes = { recovery_codes: string[]; warning: string };

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api<Setup>("/api/admin/auth/2fa/setup").then(setSetup).catch((nextError) => setError(nextError.message)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const result = await api<Codes>("/api/admin/auth/2fa/setup", { method: "POST", body: JSON.stringify({ code }) });
      setCodes(result.recovery_codes); await refresh();
    } catch (nextError) { setError(nextError instanceof ApiError ? nextError.message : "Не удалось подтвердить 2FA"); }
  }

  if (!setup && !error) return <AuthLayout eyebrow="SECURITY / 03" title="Подключение 2FA" text="Готовим защищённый ключ."><LoadingState /></AuthLayout>;
  return <AuthLayout eyebrow="SECURITY / 03" title={codes ? "Сохраните recovery codes" : "Подключите authenticator"} text={codes ? "Каждый код действует один раз. Сохраните их в защищённом месте — повторно они показаны не будут." : "Отсканируйте QR-код приложением-аутентификатором, затем подтвердите шестизначный код."}>
    {error && <ErrorState message={`${error}. Проверьте автоматические дату и время на телефоне и введите текущий код сразу после его обновления.`} />}
    {codes ? <div className="recovery-list">{codes.map((item) => <code key={item}>{item}</code>)}<Button onClick={() => router.replace("/admin")}>Я сохранил коды →</Button></div> : setup && <>
      <div className="totp-setup"><Image src={setup.qr_data_uri} alt="QR-код для настройки authenticator" width={184} height={184} unoptimized /><div><span className="field__label">Ключ для ручной настройки</span><code className="manual-key">{setup.manual_key}</code><p>Не передавайте этот ключ другим людям.</p></div></div>
      <form className="form form--compact" onSubmit={submit}><Input label="Код из приложения" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /><Button type="submit">Подтвердить 2FA →</Button></form>
    </>}
  </AuthLayout>;
}
