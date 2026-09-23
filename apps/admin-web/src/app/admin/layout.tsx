"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AuthGate } from "@/components/auth-provider";

function permissionForPath(pathname: string): string | undefined {
  if (pathname.startsWith("/admin/users")) return "USERS_MANAGE";
  if (pathname.startsWith("/admin/settings")) return "SETTINGS_MANAGE";
  if (pathname.startsWith("/admin/imports")) return "IMPORTS_MANAGE";
  if (pathname.startsWith("/admin/applications")) return "APPLICATIONS_VIEW";
  if (pathname.startsWith("/admin/clients")) return "CLIENTS_VIEW";
  if (pathname.startsWith("/admin/orders")) return "ORDERS_VIEW";
  if (pathname.startsWith("/admin/translators")) return "EXECUTORS_VIEW";
  if (pathname.startsWith("/admin/files")) return "FILES_VIEW";
  if (pathname === "/admin") return "OVERVIEW_VIEW";
  return undefined;
}

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <AuthGate permission={permissionForPath(pathname)}><AdminShell>{children}</AdminShell></AuthGate>;
}
