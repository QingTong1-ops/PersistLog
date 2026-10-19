"use client";

import { Check, MoreHorizontal } from "lucide-react";
import type { Task } from "@/lib/types";
import { CATEGORY_TAG, STATUS_META, cn } from "@/lib/utils";

export function TaskRow({
  task,
  onOpen,
  onCheck,
}: {
  task: Task;
  onOpen: () => void;
  onCheck: () => void;
}) {
  const status = STATUS_META[task.status];
  const carryTag =
    task.carry > 0 && task.status !== "completed" ? (
      <span className="tag tag--amber">顺延 {task.carry} 次</span>
    ) : null;
  const statusTag =
    task.status === "blocked" ? (
      <span className="tag tag--coral">阻塞</span>
    ) : task.status === "in_progress" ? (
      <span className="tag tag--brand">进行中</span>
    ) : task.status === "postponed" ? (
      <span className="tag tag--neutral">已移明天</span>
    ) : task.status === "skipped" ? (
      <span className="tag tag--neutral">已跳过</span>
    ) : task.status === "abandoned" ? (
      <span className="tag tag--neutral">已放弃</span>
    ) : null;

  return (
    <article
      className={cn(
        "task-row",
        task.status === "completed" && "is-done",
        task.status === "blocked" && "is-blocked",
        task.status === "in_progress" && "is-in-progress",
        ["postponed", "skipped", "abandoned"].includes(task.status) && `is-${task.status}`
      )}
      tabIndex={0}
      role="button"
      aria-label={`${task.title}，${status.label}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <button
        className="task-check"
        type="button"
        aria-label={task.status === "completed" ? "已完成" : `完成任务：${task.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onCheck();
        }}
      >
        <Check className="icon" aria-hidden="true" />
      </button>

      <div className="task-body">
        <div className="task-top">
          <h3 className="task-title">{task.title}</h3>
          {carryTag}
          {statusTag}
        </div>
        <div className="task-meta">
          <span className={cn("tag", CATEGORY_TAG[task.type])}>{task.type}</span>
          <span>{task.stage}</span>
          <span className="dot-sep" aria-hidden="true" />
          <span>来源：{task.source}</span>
          <button
            className="task-why"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            为什么今天做？
          </button>
        </div>
      </div>

      <div className="task-side">
        <span className="task-side__copy">
          <strong>
            {task.status === "completed" ? `${task.actual || task.planned} 分钟` : `${task.planned} 分钟`}
          </strong>
          <span>
            {task.status === "completed"
              ? "实际用时"
              : task.status === "in_progress"
                ? "进行中"
                : task.status === "blocked"
                  ? "等待解除"
                  : "计划时长"}
          </span>
        </span>
        <button
          className="task-more"
          type="button"
          aria-label="打开任务详情"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <MoreHorizontal className="icon" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
