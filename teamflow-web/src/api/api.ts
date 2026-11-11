import { pageSignal } from "./routeScope";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

// Refresh this long before the access token expires. 
const REFRESH_MARGIN_MS = 60_000;

// How often the session is checked while the tab is visible. 
const KEEP_ALIVE_MS = 30_000;

const SESSION_ENDED = "Your session has ended. Please log in again.";
const CHANNEL_NAME = "teamflow-session";
const LOCK_NAME = "teamflow-token-refresh";

interface SessionData {
  accessToken: string;
  role?: string;
  username?: string;
}

type LockManager = {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
};

type SessionMessage = { type: "token"; token: string } | { type: "signed-out" };

// Kept in memory only. After a reload, a new one comes from the refresh cookie. 
let accessToken: string | null = null;
let inFlight: Promise<string> | null = null;

// Tabs share the current access token and sign-out through this channel.
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

channel?.addEventListener("message", (event: MessageEvent<SessionMessage>) => {
  if (event.data.type === "token") {
    accessToken = event.data.token;
  } else {
    clearLocal();
    window.location.href = "/login";
  }
});

function clearLocal() {
  accessToken = null;
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  // Remove copies stored by earlier versions of the app.
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export function saveSession(data: SessionData) {
  accessToken = data.accessToken;

  if (data.role) localStorage.setItem("role", data.role);
  else localStorage.removeItem("role");

  if (data.username) localStorage.setItem("username", data.username);
  else localStorage.removeItem("username");

  channel?.postMessage({ type: "token", token: data.accessToken } satisfies SessionMessage);
}

export function clearSession() {
  clearLocal();
}

function endSession(message: string): never {
  clearLocal();
  channel?.postMessage({ type: "signed-out" } satisfies SessionMessage);
  window.location.href = "/login";
  throw new Error(message);
}

// Token expiry

function tokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const exp = (JSON.parse(atob(payload)) as { exp?: number }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function expiresSoon(token: string): boolean {
  const exp = tokenExpiryMs(token);
  return exp !== null && exp - Date.now() < REFRESH_MARGIN_MS;
}

// Refresh

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (navigator as unknown as { locks?: LockManager }).locks;
  return locks ? locks.request(LOCK_NAME, task) : task();
}

async function performRefresh(rejectedToken?: string): Promise<string> {
  // Another tab may have refreshed while this one waited for the lock.
  if (accessToken && accessToken !== rejectedToken && !expiresSoon(accessToken)) {
    return accessToken;
  }

  const response = await fetch(`${API_BASE_URL}/users/refresh`, {
    method: "POST",
    credentials: "include",
  });

  // Only a rejected cookie ends the session. A network failure keeps it and is retried later.
  if (response.status === 401) {
    return endSession(SESSION_ENDED);
  }
  if (!response.ok) {
    throw new Error("Could not refresh your session. Check the connection and try again.");
  }

  const data = (await response.json()) as SessionData;
  saveSession(data);
  return data.accessToken;
}

// One refresh at a time per tab, and one across tabs. 
export function refreshAccessToken(rejectedToken?: string): Promise<string> {
  inFlight ??= withLock(() => performRefresh(rejectedToken)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function currentAccessToken(): Promise<string> {
  if (accessToken && !expiresSoon(accessToken)) {
    return accessToken;
  }
  return refreshAccessToken(accessToken ?? undefined);
}

// Keep-alive

/*
    Keeps the session fresh while the app is open. Checks only while the tab is visible,
    so a hidden or sleeping tab doesn't spend requests. Call once from App.
*/
export function startSessionKeepAlive(): () => void {
  const check = () => {
    const signedIn = accessToken !== null || localStorage.getItem("username") !== null;
    if (!signedIn || document.visibilityState !== "visible") return;

    if (accessToken === null || expiresSoon(accessToken)) {
      refreshAccessToken(accessToken ?? undefined).catch(() => undefined);
    }
  };

  check();
  const timer = window.setInterval(check, KEEP_ALIVE_MS);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  window.addEventListener("online", check);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
    window.removeEventListener("online", check);
  };
}

// Requests

// True when a request was cancelled because the user left the page. 
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  if (!raw) {
    return `Request failed with status ${response.status}`;
  }
  try {
    const body = JSON.parse(raw) as { error?: string; message?: string };
    return body.error || body.message || raw;
  } catch {
    return raw;
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isRead = (options.method ?? "GET").toUpperCase() === "GET";
  const signal = options.signal ?? (isRead ? pageSignal() : undefined);

  const send = (token: string) =>
    fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

  const sent = await currentAccessToken();
  let response = await send(sent);

  // The server rejected the token we sent. Refresh once against that token, then retry.
  if (response.status === 401) {
    response = await send(await refreshAccessToken(sent));
    if (response.status === 401) {
      endSession(SESSION_ENDED);
    }
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Failed to parse API response");
  }
}

// Sign-out

export async function logout() {
  await fetch(`${API_BASE_URL}/users/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);

  clearLocal();
  channel?.postMessage({ type: "signed-out" } satisfies SessionMessage);
  window.location.href = "/login";
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export default apiFetch;