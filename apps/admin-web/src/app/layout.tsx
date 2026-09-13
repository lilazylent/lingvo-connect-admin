import type { Metadata } from "next";
import "@fontsource-variable/onest";
import "./globals.css";
import "./workspace-polish.css";
import "./workspace-rhythm.css";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "Лингво Коннект — Админ-панель",
  description: "Защищённая CRM-система Лингво Коннект",
};

const themeBootScript = `(()=>{try{const p=localStorage.getItem("lc-crm-theme")||"system";const r=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;const e=document.documentElement;e.dataset.crmTheme=r;e.dataset.crmThemePreference=p;}catch{}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>
      </body>
    </html>
  );
}
