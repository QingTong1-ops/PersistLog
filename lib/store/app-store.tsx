"use client";

/* eslint-disable react-hooks/set-state-in-effect -- the store hydrates from the authenticated API session. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_ROUTE_STATES,
  INITIAL_ROUTES,
  INITIAL_TASKS,
  DEMO_USER,
  ROUTE_TOTAL_TASKS,
} from "@/lib/mock-data";
import { useAuth } from "@/lib/auth/auth-provider";
import { live, type JobTarget } from "@/lib/api/live";
import { mapProfile, mapRoutes, mapToday } from "@/lib/api/mappers";
import type {
  DemoUser,
  NewTaskInput,
  RouteRecord,
  RouteStatus,
  SplitPart,
  Task,
} from "@/lib/types";
import { clamp, routeDoneCount, routePercent, taskStats } from "@/lib/utils";

type TaskActionResult = {
  task: Task;
  beforePercent: number;
  afterPercent: number;
  allDone: boolean;
};

interface RouteProgressState {
  done: number;
  percent: number;
  total: number;
}

interface AppStoreValue {
  tasks: Task[];
  routes: RouteRecord[];
  routeStates: Record<number, RouteStatus>;
  consentGranted: boolean;
  profile: DemoUser;
  todayDate: string;
  jobTargets: JobTarget[];
  stageNames: string[];
  wecomConnected: boolean;
  live: boolean;
  loading: boolean;
  error: string | null;
  stats: ReturnType<typeof taskStats>;
  routeDone: number;
  routePercent: number;
  routeTotal: number;
  refreshLive: () => Promise<void>;
  startTask: (id: string) => Promise<Task | undefined>;
  completeTask: (id: string, actual: number, note: string) => Promise<TaskActionResult | undefined>;
  postponeTask: (id: string, reason: string) => Promise<void>;
  skipTask: (id: string, reason: string, note: string) => Promise<void>;
  blockTask: (id: string, reason: string) => Promise<void>;
  unblockTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  abandonTask: (id: string) => Promise<void>;
  splitTask: (id: string, parts: SplitPart[]) => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<Task>;
  completeAll: () => Promise<void>;
  clearToday: () => Promise<void>;
  setRouteStatus: (id: number, status: RouteStatus) => Promise<void>;
  setConsentGranted: (granted: boolean) => Promise<void>;
  resetDemo: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(() => clone(INITIAL_TASKS));
  const [routes, setRoutes] = useState<RouteRecord[]>(() => clone(INITIAL_ROUTES));
  const [routeStates, setRouteStates] =
    useState<Record<number, RouteStatus>>(() => ({ ...INITIAL_ROUTE_STATES }));
  const [consentGranted, setConsent] = useState(true);
  const [profile, setProfile] = useState<DemoUser>(DEMO_USER);
  const [todayDate, setTodayDate] = useState("2026-10-19");
  const [jobTargets, setJobTargets] = useState<JobTarget[]>([]);
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [wecomConnected, setWecomConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<RouteProgressState>({
    done: 0,
    percent: 0,
    total: 0,
  });

  const stats = useMemo(
    () => taskStats(tasks, Math.max(30, Math.round(profile.dailyMinutes * profile.capacityFactor))),
    [profile.capacityFactor, profile.dailyMinutes, tasks]
  );
  const localRouteDone = useMemo(() => routeDoneCount(tasks), [tasks]);
  const localRoutePercent = useMemo(() => routePercent(tasks), [tasks]);
  const routeDone = isLive ? liveProgress.done : localRouteDone;
  const routePercentValue = isLive ? liveProgress.percent : localRoutePercent;
  const routeTotal = isLive ? liveProgress.total : ROUTE_TOTAL_TASKS;

  const fetchToday = useCallback(async () => {
    const today = await live.today.get();
    const nextTasks = mapToday(today);
    setTasks(nextTasks);
    setTodayDate(today.date);
    return nextTasks;
  }, []);

  const fetchRoutes = useCallback(async () => {
    const [allRoutes, jobs] = await Promise.all([live.routes.list(), live.profile.jobs()]);
    const routeList = allRoutes.filter((route) => route.status !== "archived");
    const details = await Promise.all(routeList.map((route) => live.routes.get(route.id)));
    const mapped = mapRoutes(routeList, details, jobs, todayDate);
    const primary =
      mapped.find((route) => route.status === "active") ??
      mapped[0];
    const nextProgress: RouteProgressState = primary
      ? { done: primary.doneCount, percent: primary.progress, total: primary.taskCount }
      : { done: 0, percent: 0, total: 0 };

    setRoutes(mapped);
    setJobTargets(jobs);
    setStageNames(
      details
        .find((detail) => detail.id === primary?.apiId)
        ?.stages.map((stage) => stage.name.replace(/（.*$/, "").trim()) ?? []
    );
    setRouteStates(
      Object.fromEntries(mapped.map((route) => [route.id, route.status])) as Record<
        number,
        RouteStatus
      >
    );
    setLiveProgress(nextProgress);
    return { routes: mapped, progress: nextProgress };
  }, [todayDate]);

  const refreshLive = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const [today, profileData, jobs, consents] = await Promise.all([
        live.today.get(),
        live.profile.get(),
        live.profile.jobs(),
        live.profile.consents(),
      ]);
      const channels = await live.notifications.channels().catch(() => []);
      setWecomConnected(channels.some((channel) => channel.status === "active"));
      const routeList = (await live.routes.list()).filter((route) => route.status !== "archived");
      const details = await Promise.all(routeList.map((route) => live.routes.get(route.id)));

      const mappedRoutes = mapRoutes(routeList, details, jobs, today.date);
      const primary = mappedRoutes.find((route) => route.status === "active") ?? mappedRoutes[0];
      const nextProgress: RouteProgressState = primary
        ? { done: primary.doneCount, percent: primary.progress, total: primary.taskCount }
        : { done: 0, percent: 0, total: 0 };

      setTasks(mapToday(today));
      setTodayDate(today.date);
      setProfile(mapProfile(profileData, jobs));
      setJobTargets(jobs);
      setRoutes(mappedRoutes);
      setStageNames(
        details
          .find((detail) => detail.id === primary?.apiId)
          ?.stages.map((stage) => stage.name.replace(/（.*$/, "").trim()) ?? []
      );
      setRouteStates(
        Object.fromEntries(mappedRoutes.map((route) => [route.id, route.status])) as Record<
          number,
          RouteStatus
        >
      );
      setLiveProgress(nextProgress);
      setConsent(
        consents.some(
          (consent) =>
            consent.scope === "ai_import" && Boolean(consent.granted_at) && !consent.revoked_at
        )
      );
      setIsLive(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "无法连接后端";
      setError(message);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      void refreshLive();
    }
    if (authStatus === "anonymous") {
      setIsLive(false);
      setError(null);
    }
  }, [authStatus, refreshLive]);

  const refreshAfterAction = useCallback(async () => {
    const [nextTasks, routeResult] = await Promise.all([fetchToday(), fetchRoutes()]);
    return { tasks: nextTasks, routes: routeResult };
  }, [fetchRoutes, fetchToday]);

  const patchTask = useCallback(
    (id: string, patch: Partial<Task> | ((task: Task) => Partial<Task>)) => {
      setTasks((current) =>
        current.map((task) =>
          task.id === id
            ? { ...task, ...(typeof patch === "function" ? patch(task) : patch) }
            : task
        )
      );
    },
    []
  );

  const startTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return undefined;
      if (isLive && task.occurrenceId) {
        await live.today.action(task.occurrenceId, "start");
        await fetchToday();
      } else {
        patchTask(id, { status: "in_progress" });
      }
      return { ...task, status: "in_progress" as const };
    },
    [fetchToday, isLive, patchTask, tasks]
  );

  const completeTask = useCallback(
    async (id: string, actual: number, note: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return undefined;
      const beforePercent = routePercentValue;
      const nextActual = clamp(Number(actual) || task.planned, 0, 600);

      if (isLive && task.occurrenceId) {
        await live.today.action(task.occurrenceId, "complete", {
          actual_minutes: nextActual,
          note: note || undefined,
        });
        const result = await refreshAfterAction();
        const nextStats = taskStats(result.tasks);
        return {
          task,
          beforePercent,
          afterPercent: result.routes.progress.percent,
          allDone:
            nextStats.considered.length > 0 &&
            nextStats.completed.length === nextStats.considered.length,
        };
      }

      const nextTasks = tasks.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "completed" as const,
              actual: nextActual,
              note: note || item.note,
            }
          : item
      );
      const nextStats = taskStats(nextTasks);
      setTasks(nextTasks);
      return {
        task,
        beforePercent,
        afterPercent: routePercent(nextTasks),
        allDone:
          nextStats.considered.length > 0 &&
          nextStats.completed.length === nextStats.considered.length,
      };
    },
    [isLive, refreshAfterAction, routePercentValue, tasks]
  );

  const postponeTask = useCallback(
    async (id: string, reason: string) => {
      const task = tasks.find((item) => item.id === id);
      if (isLive && task?.occurrenceId) {
        await live.today.action(task.occurrenceId, "postpone");
        await fetchToday();
        return;
      }
      patchTask(id, {
        status: "postponed",
        postponedTo: "次日",
        postponeReason: reason,
      });
    },
    [fetchToday, isLive, patchTask, tasks]
  );

  const skipTask = useCallback(
    async (id: string, reason: string, note: string) => {
      const task = tasks.find((item) => item.id === id);
      if (isLive && task?.occurrenceId) {
        await live.today.action(task.occurrenceId, "skip", { reason });
        await fetchToday();
        return;
      }
      patchTask(id, (item) => ({
        status: "skipped",
        skipReason: reason,
        note: note || item.note,
      }));
    },
    [fetchToday, isLive, patchTask, tasks]
  );

  const blockTask = useCallback(
    async (id: string, reason: string) => {
      const task = tasks.find((item) => item.id === id);
      if (isLive && task?.occurrenceId) {
        await live.today.action(task.occurrenceId, "block", { reason });
        await fetchToday();
        return;
      }
      patchTask(id, { status: "blocked", blockReason: reason });
    },
    [fetchToday, isLive, patchTask, tasks]
  );

  const unblockTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (isLive && task?.occurrenceId) {
        await live.today.action(task.occurrenceId, "unblock");
        await fetchToday();
        return;
      }
      patchTask(id, { status: "pending", blockReason: undefined });
    },
    [fetchToday, isLive, patchTask, tasks]
  );

  const restoreTask = useCallback(
    async (id: string) => {
      if (isLive) return;
      patchTask(id, {
        status: "pending",
        skipReason: undefined,
        postponedTo: undefined,
      });
    },
    [isLive, patchTask]
  );

  const abandonTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (isLive && task?.occurrenceId) {
        await live.today.action(task.occurrenceId, "abandon");
        await refreshAfterAction();
        return;
      }
      patchTask(id, { status: "abandoned" });
    },
    [isLive, patchTask, refreshAfterAction, tasks]
  );

  const splitTask = useCallback(
    async (id: string, parts: SplitPart[]) => {
      const original = tasks.find((task) => task.id === id);
      if (!original) return;
      if (isLive && original.occurrenceId) {
        await live.today.action(original.occurrenceId, "split", {
          parts: clamp(parts.length, 2, 4),
        });
        await refreshAfterAction();
        return;
      }
      const now = Date.now();
      const children: Task[] = parts.map((part, index) => ({
        id: `t${now}${index}`,
        title: part.title,
        type: original.type,
        stage: original.stage,
        source: original.source,
        planned: clamp(part.minutes, 15, 120),
        actual: 0,
        status: "pending",
        carry: 0,
        why: `由「${original.title}」拆分；原任务已归档。`,
        output: original.output,
        acceptance: original.acceptance,
        note: "",
      }));
      setTasks((current) => [
        ...current.map((task) =>
          task.id === id ? { ...task, status: "abandoned" as const } : task
        ),
        ...children,
      ]);
    },
    [isLive, refreshAfterAction, tasks]
  );

  const addTask = useCallback(
    async (input: NewTaskInput) => {
      const task: Task = {
        id: `local${Date.now()}`,
        title: input.title,
        type: input.type,
        stage: "今日计划 · 手动添加",
        source: "手动",
        planned: clamp(input.planned, 15, 120),
        actual: 0,
        status: "pending",
        carry: 0,
        why: isLive
          ? "本地临时任务；后端当前没有直接补入已有每日计划的接口。"
          : "用户手动加入今日计划；会占用今日容量并进入执行统计。",
        output: input.output,
        acceptance: input.acceptance,
        note: "",
      };
      setTasks((current) => [...current, task]);
      return task;
    },
    [isLive]
  );

  const completeAll = useCallback(async () => {
    if (isLive) {
      for (const task of tasks) {
        if (task.occurrenceId && !["completed", "abandoned"].includes(task.status)) {
          await live.today.action(task.occurrenceId, "complete", {
            actual_minutes: task.planned,
          });
        }
      }
      await refreshAfterAction();
      return;
    }
    setTasks((current) =>
      current.map((task) =>
        task.status === "abandoned"
          ? task
          : { ...task, status: "completed" as const, actual: task.planned }
      )
    );
  }, [isLive, refreshAfterAction, tasks]);

  const clearToday = useCallback(async () => {
    if (isLive) return;
    setTasks([]);
  }, [isLive]);

  const setRouteStatus = useCallback(
    async (id: number, status: RouteStatus) => {
      const route = routes.find((item) => item.id === id);
      if (isLive && route?.apiId) {
        const action =
          status === "paused"
            ? "pause"
            : status === "archived"
              ? "archive"
              : route.status === "paused"
                ? "resume"
                : "activate";
        await live.routes.action(route.apiId, action);
        await fetchRoutes();
      }
      setRouteStates((current) => ({ ...current, [id]: status }));
    },
    [fetchRoutes, isLive, routes]
  );

  const setConsentGranted = useCallback(
    async (granted: boolean) => {
      setConsent(granted);
      if (isLive) {
        await live.profile.setConsent({ scope: "ai_import", version: "v1", granted });
      }
    },
    [isLive]
  );

  const resetDemo = useCallback(() => {
    setTasks(clone(INITIAL_TASKS));
    setRoutes(clone(INITIAL_ROUTES));
    setRouteStates({ ...INITIAL_ROUTE_STATES });
    setConsent(true);
    setIsLive(false);
    setLiveProgress({ done: 0, percent: 0, total: 0 });
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      tasks,
      routes,
      routeStates,
      consentGranted,
      profile,
      todayDate,
      jobTargets,
      stageNames,
      wecomConnected,
      live: isLive,
      loading,
      error,
      stats,
      routeDone,
      routePercent: routePercentValue,
      routeTotal,
      refreshLive,
      startTask,
      completeTask,
      postponeTask,
      skipTask,
      blockTask,
      unblockTask,
      restoreTask,
      abandonTask,
      splitTask,
      addTask,
      completeAll,
      clearToday,
      setRouteStatus,
      setConsentGranted,
      resetDemo,
    }),
    [
      tasks,
      routes,
      routeStates,
      consentGranted,
      profile,
      todayDate,
      jobTargets,
      stageNames,
      wecomConnected,
      isLive,
      loading,
      error,
      stats,
      routeDone,
      routePercentValue,
      routeTotal,
      refreshLive,
      startTask,
      completeTask,
      postponeTask,
      skipTask,
      blockTask,
      unblockTask,
      restoreTask,
      abandonTask,
      splitTask,
      addTask,
      completeAll,
      clearToday,
      setRouteStatus,
      setConsentGranted,
      resetDemo,
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return context;
}

export { ROUTE_TOTAL_TASKS };
