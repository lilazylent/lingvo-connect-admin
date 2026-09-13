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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></body>
    </html>
  );
}
