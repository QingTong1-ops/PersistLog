import { PageHeader } from "@/components/ui";

export default function RoutesPage() {
  return (
    <div className="view">
      <PageHeader eyebrow="Plans · Phase 1" title="学习路线" description="路线模块正在接入数据层。" />
      <section className="card" style={{ padding: 28 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          路线列表、阶段/周/任务和版本模块将在后续提交中落地。
        </p>
      </section>
    </div>
  );
}
