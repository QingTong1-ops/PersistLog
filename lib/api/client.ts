const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: unknown; requestId?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "UNKNOWN_ERROR";
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string;
  };
  code?: string;
  message?: string;
  detail?: unknown;
  request_id?: string;
}

export interface ApiRequestInit extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearSession() {
  accessToken = null;
}

/**
 * Refresh the access token using the HttpOnly refresh cookie.
 *
 * Single-flight: concurrent 401s share one rotation, otherwise the old refresh
 * token can be treated as a replay and the session is lost.
 */
export function refreshSession(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      accessToken = null;
      return null;
    }

    const payload = (await response.json()) as { access_token?: string };
    accessToken = payload.access_token ?? null;
    return accessToken;
  })()
    .catch(() => {
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function readError(response: Response): Promise<ApiError> {
  let payload: ApiErrorEnvelope | undefined;
  try {
    payload = (await response.json()) as ApiErrorEnvelope;
  } catch {
    payload = undefined;
  }

  const nested = payload?.error;
  const message =
    nested?.message ??
    payload?.message ??
    (typeof payload?.detail === "string" ? payload.detail : undefined) ??
    `请求失败（${response.status}）`;

  return new ApiError(message, {
    status: response.status,
    code: nested?.code ?? payload?.code ?? `HTTP_${response.status}`,
    details: nested?.details ?? payload?.detail ?? undefined,
    requestId:
      nested?.request_id ??
      payload?.request_id ??
      response.headers.get("X-Request-ID") ??
      undefined,
  });
}

function isFormData(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { skipAuth, skipRefresh, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (requestInit.body && !isFormData(requestInit.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!skipAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const canRefresh =
    response.status === 401 &&
    !skipRefresh &&
    !skipAuth &&
    !path.startsWith("/auth/");

  if (canRefresh) {
    const token = await refreshSession();
    if (!token) {
      unauthorizedHandler?.();
      throw await readError(response);
    }
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      accessToken = null;
      unauthorizedHandler?.();
    }
    throw await readError(response);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export { API_BASE_URL };
