import { PageHeader } from "@/components/ui";

export default function ImportPage() {
  return (
    <div className="view">
      <PageHeader eyebrow="Import · Markdown only" title="导入一份计划" description="导入模块正在接入状态机。" />
      <section className="card" style={{ padding: 28 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          上传、解析、预览和确认模块将在后续提交中落地。
        </p>
      </section>
    </div>
  );
}
