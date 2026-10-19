export type TaskType = "算法" | "八股" | "工程" | "项目" | "复盘" | "简历" | "面试";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "postponed"
  | "skipped"
  | "blocked"
  | "abandoned";

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  stage: string;
  source: string;
  planned: number;
  actual: number;
  status: TaskStatus;
  carry: number;
  why: string;
  output: string;
  acceptance: string;
  note: string;
  blockReason?: string;
  skipReason?: string;
  postponeReason?: string;
  postponedTo?: string;
}

export type RouteStatus = "active" | "paused" | "draft" | "archived";

export interface RouteRecord {
  id: number;
  name: string;
  job: string;
  status: RouteStatus;
  days: number;
  taskCount: number;
  doneCount: number;
  plannedMinutes: number;
  forecast: string;
  targetDate: string;
  progress: number;
  currentStage: string;
  day: number;
  startDate: string;
}

export interface DashboardDay {
  label: string;
  plan: number;
  done: number;
  carry: number;
}

export interface DashboardDataset {
  planned: number;
  completed: number;
  carry: number;
  active: number;
  periodActive: number;
  planMinutes: number;
  actualMinutes: number;
  status: {
    completed: number;
    carry: number;
    skipped: number;
    blocked: number;
  };
  types: Array<{ label: string; count: number }>;
  days: DashboardDay[];
}

export interface PreviewTask {
  id: number;
  title: string;
  type: TaskType;
  minutes: number;
  output: string;
  acceptance: string;
}

export interface DemoUser {
  name: string;
  initial: string;
  email: string;
  goal: string;
  targetDate: string;
  timezone: string;
  dailyMinutes: number;
  capacityFactor: number;
}

export interface NewTaskInput {
  title: string;
  type: TaskType;
  planned: number;
  output: string;
  acceptance: string;
}

export interface SplitPart {
  title: string;
  minutes: number;
}
