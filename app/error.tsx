"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--canvas)",
      }}
    >
      <section className="card" style={{ maxWidth: 520, padding: 30 }}>
        <span className="eyebrow">Something went wrong</span>
        <h1 style={{ marginTop: 8, fontSize: 24, letterSpacing: "-0.035em" }}>页面暂时没有加载出来</h1>
        <p style={{ marginTop: 8, color: "var(--ink-600)", fontSize: 12, lineHeight: 1.8 }}>
          可以先重试；如果问题持续存在，请记录 request_id 或截图反馈。
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Button variant="primary" onClick={reset}>
            重试
          </Button>
          <Link className="btn btn--secondary" href="/today">
            回到今日
          </Link>
        </div>
      </section>
    </main>
  );
}
