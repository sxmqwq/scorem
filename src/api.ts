import { reactive, ref } from "vue";
export interface User {
  id: string;
  username: string;
  nickname: string;
  status: "pending" | "approved" | "rejected" | "disabled";
  role: "member" | "admin";
  application: string;
  review_reason: string;
  created_at: string;
}
export type Item = Record<string, any>;
export interface Page {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  ratingsDirty?: boolean;
}
export const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const tokenKey = "scorem.session.v2:" + apiBase;
const legacyKey = "scorem.session.v1";
interface StoredSession {
  token: string;
  expiresAt: number;
}
const defaultExpiry = () => Math.floor(Date.now() / 1000) + 7 * 86400;
function decodeSession(raw: string | null): StoredSession | null {
  try {
    const value = JSON.parse(raw || "null");
    if (
      /^[0-9a-f]{64}$/.test(value?.token) &&
      Number.isFinite(value.expiresAt) &&
      value.expiresAt > Date.now() / 1000
    )
      return { token: value.token, expiresAt: value.expiresAt };
  } catch {
    /* Invalid or expired records are not restored. */
  }
  return null;
}
function storeSession(value: StoredSession | null) {
  let persisted = false;
  try {
    if (value) localStorage.setItem(tokenKey, JSON.stringify(value));
    else localStorage.removeItem(tokenKey);
    persisted = true;
  } catch {
    /* Fall back to tab storage when persistent storage is unavailable. */
  }
  try {
    sessionStorage.removeItem(legacyKey);
    if (value && !persisted)
      sessionStorage.setItem(tokenKey, JSON.stringify(value));
    else sessionStorage.removeItem(tokenKey);
  } catch {
    /* In-memory sessions remain usable. */
  }
}
function restoreSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(tokenKey);
    if (raw !== null) {
      const value = decodeSession(raw);
      if (!value) storeSession(null);
      return value;
    }
  } catch {
    /* Tab storage can still work when persistent storage is blocked. */
  }
  try {
    const raw = sessionStorage.getItem(tokenKey);
    if (raw !== null) {
      const value = decodeSession(raw);
      storeSession(value);
      return value;
    }
    const legacy = sessionStorage.getItem(legacyKey);
    if (legacy && /^[0-9a-f]{64}$/.test(legacy)) {
      const value = { token: legacy, expiresAt: defaultExpiry() };
      storeSession(value);
      return value;
    }
  } catch {
    /* Start without a restored session if browser storage is unavailable. */
  }
  return null;
}
const restored = restoreSession();
export const auth = reactive({
  user: null as User | null,
  token: restored?.token || "",
  expiresAt: restored?.expiresAt || 0,
  ready: !restored,
});
let sessionVersion = 0;
const currentSession = (token: string, version: number) =>
  auth.token === token && sessionVersion === version;
export function setSession(
  user: User | null,
  token = "",
  expiresAt = defaultExpiry(),
) {
  const value = user && token ? { token, expiresAt } : null;
  sessionVersion++;
  auth.user = value ? user : null;
  auth.token = value?.token || "";
  auth.expiresAt = value?.expiresAt || 0;
  auth.ready = true;
  storeSession(value);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit & { json?: unknown; anonymous?: boolean } = {},
): Promise<T> {
  if (!apiBase)
    throw new ApiError(
      "站点暂时无法连接服务，请联系管理员完成配置。",
      "configuration",
      503,
    );
  if (auth.token && auth.expiresAt <= Date.now() / 1000) setSession(null);
  const { json, anonymous, ...requestOptions } = options;
  const token = anonymous ? "" : auth.token,
    version = sessionVersion;
  const headers = new Headers(requestOptions.headers);
  if (anonymous) headers.delete("Authorization");
  else if (token) headers.set("Authorization", "Bearer " + token);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiBase + path, {
      ...requestOptions,
      headers,
      body: json !== undefined ? JSON.stringify(json) : requestOptions.body,
      signal: requestOptions.signal || controller.signal,
      credentials: "omit",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (
        token &&
        currentSession(token, version) &&
        response.status === 401 &&
        data.error?.code === "unauthorized"
      )
        setSession(null);
      throw new ApiError(
        data.error?.message || `请求失败 (${response.status})`,
        data.error?.code || "http_error",
        response.status,
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("暂时无法连接服务，请稍后重试。", "network", 0);
  } finally {
    clearTimeout(timeout);
  }
}
let refreshing: {
  token: string;
  version: number;
  promise: Promise<User | null>;
} | null = null;
export function refreshUser(): Promise<User | null> {
  const token = auth.token,
    version = sessionVersion;
  if (!token) {
    auth.ready = true;
    return Promise.resolve(null);
  }
  if (refreshing?.token === token && refreshing.version === version)
    return refreshing.promise;
  if (!auth.user) auth.ready = false;
  const result: Promise<User | null> = api<{ user: User | null }>(
    "/api/auth/me",
  )
    .then((r) => {
      if (!currentSession(token, version)) return auth.user;
      if (r?.user === null) {
        setSession(null);
        return null;
      }
      if (!r?.user || typeof r.user.id !== "string")
        throw new ApiError(
          "服务返回的登录状态不完整，请重试。",
          "invalid_response",
          502,
        );
      auth.user = r.user;
      return r.user;
    })
    .finally(() => {
      if (currentSession(token, version)) auth.ready = true;
      if (refreshing?.promise === result) refreshing = null;
    });
  refreshing = { token, version, promise: result };
  return result;
}
export async function logout() {
  const token = auth.token,
    version = sessionVersion;
  try {
    if (token) await api("/api/auth/logout", { method: "POST", json: {} });
  } finally {
    if (currentSession(token, version)) setSession(null);
  }
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== tokenKey && event.key !== null) return;
    let value: StoredSession | null;
    try {
      value = decodeSession(localStorage.getItem(tokenKey));
    } catch {
      return;
    }
    if (
      (value?.token || "") === auth.token &&
      (value?.expiresAt || 0) === auth.expiresAt
    )
      return;
    sessionVersion++;
    auth.token = value?.token || "";
    auth.expiresAt = value?.expiresAt || 0;
    auth.user = null;
    auth.ready = !value;
    if (value) void refreshUser().catch(() => {});
  });
export const notification = ref("");
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(message: string) {
  notification.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (notification.value = ""), 4000);
}
export function useTask() {
  const busy = ref(false),
    error = ref("");
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      return await fn();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "操作失败，请稍后再试";
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, run };
}
export const date = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const quality = (value: unknown) =>
  value == null ? "—" : Number(value).toFixed(1);
export const statusLabel = (s: string) =>
  ({
    pending: "等待审核",
    approved: "已通过",
    rejected: "未通过",
    disabled: "已停用",
    draft: "草稿",
    published: "已公开",
    archived: "已归档",
  })[s] || s;
export function download(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
