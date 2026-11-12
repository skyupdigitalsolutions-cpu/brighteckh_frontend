import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { TokenPair } from './types';

export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

// Token store. Access token: memory + sessionStorage (survives reload, not new tabs).
// Refresh token: localStorage. Storage can throw (private mode / blocked data), so it is guarded.
const ACCESS_KEY = 'bt.access';
const REFRESH_KEY = 'bt.refresh';
function read(store: () => Storage, k: string): string | null {
  try { return store().getItem(k); } catch { return null; }
}
function write(store: () => Storage, k: string, v: string | null) {
  try { if (v === null) store().removeItem(k); else store().setItem(k, v); } catch { /* storage unavailable */ }
}
let accessToken: string | null = read(() => sessionStorage, ACCESS_KEY);
let refreshToken: string | null = read(() => localStorage, REFRESH_KEY);

export const tokens = {
  get access() { return accessToken; },
  get refresh() { return refreshToken; },
  set(pair: Pick<TokenPair, 'access_token' | 'refresh_token'>) {
    accessToken = pair.access_token;
    refreshToken = pair.refresh_token;
    write(() => sessionStorage, ACCESS_KEY, accessToken);
    write(() => localStorage, REFRESH_KEY, refreshToken);
  },
  clear() {
    accessToken = null;
    refreshToken = null;
    write(() => sessionStorage, ACCESS_KEY, null);
    write(() => localStorage, REFRESH_KEY, null);
  },
};

/** Fired when the session can't be refreshed any more; AuthProvider listens and routes to /login. */
export const SESSION_EXPIRED = 'bt:session-expired';

export const http = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 30_000 });

http.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.set('Authorization', `Bearer ${accessToken}`);
  return cfg;
});

// Single-flight refresh. The backend rotates refresh tokens and revokes the whole login chain
// if a rotated token is replayed, so concurrent 401s must share ONE POST /auth/refresh.
let refreshing: Promise<string | null> | null = null;
function refreshAccess(): Promise<string | null> {
  if (!refreshToken) return Promise.resolve(null);
  refreshing ??= axios
    .post<TokenPair>(`${API_ORIGIN}/api/auth/refresh`, { refresh_token: refreshToken })
    .then((r) => { tokens.set(r.data); return r.data.access_token; })
    .catch(() => { tokens.clear(); return null; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };
http.interceptors.response.use(undefined, async (err: AxiosError) => {
  const cfg = err.config as Retriable | undefined;
  const url = cfg?.url ?? '';
  if (err.response?.status === 401 && cfg && !cfg._retried && !/\/auth\/(login|refresh)$/.test(url)) {
    cfg._retried = true;
    const fresh = await refreshAccess();
    if (fresh) {
      cfg.headers.set('Authorization', `Bearer ${fresh}`);
      return http(cfg);
    }
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  throw err;
});

/** NestJS error body is { statusCode, message: string | string[], error }; DB trigger text arrives in `message`. */
export function apiErrorMessages(e: unknown): string[] {
  if (axios.isAxiosError(e)) {
    if (!e.response) return ["Can't reach the server. Check your connection, then try again."];
    const m = (e.response.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) return [m];
    return [`Request failed (${e.response.status})`];
  }
  return [e instanceof Error ? e.message : 'Something went wrong'];
}
export const apiErrorText = (e: unknown) => apiErrorMessages(e).join(' · ');
export const apiStatus = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined);
