import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Проблема есть",
  description: "Telegram Mini App для публикации и поддержки городских проблем"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
        <AppNav />
      </body>
    </html>
  );
}
