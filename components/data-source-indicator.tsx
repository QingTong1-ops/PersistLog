"use client";

import { IS_MOCK } from "@/lib/config/data-source";
import styles from "./data-source-indicator.module.css";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

export function DataSourceIndicator() {
  const router = useRouter();
  const { logout } = useAuth();
  if (!IS_MOCK) return null;
  return (
    <aside className={styles.indicator} aria-label="当前为 Mock 演示模式">
      <span><strong>Mock · 演示模式</strong><br />仅本标签页模拟保存，不连接后端/AI/企微。请勿填真实信息。</span>
      <button type="button" onClick={async () => {
        if (!window.confirm("重置本标签页的演示数据并返回登录页？不会影响真实账户。")) return;
        try {
          const { resetMockData } = await import("@/lib/api/mock/p1");
          await logout();
          resetMockData();
          router.replace("/login");
        } catch { window.alert("无法重置演示存储，请允许此站点会话存储后重试。"); }
      }}>重置演示</button>
    </aside>
  );
}
