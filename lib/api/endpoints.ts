import type { DashboardDataset, RouteRecord, Task } from "@/lib/types";
import { apiFetch, jsonBody } from "@/lib/api/client";

/**
 * API 端点映射。
 *
 * 当前页面使用 lib/mock-data.ts 的演示数据；接入后端时，把页面/Store 的
 * 数据源替换为这里的端点即可。端点路径与 docs/openapi.json 保持一致。
 */

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

export interface TodayResponse {
  date: string;
  daily_plan_id: number | null;
  effective_minutes: number;
  planned_minutes: number;
  actual_minutes: number;
  completion_rate: number;
  tasks: Task[];
  carry_over: Task[];
}

export interface DashboardOverviewResponse {
  period: { start: string; end: string };
  planned: number;
  completed: number;
  completion_rate: number;
  planned_minutes: number;
  actual_minutes: number;
  carry_count: number;
  carry_rate: number;
  active_days: number;
  cumulative_active_days: number;
  route_progress: number;
}

export interface ImportResponse {
  import_id: number;
  status: string;
  job_id?: string;
}

export interface JobResponse {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  error?: { code: string; message: string };
  result_ref?: string;
}

export const api = {
  auth: {
    login: (body: { account: string; password: string }) =>
      apiFetch<AuthResponse>("/auth/login", { method: "POST", body: jsonBody(body) }),
    register: (body: { account: string; password: string; name?: string }) =>
      apiFetch<AuthResponse>("/auth/register", { method: "POST", body: jsonBody(body) }),
    me: () => apiFetch<AuthResponse["user"]>("/auth/me"),
    refresh: () => apiFetch<void>("/auth/refresh", { method: "POST" }),
    logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  },
  today: {
    get: () => apiFetch<TodayResponse>("/today"),
    generate: () => apiFetch<TodayResponse>("/today/generate", { method: "POST" }),
    action: (
      occurrenceId: number,
      action: "start" | "complete" | "postpone" | "skip" | "block" | "unblock" | "abandon" | "split",
      body?: Record<string, unknown>
    ) =>
      apiFetch<Task>(`/task-occurrences/${occurrenceId}/${action}`, {
        method: "POST",
        body: body ? jsonBody(body) : undefined,
      }),
  },
  imports: {
    create: (body: { file_name: string; content: string }) =>
      apiFetch<ImportResponse>("/imports", { method: "POST", body: jsonBody(body) }),
    get: (id: number) => apiFetch<ImportResponse>(`/imports/${id}`),
    preview: (id: number) => apiFetch<unknown>(`/imports/${id}/preview`),
    confirm: (id: number) => apiFetch<ImportResponse>(`/imports/${id}/confirm`, { method: "POST" }),
    cancel: (id: number) => apiFetch<ImportResponse>(`/imports/${id}/cancel`, { method: "POST" }),
    rollback: (id: number) => apiFetch<ImportResponse>(`/imports/${id}/rollback`, { method: "POST" }),
    job: (id: string) => apiFetch<JobResponse>(`/jobs/${id}`),
  },
  routes: {
    list: () => apiFetch<RouteRecord[]>("/routes"),
    get: (id: number) => apiFetch<RouteRecord>(`/routes/${id}`),
    create: (body: Record<string, unknown>) =>
      apiFetch<RouteRecord>("/routes", { method: "POST", body: jsonBody(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      apiFetch<RouteRecord>(`/routes/${id}`, { method: "PATCH", body: jsonBody(body) }),
    action: (id: number, action: "activate" | "pause" | "resume" | "archive") =>
      apiFetch<RouteRecord>(`/routes/${id}/${action}`, { method: "POST" }),
    adjust: (id: number, body: Record<string, unknown>) =>
      apiFetch<RouteRecord>(`/routes/${id}/adjust`, { method: "POST", body: jsonBody(body) }),
    forecast: (id: number) => apiFetch<unknown>(`/routes/${id}/forecast`),
    versions: (id: number) => apiFetch<unknown[]>(`/routes/${id}/versions`),
  },
  dashboard: {
    overview: (params?: { start?: string; end?: string }) =>
      apiFetch<DashboardOverviewResponse>(`/dashboard/overview${query(params)}`),
    trends: (params?: { start?: string; end?: string; granularity?: "day" | "week" }) =>
      apiFetch<{ days: DashboardDataset["days"] }>(`/dashboard/trends${query(params)}`),
    distribution: (params?: { start?: string; end?: string }) =>
      apiFetch<{ types: DashboardDataset["types"]; status: DashboardDataset["status"] }>(
        `/dashboard/distribution${query(params)}`
      ),
    forecast: () => apiFetch<unknown>("/dashboard/forecast"),
  },
  settings: {
    profile: () => apiFetch<unknown>("/profile"),
    updateProfile: (body: Record<string, unknown>) =>
      apiFetch<unknown>("/profile", { method: "PATCH", body: jsonBody(body) }),
    settings: () => apiFetch<unknown>("/settings"),
    updateSettings: (body: Record<string, unknown>) =>
      apiFetch<unknown>("/settings", { method: "PATCH", body: jsonBody(body) }),
    jobTargets: () => apiFetch<unknown[]>("/job-targets"),
    consents: () => apiFetch<unknown[]>("/consents"),
    grantConsent: (body: { scope: string; version: string }) =>
      apiFetch<unknown>("/consents", { method: "POST", body: jsonBody(body) }),
    channels: () => apiFetch<unknown[]>("/notification-channels"),
    testChannel: (id: number) =>
      apiFetch<unknown>(`/notification-channels/${id}/test`, { method: "POST" }),
    preferences: () => apiFetch<unknown>("/notification-preferences"),
    updatePreferences: (body: Record<string, unknown>) =>
      apiFetch<unknown>("/notification-preferences", { method: "PATCH", body: jsonBody(body) }),
    outbox: () => apiFetch<unknown[]>("/notification-outbox"),
    auditLogs: () => apiFetch<unknown[]>("/audit-logs"),
  },
};

function query(params?: Record<string, string | undefined>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const result = search.toString();
  return result ? `?${result}` : "";
}
