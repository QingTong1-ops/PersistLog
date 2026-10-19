import {
  EFFECTIVE_CAPACITY,
  ROUTE_BASE_DONE,
  ROUTE_BASE_TODAY_DONE,
  ROUTE_TOTAL_TASKS,
} from "@/lib/mock-data";
import type { Task, TaskStatus, TaskType } from "@/lib/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const CATEGORY_TAG: Record<TaskType, string> = {
  算法: "tag--brand",
  八股: "tag--amber",
  工程: "tag--sky",
  项目: "tag--teal",
  复盘: "tag--teal",
  简历: "tag--neutral",
  面试: "tag--coral",
};

export const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "待开始", className: "status--neutral" },
  in_progress: { label: "进行中", className: "status--draft" },
  completed: { label: "已完成", className: "status--active" },
  postponed: { label: "已移明天", className: "status--paused" },
  skipped: { label: "已跳过", className: "status--neutral" },
  blocked: { label: "已阻塞", className: "status--risk" },
  abandoned: { label: "已放弃", className: "status--neutral" },
};

export interface TaskStats {
  considered: Task[];
  completed: Task[];
  pending: Task[];
  carry: Task[];
  plannedTotal: number;
  completedPlanned: number;
  remainingPlanned: number;
  buffer: number;
  percent: number;
}

export function taskStats(tasks: Task[]): TaskStats {
  const considered = tasks.filter((task) => task.status !== "abandoned");
  const completed = considered.filter((task) => task.status === "completed");
  const pending = considered.filter((task) =>
    ["pending", "in_progress", "blocked"].includes(task.status)
  );
  const carry = considered.filter(
    (task) =>
      task.carry > 0 && ["pending", "in_progress", "blocked"].includes(task.status)
  );
  const plannedTotal = considered.reduce((sum, task) => sum + task.planned, 0);
  const completedPlanned = completed.reduce((sum, task) => sum + task.planned, 0);
  const remainingPlanned = Math.max(0, plannedTotal - completedPlanned);
  const percent = considered.length
    ? Math.round((completed.length / considered.length) * 100)
    : 0;

  return {
    considered,
    completed,
    pending,
    carry,
    plannedTotal,
    completedPlanned,
    remainingPlanned,
    buffer: EFFECTIVE_CAPACITY - plannedTotal,
    percent,
  };
}

export function routeDoneCount(tasks: Task[]) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  return ROUTE_BASE_DONE + Math.max(0, completed - ROUTE_BASE_TODAY_DONE);
}

export function routePercent(tasks: Task[]) {
  return Math.round((routeDoneCount(tasks) / ROUTE_TOTAL_TASKS) * 100);
}

export function maskWebhook(value: string) {
  const key = value.includes("key=") ? value.split("key=").pop() ?? "" : value;
  return `https://qyapi.weixin.qq.com/…/send?key=••••••${key.slice(-4) || "7a2f"}`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}
