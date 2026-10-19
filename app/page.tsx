import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function RootPage() {
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
      <div className="card" style={{ maxWidth: 520, padding: 32 }}>
        <div className="brand" style={{ color: "var(--ink-900)", padding: 0 }}>
          <BrandMark />
          <span>
            <span className="brand-name">恒序</span>
            <span className="brand-sub">persistLog</span>
          </span>
        </div>
        <h1 style={{ marginTop: 24, fontSize: 26, letterSpacing: "-0.04em" }}>
          前端工程正在搭建
        </h1>
        <p style={{ marginTop: 8, color: "var(--ink-600)", fontSize: 12, lineHeight: 1.8 }}>
          Next.js + TypeScript 基线已就绪。页面模块会按今日、导入、路线、看板和设置依次落地。
        </p>
        <Link className="btn btn--primary" href="/today" style={{ marginTop: 20 }}>
          进入工作台
        </Link>
      </div>
    </main>
  );
}
