"use client";

/* eslint-disable react-hooks/set-state-in-effect -- hydrate the selected data adapter and clear on logout. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { live, type JobTarget, type OccurrenceAction } from "@/lib/api/live";
import { mapProfile, mapRoutes, mapToday, TASK_TYPE_TO_API } from "@/lib/api/mappers";
import type { DemoUser, NewTaskInput, RouteRecord, RouteStatus, SplitPart, Task } from "@/lib/types";
import { clamp, taskStats } from "@/lib/utils";
import { IS_MOCK } from "@/lib/config/data-source";
import { useRouter } from "next/navigation";

const EMPTY_PROFILE: DemoUser = { name: "", initial: "", email: "", goal: "", targetDate: "", timezone: "Asia/Shanghai", dailyMinutes: 0, capacityFactor: 0 };
const EMPTY_PROGRESS = { done: 0, percent: 0, total: 0 };
type ActionResult = { task: Task; beforePercent: number; afterPercent: number; allDone: boolean };
interface AppStoreValue {
  tasks: Task[]; routes: RouteRecord[]; routeStates: Record<number, RouteStatus>;
  consentGranted: boolean; profile: DemoUser; todayDate: string; jobTargets: JobTarget[];
  stageNames: string[]; wecomConnected: boolean;
  /** Legacy name: true means adapter-backed, in BOTH mock and live builds. */
  live: boolean; loading: boolean; error: string | null;
  stats: ReturnType<typeof taskStats>; routeDone: number; routePercent: number; routeTotal: number;
  refreshLive: () => Promise<void>;
  startTask: (id: string) => Promise<Task | undefined>;
  completeTask: (id: string, actual: number, note: string) => Promise<ActionResult | undefined>;
  postponeTask: (id: string, reason: string) => Promise<void>;
  skipTask: (id: string, reason: string, note: string) => Promise<void>;
  blockTask: (id: string, reason: string) => Promise<void>;
  unblockTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  abandonTask: (id: string) => Promise<void>;
  splitTask: (id: string, parts: SplitPart[]) => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<Task>;
  completeAll: () => Promise<void>; clearToday: () => Promise<void>;
  setRouteStatus: (id: number, status: RouteStatus) => Promise<void>;
  setConsentGranted: (granted: boolean) => Promise<void>; resetDemo: () => void;
}
const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [profile, setProfile] = useState<DemoUser>(EMPTY_PROFILE);
  const [todayDate, setTodayDate] = useState("");
  const [jobTargets, setJobTargets] = useState<JobTarget[]>([]);
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [consentGranted, setConsent] = useState(false);
  const [wecomConnected, setWecomConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const primary = routes.find(r => r.status === "active") ?? routes[0];
  const progress = primary ? { done: primary.doneCount, percent: primary.progress, total: primary.taskCount } : EMPTY_PROGRESS;
  const capacity = Math.round(profile.dailyMinutes * profile.capacityFactor);
  const stats = taskStats(tasks, capacity);

  const load = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const version = ++generation.current;
    setLoading(true); setError(null);
    try {
      const [today, profileData, jobs, consents, routeList, channels] = await Promise.all([
        live.today.get(), live.profile.get(), live.profile.jobs(), live.profile.consents(),
        live.routes.list(), live.notifications.channels(),
      ]);
      const active = routeList.filter(r => r.status !== "archived");
      const details = await Promise.all(active.map(r => live.routes.get(r.id)));
      if (version !== generation.current) return;
      const mapped = mapRoutes(active, details, jobs, today.date);
      const main = mapped.find(r => r.status === "active") ?? mapped[0];
      const nextTasks = mapToday(today);
      setTasks(nextTasks); setTodayDate(today.date); setProfile(mapProfile(profileData, jobs));
      setJobTargets(jobs); setRoutes(mapped);
      setStageNames(details.find(r => r.id === main?.apiId)?.stages.map(s => s.name) ?? []);
      setConsent(consents.some(c => c.scope === "ai_import" && c.granted_at && !c.revoked_at));
      setWecomConnected(channels.some(c => c.status === "active"));
      return { tasks: nextTasks, progress: main?.progress ?? 0 };
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message : "无法加载计划，请重试");
      throw cause;
    } finally { if (version === generation.current) setLoading(false); }
  }, [authStatus]);

  const refreshLive = useCallback(async () => { await load().catch(() => undefined); }, [load]);
  useEffect(() => {
    const gate = generation;
    // Clear all user-scoped data before hydrating another identity. Never seed live failures with fixtures.
    generation.current++;
    setTasks([]); setRoutes([]); setProfile(EMPTY_PROFILE); setTodayDate("");
    setJobTargets([]); setStageNames([]); setConsent(false); setWecomConnected(false);
    setError(null); setLoading(false);
    if (authStatus === "authenticated") void refreshLive();
    return () => { gate.current++; };
  }, [authStatus, user?.id, refreshLive]);

  async function act(id: string, action: OccurrenceAction, body?: Record<string, unknown>) {
    const task = tasks.find(t => t.id === id);
    if (!task?.occurrenceId || authStatus !== "authenticated") throw new Error("任务状态已变化，请刷新后重试");
    await live.today.action(task.occurrenceId, action, body);
    return load();
  }
  const value: AppStoreValue = {
    tasks, routes, profile, todayDate, jobTargets, stageNames, consentGranted, wecomConnected,
    routeStates: Object.fromEntries(routes.map(r => [r.id, r.status])), live: true, loading, error, stats,
    routeDone: progress.done, routePercent: progress.percent, routeTotal: progress.total, refreshLive,
    startTask: async (id) => { const result = await act(id, "start"); return result?.tasks.find(t => t.id === id); },
    completeTask: async (id, actual, note) => {
      const task = tasks.find(t => t.id === id); if (!task) return;
      const result = await act(id, "complete", { actual_minutes: clamp(actual || task.planned, 0, 600), note: note || undefined });
      if (!result) return;
      const nextStats = taskStats(result.tasks, capacity);
      return { task, beforePercent: progress.percent, afterPercent: result.progress,
        allDone: nextStats.considered.length > 0 && nextStats.completed.length === nextStats.considered.length };
    },
    postponeTask: async (id, reason) => { await act(id, "postpone", { reason }); },
    skipTask: async (id, reason, note) => { await act(id, "skip", { reason, note }); },
    blockTask: async (id, reason) => { await act(id, "block", { reason }); },
    unblockTask: async (id) => { await act(id, "unblock"); },
    restoreTask: async () => { throw new Error("当前接口尚未支持恢复该任务，请调整计划"); },
    abandonTask: async (id) => { await act(id, "abandon"); },
    splitTask: async (id, parts) => { await act(id, "split", { parts: clamp(parts.length, 2, 4) }); },
    addTask: async (input) => {
      if (authStatus !== "authenticated") throw new Error("请先登录");
      const note = [input.output && `产出：${input.output}`, input.acceptance && `验收：${input.acceptance}`].filter(Boolean).join("\n");
      const result = await live.today.addItem({ title: input.title, estimated_minutes: clamp(input.planned, 15, 120), task_type: TASK_TYPE_TO_API[input.type], priority: "P1", note });
      await load();
      const created = mapToday(result).reverse().find(t => t.title === input.title);
      if (!created) throw new Error("未找到新任务，请刷新列表确认");
      return created;
    },
    completeAll: async () => { if (!IS_MOCK) throw new Error("仅演示模式允许批量演示操作"); for (const t of tasks) if (t.occurrenceId && !["completed", "abandoned"].includes(t.status)) await live.today.action(t.occurrenceId, "complete", { actual_minutes: t.planned }); await load(); },
    clearToday: async () => { throw new Error("请使用任务操作调整计划，不能仅清空页面数据"); },
    setRouteStatus: async (id, status) => {
      const r = routes.find(r => r.id === id); if (!r?.apiId) throw new Error("路线不存在，请刷新");
      const action = status === "paused" ? "pause" : status === "archived" ? "archive" : r.status === "paused" ? "resume" : "activate";
      await live.routes.action(r.apiId, action); await load();
    },
    setConsentGranted: async (granted) => { await live.profile.setConsent({ scope: "ai_import", version: "v1", granted }); setConsent(granted); },
    resetDemo: () => { if (IS_MOCK) void import("@/lib/api/mock/p1").then(async ({ resetMockData }) => { await logout(); resetMockData(); router.replace("/login"); }); },
  };
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error("useAppStore must be used inside AppStoreProvider");
  return context;
}
