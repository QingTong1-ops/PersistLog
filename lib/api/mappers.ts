import type { DemoUser, RouteRecord, RouteStatus, Task, TaskStatus, TaskType } from "@/lib/types";
import type {
  JobTarget,
  ProfileResponse,
  RouteDetail,
  RouteListItem,
  TodayItem,
  TodayResponse,
} from "@/lib/api/live";

const TASK_TYPE: Record<string, TaskType> = {
  algorithm: "算法",
  fundamentals: "八股",
  engineering: "工程",
  project: "项目",
  resume: "简历",
  interview: "面试",
  review: "复盘",
  reflection: "复盘",
  apply: "复盘",
};

const ROUTE_STATUS: Record<string, RouteStatus> = {
  active: "active",
  paused: "paused",
  draft: "draft",
  completed: "archived",
  archived: "archived",
};

const TASK_STATUS: Record<string, TaskStatus> = {
  pending: "pending",
  in_progress: "in_progress",
  completed: "completed",
  postponed: "postponed",
  skipped: "skipped",
  blocked: "blocked",
  abandoned: "abandoned",
};

export function daysBetween(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1);
}

export function daysFromToday(date: string, today = new Date()) {
  const target = Date.parse(`${date}T00:00:00Z`);
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (Number.isNaN(target)) return 0;
  return Math.round((target - current) / 86_400_000);
}

export function formatChineseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 ${weekdays[date.getUTCDay()]}`;
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function mapTaskType(value: string): TaskType {
  return TASK_TYPE[value] ?? "复盘";
}

function mapTaskStatus(value: string): TaskStatus {
  return TASK_STATUS[value] ?? "pending";
}

export function mapTodayItem(item: TodayItem): Task {
  return {
    id: item.id,
    occurrenceId: item.id,
    taskId: item.task_id,
    title: item.title,
    type: mapTaskType(item.task_type),
    stage: item.stage_name ?? item.week_focus ?? "今日计划",
    source: item.source_type === "imported" ? "导入" : item.source_type === "manual" ? "手动" : item.source_type,
    planned: item.planned_minutes,
    actual: item.actual_minutes ?? 0,
    status: mapTaskStatus(item.status),
    carry: item.carry_over || item.carry_over_from_id ? 1 : 0,
    carryOverFrom: item.carry_over_from_id ?? undefined,
    postponeCount: item.postpone_count,
    why: item.why,
    output: "",
    acceptance: "",
    note: item.note ?? "",
    blockReason: item.block_reason ?? undefined,
    skipReason: item.skip_reason ?? undefined,
  };
}

export function mapToday(today: TodayResponse): Task[] {
  const seen = new Set<string>();
  return [...today.items, ...today.carry_over]
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map(mapTodayItem);
}

export function mapProfile(profile: ProfileResponse, jobs: JobTarget[]): DemoUser {
  const primary = jobs.find((job) => job.is_primary && job.status === "active") ?? jobs[0];
  const name = profile.user.display_name?.trim() || profile.user.email.split("@")[0];
  return {
    name,
    initial: name.slice(0, 1).toUpperCase(),
    email: profile.user.email,
    goal: primary?.title ?? "未设置主目标",
    targetDate: primary?.target_date ?? "",
    timezone: profile.user.timezone,
    dailyMinutes: profile.daily_available_minutes,
    capacityFactor: profile.planning_capacity_factor,
    createdAt: profile.user.created_at,
  };
}

function totalTaskMinutes(detail: RouteDetail) {
  return detail.stages.reduce(
    (total, stage) =>
      total + stage.weeks.reduce((weekTotal, week) => weekTotal + week.tasks.reduce((sum, task) => sum + task.estimated_minutes, 0), 0),
    0
  );
}

function currentStageName(detail: RouteDetail, today: string) {
  const stage = detail.stages.find(
    (item) => item.start_date && item.end_date && item.start_date <= today && today <= item.end_date
  );
  const name = stage?.name ?? detail.stages[0]?.name ?? "执行中";
  return name.replace(/（.*$/, "").trim();
}

export function mapRoutes(
  list: RouteListItem[],
  details: RouteDetail[],
  jobs: JobTarget[],
  today: string
): RouteRecord[] {
  const byId = new Map(details.map((detail) => [detail.id, detail]));
  const primary = jobs.find((job) => job.is_primary && job.status === "active") ?? jobs[0];
  const ordered = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return ordered.map((route, index) => {
    const detail = byId.get(route.id);
    const days = daysBetween(route.start_date, route.end_date);
    const totalTasks = detail?.progress.total_tasks ?? route.progress?.total_tasks ?? 0;
    const doneTasks = detail?.progress.completed_tasks ?? route.progress?.completed_tasks ?? 0;
    const percent = detail?.progress.percent ?? route.progress?.percent ?? 0;
    return {
      id: index + 1,
      apiId: route.id,
      name: route.title,
      job: primary?.title ?? "求职目标",
      status: ROUTE_STATUS[route.status] ?? "draft",
      days,
      taskCount: totalTasks,
      doneCount: doneTasks,
      plannedMinutes: detail ? totalTaskMinutes(detail) : route.daily_capacity_minutes * days,
      forecast: route.forecast_end_date,
      targetDate: primary?.target_date ?? route.end_date,
      progress: Math.round(percent),
      currentStage: detail ? currentStageName(detail, today) : "执行中",
      day: Math.max(1, -daysFromToday(route.start_date) + 1),
      startDate: route.start_date,
      endDate: route.end_date,
      dailyCapacity: route.daily_capacity_minutes,
    };
  });
}

export interface StageTaskView {
  id?: string;
  title: string;
  type: string;
  minutes: number;
  date: string;
  status: TaskStatus;
}

export interface StageWeekView {
  title: string;
  meta: string;
  tasks: StageTaskView[];
}

export interface StageView {
  title: string;
  meta: string;
  progress: string;
  width: number;
  open: boolean;
  weeks: StageWeekView[];
}

export function mapRouteStages(detail: RouteDetail, todayTasks: Task[] = []): StageView[] {
  const completedTaskIds = new Set(
    todayTasks.filter((task) => task.status === "completed" && task.taskId).map((task) => task.taskId)
  );
  return detail.stages.map((stage, stageIndex) => {
    const tasks = stage.weeks.flatMap((week) => week.tasks);
    const completed = tasks.filter((task) => completedTaskIds.has(task.id)).length;
    const total = tasks.length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return {
      title: `阶段${stage.order_no} · ${stage.name.replace(/（.*$/, "").trim()}`,
      meta: `${stage.start_date ?? "—"} – ${stage.end_date ?? "—"} · ${total} 个任务`,
      progress: `${completed} / ${total} · ${percent}%`,
      width: percent,
      open: stageIndex < 2,
      weeks: stage.weeks.map((week) => ({
        title: `第 ${week.week_no} 周 · ${week.focus ?? "本周目标"}`,
        meta: `${week.start_date ?? "—"} – ${week.end_date ?? "—"} · ${week.tasks.length} 项`,
        tasks: week.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          type: mapTaskType(task.task_type),
          minutes: task.estimated_minutes,
          date: task.planned_date ? formatShortDate(task.planned_date) : "待排期",
          status: completedTaskIds.has(task.id) ? "completed" : "pending",
        })),
      })),
    };
  });
}

export function mapRouteMeta(detail: RouteDetail, today: string) {
  const days = daysBetween(detail.start_date, detail.end_date);
  return {
    days,
    day: Math.max(1, -daysFromToday(detail.start_date) + 1),
    currentStage: currentStageName(detail, today),
    targetDate: detail.end_date,
  };
}
