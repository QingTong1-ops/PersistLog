import { apiFetch, jsonBody, type ApiRequestInit } from "@/lib/api/client";

/* ------------------------------------------------------------------ */
/* Auth / profile                                                      */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  status: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}

export interface ProfileResponse {
  user: AuthUser;
  education: string | null;
  major: string | null;
  graduation_year: number | null;
  work_years: number | null;
  tech_stack: string[] | null;
  daily_available_minutes: number;
  planning_capacity_factor: number;
  day_boundary_time: string;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  bio: string | null;
}

export interface ProfileUpdate {
  display_name?: string;
  timezone?: string;
  education?: string;
  major?: string;
  graduation_year?: number;
  work_years?: number;
  tech_stack?: string[];
  daily_available_minutes?: number;
  planning_capacity_factor?: number;
  day_boundary_hour?: number;
  preferred_start_time?: string;
  preferred_end_time?: string;
  bio?: string;
}

export interface JobTarget {
  id: string;
  title: string;
  city: string | null;
  industry: string | null;
  company_type: string | null;
  target_date: string | null;
  priority: "P0" | "P1" | "P2";
  is_primary: boolean;
  status: string;
  created_at: string;
}

export interface JobTargetCreate {
  title: string;
  city?: string;
  industry?: string;
  company_type?: string;
  target_date?: string;
  priority?: "P0" | "P1" | "P2";
  is_primary?: boolean;
}

export interface Consent {
  scope: "ai_import" | "privacy_policy";
  version: string;
  granted_at: string | null;
  revoked_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

export type ApiOccurrenceStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "postponed"
  | "skipped"
  | "blocked"
  | "abandoned";

export interface TodayItem {
  id: string;
  task_id: string;
  occurrence_date: string;
  status: ApiOccurrenceStatus;
  planned_minutes: number;
  actual_minutes: number | null;
  remaining_minutes: number;
  carry_over_from_id: string | null;
  postpone_count: number;
  skip_reason: string | null;
  block_reason: string | null;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  split_index: number;
  parent_occurrence_id: string | null;
  title: string;
  task_type: string;
  stage_name: string | null;
  week_focus: string | null;
  source_type: string;
  why: string;
  is_optional: boolean;
  carry_over: boolean;
}

export interface TodayResponse {
  plan_id: string;
  date: string;
  timezone: string;
  capacity_minutes: number;
  summary: {
    planned_tasks: number;
    completed_tasks: number;
    planned_minutes: number;
    actual_minutes: number;
    completion_rate: number;
  };
  items: TodayItem[];
  carry_over: TodayItem[];
}

export interface OccurrenceOut {
  id: string;
  task_id: string;
  occurrence_date: string;
  status: ApiOccurrenceStatus;
  planned_minutes: number;
  actual_minutes: number | null;
  remaining_minutes: number;
  carry_over_from_id: string | null;
  postpone_count: number;
  skip_reason: string | null;
  block_reason: string | null;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  split_index: number;
  parent_occurrence_id: string | null;
}

export interface TodayItemCreate {
  task_id?: string;
  title?: string;
  estimated_minutes?: number;
  task_type?: string;
  priority?: "P0" | "P1" | "P2";
  note?: string;
}

export type OccurrenceAction =
  | "start"
  | "complete"
  | "postpone"
  | "skip"
  | "block"
  | "unblock"
  | "abandon"
  | "split";

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface RouteProgress {
  total_tasks: number;
  completed_tasks: number;
  percent: number;
}

export interface TaskOut {
  id: string;
  title: string;
  description: string;
  learning_objective: string;
  task_type: string;
  priority: "P0" | "P1" | "P2";
  difficulty: string | null;
  estimated_minutes: number;
  planned_date: string | null;
  due_date: string | null;
  deliverable: string;
  acceptance_criteria: string;
  resources: unknown[];
  capability_tags: string[];
  needs_review: boolean;
  is_splittable: boolean;
  source_type: string;
  source_id: string | null;
  status: string;
  created_at: string;
}

export interface WeekOut {
  id: string;
  week_no: number;
  focus: string | null;
  milestone: string | null;
  start_date: string | null;
  end_date: string | null;
  progress?: RouteProgress | null;
  tasks: TaskOut[];
}

export interface StageOut {
  id: string;
  name: string;
  objective: string | null;
  order_no: number;
  start_date: string | null;
  end_date: string | null;
  weight: number;
  exit_criteria: string | null;
  progress?: RouteProgress | null;
  weeks: WeekOut[];
}

export interface RouteListItem {
  id: string;
  job_target_id: string | null;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  forecast_end_date: string;
  daily_capacity_minutes: number;
  current_version: number;
  created_at: string;
  progress?: RouteProgress;
}

export interface RouteDetail extends RouteListItem {
  description: string | null;
  source_type: string;
  progress: RouteProgress;
  stages: StageOut[];
}

export interface RouteForecast {
  route_id: string;
  target_date: string | null;
  forecast_end_date: string;
  remaining_minutes: number;
  throughput_minutes: number;
  forecast_days: number;
  risk?: string;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardOverview {
  start_date: string;
  end_date: string;
  timezone: string;
  planned_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  planned_minutes: number;
  actual_minutes: number;
  carry_over_count: number;
  carry_over_rate: number;
  active_routes: number;
  route_progress: RouteProgress;
}

export interface TrendPoint {
  date: string;
  planned_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  planned_minutes: number;
  actual_minutes: number;
  carry_over_count: number;
}

export interface TrendResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  points: TrendPoint[];
}

export interface DistributionBucket {
  key: string;
  label: string;
  planned_tasks: number;
  completed_tasks: number;
  planned_minutes: number;
  actual_minutes: number;
}

export interface DistributionResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  by_task_type: DistributionBucket[];
  by_route: DistributionBucket[];
  by_status: DistributionBucket[];
  by_priority: DistributionBucket[];
}

