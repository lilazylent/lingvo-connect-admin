"use client";

import { AdminShell } from "@/components/admin-shell";
import { AuthGate } from "@/components/auth-provider";

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate><AdminShell>{children}</AdminShell></AuthGate>;
}
