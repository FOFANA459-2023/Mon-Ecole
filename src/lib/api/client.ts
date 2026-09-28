export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";

export type ApiErrorBody = { code: string; message: string; fields: Record<string, string[]> };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
  }
}

type SessionState = {
  accessToken: string | null;
  schoolId: number | null;
  onSessionExpired: (() => void) | null;
};

const state: SessionState = { accessToken: null, schoolId: null, onSessionExpired: null };

/** In-memory session: the access token never touches localStorage. */
export const session = {
  getAccessToken: () => state.accessToken,
  setAccessToken: (token: string | null) => {
    state.accessToken = token;
  },
  getSchoolId: () => state.schoolId,
  setSchoolId: (id: number | null) => {
    state.schoolId = id;
  },
  onSessionExpired: (callback: (() => void) | null) => {
    state.onSessionExpired = callback;
  },
  clear: () => {
    state.accessToken = null;
    state.schoolId = null;
  },
};

let refreshing: Promise<string | null> | null = null;

/** Exchange the HttpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        state.accessToken = null;
        return null;
      }
      const data = (await res.json()) as { access: string };
      state.accessToken = data.access;
      return data.access;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Set to false for endpoints that must not trigger a token refresh (login, logout). */
  auth?: boolean;
};

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function buildHeaders(body: unknown): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  if (state.schoolId !== null) headers["X-School-ID"] = String(state.schoolId);
  return headers;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as Partial<ApiErrorBody>;
    if (data && typeof data.code === "string") {
      return new ApiError(res.status, {
        code: data.code,
        message: data.message ?? res.statusText,
        fields: data.fields ?? {},
      });
    }
  } catch {
    // Not JSON (e.g. a proxy error page).
  }
  return new ApiError(res.status, { code: `http_${res.status}`, message: res.statusText, fields: {} });
}

/** Send a request with the session headers, refreshing the access token once on 401. */
async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, query, signal, auth = true } = options;
  const url = buildUrl(path, query);
  const attempt = () =>
    fetch(url, {
      method,
      headers: buildHeaders(body),
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      credentials: "include",
      signal,
    });

  let res: Response;
  try {
    res = await attempt();
    if (res.status === 401 && auth) {
      const token = await refreshAccessToken();
      if (token) {
        res = await attempt();
      } else {
        state.onSessionExpired?.();
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, { code: "network_error", message: "Network error", fields: {} });
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch a file (PDF, spreadsheet…) with the user's session; returns the blob and the server's filename. */
export async function apiFile(path: string, query?: Query): Promise<{ blob: Blob; filename: string | null }> {
  const res = await send(path, { query });
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await res.blob(), filename: match ? match[1] : null };
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => apiRequest<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
