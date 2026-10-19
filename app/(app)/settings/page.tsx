import { PageHeader } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="view">
      <PageHeader eyebrow="Settings" title="设置" description="设置模块正在接入数据层。" />
      <section className="card" style={{ padding: 28 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          档案、推送、AI 授权和数据模块将在后续提交中落地。
        </p>
      </section>
    </div>
  );
}
