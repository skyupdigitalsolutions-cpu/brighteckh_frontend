// Per-device conveniences only (recent jobs, photos uploaded from this device).
// Nothing here is authoritative — the server is. Every access is guarded: storage may be unavailable.

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* unavailable */ }
}

// ---- Recent jobs (G1 workaround: there is no "my jobs" list endpoint)
export type RecentJob = { id: string; openedAt: string };
const RECENT = 'bt.recentJobs';
export const recentJobs = {
  list: (userId: string): RecentJob[] => readJSON<Record<string, RecentJob[]>>(RECENT, {})[userId] ?? [],
  add(userId: string, jobId: string) {
    const all = readJSON<Record<string, RecentJob[]>>(RECENT, {});
    const mine = (all[userId] ?? []).filter((j) => j.id !== jobId);
    all[userId] = [{ id: jobId, openedAt: new Date().toISOString() }, ...mine].slice(0, 30);
    writeJSON(RECENT, all);
  },
  remove(userId: string, jobId: string) {
    const all = readJSON<Record<string, RecentJob[]>>(RECENT, {});
    all[userId] = (all[userId] ?? []).filter((j) => j.id !== jobId);
    writeJSON(RECENT, all);
  },
};

// ---- Inspection media uploaded from this device (G9: GET inspection-report returns no media[])
export type LocalMedia = { id: string; file_name: string; media_type: 'PHOTO' | 'VIDEO'; uploaded_at: string; version_id: string | null };
const MEDIA = 'bt.inspectionMedia';
export const localMedia = {
  list: (reportId: string): LocalMedia[] => readJSON<Record<string, LocalMedia[]>>(MEDIA, {})[reportId] ?? [],
  add(reportId: string, m: LocalMedia) {
    const all = readJSON<Record<string, LocalMedia[]>>(MEDIA, {});
    all[reportId] = [...(all[reportId] ?? []), m];
    writeJSON(MEDIA, all);
  },
};