export interface ForecastRoute {
  route_id: string;
  title: string;
  target_date: string | null;
  forecast_end_date: string;
  remaining_minutes: number;
  risk?: string;
}

export interface DashboardForecast {
  generated_at: string;
  timezone: string;
  throughput_minutes: number;
  remaining_minutes: number;
  forecast_days: number;
  forecast_end_date: string;
  routes: ForecastRoute[];
}

/* ------------------------------------------------------------------ */
/* Imports / jobs                                                      */
/* ------------------------------------------------------------------ */

export interface JobOut {
  id: string;
  job_type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  result_ref: string | null;
  error: { code?: string; message?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ImportCreated {
  import_id: string;
  job_id: string;
  status: string;
}

export interface ImportIssue {
  severity: string;
  code: string;
  message: string;
  suggestion: string | null;
  source_locator: string | null;
}

export interface ImportPreview {
  import_id: string;
  status: string;
  route: Record<string, unknown> | null;
  assumptions: string[];
  warnings: string[];
  stats: Record<string, number>;
  issues: ImportIssue[];
  updated_at?: string;
  format?: string;
  file_name?: string | null;
  route_id?: string | null;
  created_at?: string;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationChannel {
  id: string;
  channel_type: string;
  name: string;
  webhook_masked: string;
  status: string;
  quiet_hours: { start: string; end: string } | null;
  last_test_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  event_type: string;
  channel_id: string;
  enabled: boolean;
  send_time: string | null;
  timezone: string;
  quiet_hours_behavior: string;
}

export interface OutboxItem {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const live = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: jsonBody({ email, password }),
        skipAuth: true,
        skipRefresh: true,
      }),
    register: (body: { email: string; password: string; display_name?: string; timezone?: string }) =>
      apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: jsonBody(body),
        skipAuth: true,
        skipRefresh: true,
      }),
    me: () => apiFetch<AuthUser>("/auth/me"),
    logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  },
  profile: {
    get: () => apiFetch<ProfileResponse>("/profile"),
    update: (body: ProfileUpdate) =>
      apiFetch<ProfileResponse>("/profile", { method: "PUT", body: jsonBody(body) }),
    settings: () => apiFetch<Record<string, unknown>>("/settings"),
    jobs: (includeArchived = false) =>
      apiFetch<JobTarget[]>(`/job-targets?include_archived=${includeArchived}`),
    createJob: (body: JobTargetCreate) =>
      apiFetch<JobTarget>("/job-targets", { method: "POST", body: jsonBody(body) }),
    updateJob: (id: string, body: Partial<JobTargetCreate> & { status?: string }) =>
      apiFetch<JobTarget>(`/job-targets/${id}`, { method: "PATCH", body: jsonBody(body) }),
    consents: () => apiFetch<Consent[]>("/consents"),
    setConsent: (body: { scope: "ai_import" | "privacy_policy"; version: string; granted: boolean }) =>
      apiFetch<Consent>("/consents", { method: "PUT", body: jsonBody(body) }),
  },
  today: {
    get: (date?: string) => apiFetch<TodayResponse>(`/today${date ? `?date=${date}` : ""}`),
    generate: (date?: string) =>
      apiFetch<TodayResponse>(`/today/generate${date ? `?date=${date}` : ""}`, { method: "POST" }),
    addItem: (body: TodayItemCreate, date?: string) =>
      apiFetch<TodayResponse>(`/today/items${date ? `?date=${date}` : ""}`, {
        method: "POST",
        body: jsonBody(body),
      }),
    action: (
      occurrenceId: string,
      action: OccurrenceAction,
      body?: Record<string, unknown>
    ) =>
      apiFetch<OccurrenceOut | OccurrenceOut[]>(`/task-occurrences/${occurrenceId}/${action}`, {
        method: "POST",
        body: body ? jsonBody(body) : undefined,
      }),
  },
  routes: {
    list: (status?: string) =>
      apiFetch<RouteListItem[]>(`/routes${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    get: (id: string) => apiFetch<RouteDetail>(`/routes/${id}`),
    create: (body: Record<string, unknown>) =>
      apiFetch<RouteDetail>("/routes", { method: "POST", body: jsonBody(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      apiFetch<RouteDetail>(`/routes/${id}`, { method: "PATCH", body: jsonBody(body) }),
    action: (id: string, action: "activate" | "pause" | "resume" | "archive") =>
      apiFetch<RouteDetail>(`/routes/${id}/${action}`, { method: "POST" }),
    adjust: (id: string, body: Record<string, unknown>) =>
      apiFetch<RouteDetail>(`/routes/${id}/adjust`, { method: "POST", body: jsonBody(body) }),
    forecast: (id: string) => apiFetch<RouteForecast>(`/routes/${id}/forecast`),
    versions: (id: string) => apiFetch<unknown[]>(`/routes/${id}/versions`),
    createStage: (id: string, body: Record<string, unknown>) =>
      apiFetch<StageOut>(`/routes/${id}/stages`, { method: "POST", body: jsonBody(body) }),
    createWeek: (stageId: string, body: Record<string, unknown>) =>
      apiFetch<WeekOut>(`/stages/${stageId}/weeks`, { method: "POST", body: jsonBody(body) }),
    createTask: (body: Record<string, unknown>) =>
      apiFetch<TaskOut>("/tasks", { method: "POST", body: jsonBody(body) }),
    updateTask: (id: string, body: Record<string, unknown>) =>
      apiFetch<TaskOut>(`/tasks/${id}`, { method: "PATCH", body: jsonBody(body) }),
  },
  dashboard: {
    overview: (days: number) => apiFetch<DashboardOverview>(`/dashboard/overview?days=${days}`),
    trends: (days: number) => apiFetch<TrendResponse>(`/dashboard/trends?days=${days}`),
    distribution: (days: number) =>
      apiFetch<DistributionResponse>(`/dashboard/distribution?days=${days}`),
    forecast: () => apiFetch<DashboardForecast>("/dashboard/forecast"),
  },
  imports: {
    create: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch<ImportCreated>("/imports", { method: "POST", body });
    },
    list: () => apiFetch<ImportPreview[]>("/imports"),
    get: (id: string) => apiFetch<ImportPreview>(`/imports/${id}`),
    preview: (id: string) => apiFetch<ImportPreview>(`/imports/${id}/preview`),
    updatePreview: (id: string, route: Record<string, unknown>) =>
      apiFetch<ImportPreview>(`/imports/${id}/preview`, {
        method: "PATCH",
        body: jsonBody({ route }),
      }),
    confirm: (id: string) =>
      apiFetch<{ route_id: string; status: string; created_tasks: number }>(
        `/imports/${id}/confirm`,
        { method: "POST" }
      ),
    cancel: (id: string) =>
      apiFetch<ImportPreview>(`/imports/${id}/cancel`, { method: "POST" }),
    rollback: (id: string) =>
      apiFetch<ImportPreview>(`/imports/${id}/rollback`, { method: "POST" }),
    job: (id: string) => apiFetch<JobOut>(`/jobs/${id}`),
  },
  notifications: {
    channels: () => apiFetch<NotificationChannel[]>("/notification-channels"),
    createChannel: (body: { name: string; webhook_url: string; quiet_hours?: { start: string; end: string } }) =>
      apiFetch<NotificationChannel>("/notification-channels", {
        method: "POST",
        body: jsonBody(body),
      }),
    updateChannel: (
      id: string,
      body: { name?: string; webhook_url?: string; quiet_hours?: { start: string; end: string } }
    ) =>
      apiFetch<NotificationChannel>(`/notification-channels/${id}`, {
        method: "PATCH",
        body: jsonBody(body),
      }),
    deleteChannel: (id: string) =>
      apiFetch<void>(`/notification-channels/${id}`, { method: "DELETE" }),
    preferences: () => apiFetch<NotificationPreference[]>("/notification-preferences"),
    updatePreferences: (items: Array<Record<string, unknown>>) =>
      apiFetch<NotificationPreference[]>("/notification-preferences", {
        method: "PUT",
        body: jsonBody({ items }),
      }),
    templates: () => apiFetch<unknown[]>("/notification-templates"),
    outbox: (status?: string) =>
      apiFetch<OutboxItem[]>(`/notification-outbox?limit=20${status ? `&status=${status}` : ""}`),
    test: (id: string) =>
      apiFetch<unknown>(`/notification-channels/${id}/test`, { method: "POST" }),
    resend: (id: string) =>
      apiFetch<unknown>(`/notification-outbox/${id}/resend`, { method: "POST" }),
  },
};

export type { ApiRequestInit };
