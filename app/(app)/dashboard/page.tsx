import { PageHeader } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div className="view">
      <PageHeader eyebrow="Execution dashboard" title="执行看板" description="看板模块正在接入数据层。" />
      <section className="card" style={{ padding: 28 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          完成率、趋势、分布和预测模块将在下一个提交中落地。
        </p>
      </section>
    </div>
  );
}
