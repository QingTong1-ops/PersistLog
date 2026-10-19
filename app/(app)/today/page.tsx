import { PageHeader } from "@/components/ui";

export default function TodayPage() {
  return (
    <div className="view">
      <PageHeader
        eyebrow="Today · Phase 1"
        title="今天先做什么？"
        description="今日模块正在接入数据层。"
      />
      <section className="card" style={{ padding: 28 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          今日任务、容量和顺延模块将在下一个提交中落地。
        </p>
      </section>
    </div>
  );
}
