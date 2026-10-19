"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_ROUTE_STATES,
  INITIAL_TASKS,
  ROUTE_TOTAL_TASKS,
} from "@/lib/mock-data";
import type {
  NewTaskInput,
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

interface AppStoreValue {
  tasks: Task[];
  routeStates: Record<number, RouteStatus>;
  consentGranted: boolean;
  stats: ReturnType<typeof taskStats>;
  routeDone: number;
  routePercent: number;
  startTask: (id: string) => Task | undefined;
  completeTask: (id: string, actual: number, note: string) => TaskActionResult | undefined;
  postponeTask: (id: string, reason: string) => void;
  skipTask: (id: string, reason: string, note: string) => void;
  blockTask: (id: string, reason: string) => void;
  unblockTask: (id: string) => void;
  restoreTask: (id: string) => void;
  abandonTask: (id: string) => void;
  splitTask: (id: string, parts: SplitPart[]) => void;
  addTask: (input: NewTaskInput) => Task;
  completeAll: () => void;
  clearToday: () => void;
  setRouteStatus: (id: number, status: RouteStatus) => void;
  setConsentGranted: (granted: boolean) => void;
  resetDemo: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => clone(INITIAL_TASKS));
  const [routeStates, setRouteStates] =
    useState<Record<number, RouteStatus>>(() => ({ ...INITIAL_ROUTE_STATES }));
  const [consentGranted, setConsentGranted] = useState(true);

  const stats = useMemo(() => taskStats(tasks), [tasks]);
  const routeDone = useMemo(() => routeDoneCount(tasks), [tasks]);
  const routeProgress = useMemo(() => routePercent(tasks), [tasks]);

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
    (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return undefined;
      patchTask(id, { status: "in_progress" });
      return { ...task, status: "in_progress" as const };
    },
    [patchTask, tasks]
  );

  const completeTask = useCallback(
    (id: string, actual: number, note: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return undefined;
      const beforePercent = routePercent(tasks);
      const nextTasks = tasks.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "completed" as const,
              actual: clamp(Number(actual) || item.planned, 0, 600),
              note: note || item.note,
            }
          : item
      );
      const nextStats = taskStats(nextTasks);
      const allDone =
        nextStats.considered.length > 0 &&
        nextStats.completed.length === nextStats.considered.length;
      setTasks(nextTasks);
      return {
        task,
        beforePercent,
        afterPercent: routePercent(nextTasks),
        allDone,
      };
    },
    [tasks]
  );

  const postponeTask = useCallback(
    (id: string, reason: string) => {
      patchTask(id, {
        status: "postponed",
        postponedTo: "10/20",
        postponeReason: reason,
      });
    },
    [patchTask]
  );

  const skipTask = useCallback(
    (id: string, reason: string, note: string) => {
      patchTask(id, (task) => ({
        status: "skipped",
        skipReason: reason,
        note: note || task.note,
      }));
    },
    [patchTask]
  );

  const blockTask = useCallback(
    (id: string, reason: string) => {
      patchTask(id, { status: "blocked", blockReason: reason });
    },
    [patchTask]
  );

  const unblockTask = useCallback(
    (id: string) => {
      patchTask(id, { status: "pending", blockReason: undefined });
    },
    [patchTask]
  );

  const restoreTask = useCallback(
    (id: string) => {
      patchTask(id, {
        status: "pending",
        skipReason: undefined,
        postponedTo: undefined,
      });
    },
    [patchTask]
  );

  const abandonTask = useCallback(
    (id: string) => {
      patchTask(id, { status: "abandoned" });
    },
    [patchTask]
  );

  const splitTask = useCallback(
    (id: string, parts: SplitPart[]) => {
      const original = tasks.find((task) => task.id === id);
      if (!original) return;
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
    [tasks]
  );

  const addTask = useCallback((input: NewTaskInput) => {
    const task: Task = {
      id: `t${Date.now()}`,
      title: input.title,
      type: input.type,
      stage: "今日计划 · 手动添加",
      source: "手动",
      planned: clamp(input.planned, 15, 120),
      actual: 0,
      status: "pending",
      carry: 0,
      why: "用户手动加入今日计划；会占用今日容量并进入执行统计。",
      output: input.output,
      acceptance: input.acceptance,
      note: "",
    };
    setTasks((current) => [...current, task]);
    return task;
  }, []);

  const completeAll = useCallback(() => {
    setTasks((current) =>
      current.map((task) =>
        task.status === "abandoned"
          ? task
          : { ...task, status: "completed" as const, actual: task.planned }
      )
    );
  }, []);

  const clearToday = useCallback(() => {
    setTasks([]);
  }, []);

  const setRouteStatus = useCallback((id: number, status: RouteStatus) => {
    setRouteStates((current) => ({ ...current, [id]: status }));
  }, []);

  const resetDemo = useCallback(() => {
    setTasks(clone(INITIAL_TASKS));
    setRouteStates({ ...INITIAL_ROUTE_STATES });
    setConsentGranted(true);
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      tasks,
      routeStates,
      consentGranted,
      stats,
      routeDone,
      routePercent: routeProgress,
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
      routeStates,
      consentGranted,
      stats,
      routeDone,
      routeProgress,
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
