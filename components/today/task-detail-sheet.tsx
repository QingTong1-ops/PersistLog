"use client";

import {
  Ban,
  Check,
  Clock,
  FileText,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Split,
  Target,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { Button, Sheet, StatusBadge, Tag } from "@/components/ui";
import type { Task } from "@/lib/types";
import { CATEGORY_TAG, STATUS_META } from "@/lib/utils";

export type TaskAction =
  | "start"
  | "complete"
  | "postpone"
  | "skip"
  | "block"
  | "unblock"
  | "restore"
  | "abandon"
  | "split";

function Action({
  action,
  label,
  icon,
  variant = "secondary",
  onAction,
}: {
  action: TaskAction;
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  onAction: (action: TaskAction) => void;
}) {
  return (
    <Button variant={variant} size="sm" onClick={() => onAction(action)}>
      {icon}
      {label}
    </Button>
  );
}

export function TaskDetailSheet({
  task,
  open,
  onClose,
  onAction,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onAction: (action: TaskAction) => void;
}) {
  if (!task) return null;
  const status = STATUS_META[task.status];
  const statusLine =
    task.status === "completed"
      ? `已完成 · 计划 ${task.planned} 分钟 · 实际 ${task.actual || task.planned} 分钟`
      : task.status === "blocked"
        ? `已阻塞 · ${task.blockReason || "等待解除阻塞"}`
        : task.status === "postponed"
          ? "已延期到明天 · 新实例会继承顺延次数"
          : task.status === "skipped"
            ? `已跳过 · ${task.skipReason || "可在路线详情重新排期"}`
            : task.status === "abandoned"
              ? "已放弃 · 不计入完成率分母"
              : `${status.label} · 计划 ${task.planned} 分钟`;

  const actions: React.ReactNode[] = [];
  if (["pending", "in_progress"].includes(task.status)) {
    if (task.status === "pending") {
      actions.push(
        <Action
          key="start"
          action="start"
          label="开始执行"
          icon={<Play className="icon" aria-hidden="true" />}
          onAction={onAction}
        />
      );
    }
    actions.push(
      <Action
        key="complete"
        action="complete"
        label="完成并记录"
        icon={<Check className="icon" aria-hidden="true" />}
        variant="primary"
        onAction={onAction}
      />,
      <Action
        key="postpone"
        action="postpone"
        label="延期到明天"
        icon={<RefreshCw className="icon" aria-hidden="true" />}
        onAction={onAction}
      />,
      <Action
        key="skip"
        action="skip"
        label="跳过"
        icon={<SkipForward className="icon" aria-hidden="true" />}
        onAction={onAction}
      />,
      <Action
        key="block"
        action="block"
        label="标记阻塞"
        icon={<Ban className="icon" aria-hidden="true" />}
        onAction={onAction}
      />,
      <Action
        key="split"
        action="split"
        label="拆分为两项"
        icon={<Split className="icon" aria-hidden="true" />}
        onAction={onAction}
      />,
      <Action
        key="abandon"
        action="abandon"
        label="放弃任务"
        icon={<Trash2 className="icon" aria-hidden="true" />}
        variant="danger"
        onAction={onAction}
      />
    );
  } else if (task.status === "blocked") {
    actions.push(
      <Action
        key="unblock"
        action="unblock"
        label="解除阻塞"
        icon={<Unlock className="icon" aria-hidden="true" />}
        variant="primary"
        onAction={onAction}
      />,
      <Action
        key="abandon"
        action="abandon"
        label="放弃任务"
        icon={<Trash2 className="icon" aria-hidden="true" />}
        variant="danger"
        onAction={onAction}
      />
    );
  } else if (["postponed", "skipped"].includes(task.status)) {
    actions.push(
      <Action
        key="restore"
        action="restore"
        label="恢复到今日"
        icon={<RotateCcw className="icon" aria-hidden="true" />}
        onAction={onAction}
      />,
      <Action
        key="abandon"
        action="abandon"
        label="放弃任务"
        icon={<Trash2 className="icon" aria-hidden="true" />}
        variant="danger"
        onAction={onAction}
      />
    );
  } else if (task.status === "completed") {
    actions.push(
      <Action
        key="complete"
        action="complete"
        label="修改实际分钟"
        icon={<Clock className="icon" aria-hidden="true" />}
        onAction={onAction}
      />
    );
  }

  return (
    <Sheet open={open} onClose={onClose} label="任务详情">
      <div className="sheet__head">
        <div>
          <span className="eyebrow">任务详情</span>
          <h2>{task.title}</h2>
          <p>
            {task.type} · {task.stage} · 来源：{task.source}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭任务详情">
          <X className="icon" aria-hidden="true" />
        </Button>
      </div>
      <div className="sheet__body">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 13 }}>
          <Tag variant="neutral">{task.type}</Tag>
          <StatusBadge status={task.status} />
          {task.carry ? <Tag variant="amber">顺延 {task.carry} 次</Tag> : null}
          <Tag variant="outline">{task.planned} 分钟</Tag>
        </div>

        <div className="sheet__section">
          <h3>状态</h3>
          <p>{statusLine}</p>
        </div>

        <div className="sheet__section">
          <h3>为什么今天做</h3>
          <p>{task.why}</p>
        </div>

        <div className="sheet__section">
          <h3>产出要求</h3>
          <p>{task.output || "尚未填写产出要求；导入时会产生 warning。"}</p>
        </div>

        <div className="sheet__section">
          <h3>验收标准</h3>
          <p>{task.acceptance || "尚未填写验收标准；建议确认前补全。"}</p>
        </div>

        {task.note ? (
          <div className="sheet__section">
            <h3>记录</h3>
            <p>{task.note}</p>
          </div>
        ) : null}

        <div className="sheet__section">
          <h3>操作</h3>
          <div className="sheet__actions">
            {actions.length ? (
              actions
            ) : (
              <p className="muted" style={{ fontSize: 10 }}>
                该任务已结束，没有可执行操作。
              </p>
            )}
          </div>
        </div>

        <div className="sheet__section">
          <p className="muted" style={{ fontSize: 9.5 }}>
            状态流转：pending → in_progress → completed；pending/in_progress → postponed / skipped /
            blocked / abandoned；blocked → pending。所有高风险操作都应在正式版支持撤销或恢复。
          </p>
        </div>

        <div className="sheet__section" style={{ display: "flex", gap: 12, color: "var(--ink-400)" }}>
          <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
            <Target className="icon icon--sm" aria-hidden="true" /> 路线任务
          </span>
          <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
            <FileText className="icon icon--sm" aria-hidden="true" /> 有产出与验收
          </span>
        </div>
      </div>
    </Sheet>
  );
}
