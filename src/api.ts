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
const tokenKey = "scorem.session.v1";
const getToken = () => {
  try {
    return sessionStorage.getItem(tokenKey) || "";
  } catch {
    return "";
  }
};
export const auth = reactive({
  user: null as User | null,
  token: getToken(),
  ready: false,
});
export const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
export function setSession(user: User | null, token = "") {
  auth.user = user;
  auth.token = token;
  try {
    token
      ? sessionStorage.setItem(tokenKey, token)
      : sessionStorage.removeItem(tokenKey);
  } catch {
    /* In-memory sessions remain usable. */
  }
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
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  if (!apiBase)
    throw new ApiError(
      "站点暂时无法连接服务，请联系管理员完成配置。",
      "configuration",
      503,
    );
  const headers = new Headers(options.headers);
  if (auth.token) headers.set("Authorization", "Bearer " + auth.token);
  if (options.json !== undefined)
    headers.set("Content-Type", "application/json");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiBase + path, {
      ...options,
      headers,
      body:
        options.json !== undefined
          ? JSON.stringify(options.json)
          : options.body,
      signal: options.signal || controller.signal,
      credentials: "omit",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && data.error?.code === "unauthorized")
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
export async function refreshUser() {
  const r = await api<{ user: User | null }>("/api/auth/me");
  auth.user = r.user;
  auth.ready = true;
  return r.user;
}
export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", json: {} });
  } finally {
    setSession(null);
  }
}
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
