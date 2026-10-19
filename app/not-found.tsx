import Link from "next/link";

export default function NotFound() {
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
        <span className="eyebrow">404</span>
        <h1 style={{ marginTop: 8, fontSize: 24, letterSpacing: "-0.035em" }}>找不到这个页面</h1>
        <p style={{ marginTop: 8, color: "var(--ink-600)", fontSize: 12, lineHeight: 1.8 }}>
          链接可能已经变化，或者这个模块还没有进入 Phase 1。
        </p>
        <Link className="btn btn--primary" href="/today" style={{ marginTop: 18 }}>
          回到今日
        </Link>
      </section>
    </main>
  );
}
