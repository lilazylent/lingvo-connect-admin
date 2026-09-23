import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "./globals.css";
import "./legacy-visual-core.css";
import "./phase1-shell.css";
import "./phase2-ui-kit.css";
import "./phase4-directories.css";
import "./owner-readability.css";
import "./phase5-orders.css";
import "./phase6-admin.css";
import "./phase8-visual-motion.css";
import "./crm-foundation.css";
import "./phase16-owner-feedback.css";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "Лингво Коннект — Админ-панель",
  description: "Защищённая CRM-система Лингво Коннект",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeBootScript = `(()=>{try{const p=localStorage.getItem("lc-crm-theme")||"system";const r=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;const e=document.documentElement;e.dataset.crmTheme=r;e.dataset.crmThemePreference=p;}catch{}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning data-build-id="phase16-owner-feedback-20260923-r1">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>
      </body>
    </html>
  );
}
