import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { AppStoreProvider } from "@/lib/store/app-store";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: {
    default: "恒序 persistLog",
    template: "%s · 恒序 persistLog",
  },
  description:
    "恒序 persistLog：把计划变成每天可执行的任务，用执行看板和企微推送驱动持续前进。",
  applicationName: "恒序 persistLog",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <AppStoreProvider>
            <ToastProvider>{children}</ToastProvider>
          </AppStoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
