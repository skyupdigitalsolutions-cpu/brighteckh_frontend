// Jobs group data layer (LOCAL — not in the shared api.ts).
//
// Jobs list (G15): there is NO Purchase jobs list endpoint. GET /jobs/{id} is detail only and GET /my-jobs is
// @Roles('ENGINEER'). useJobsList() is the list's data source and reports `unavailable`; the screen renders the
// designed empty state + GapNote G15 + an "Open job" input. When a list endpoint ships, return its rows here (shape
// JobListRow = the engineer MyJobRow shape with a nullable current assignment) and the table/filters/pagination work
// unchanged.
//
// Overview reads (both un-roled on the backend, company-scoped, so Purchase can call them):
//   GET /jobs/{id}/inspection-report   → InspectionReportDetail (404 "inspection report not found" = no report yet)
//   GET /jobs/{id}/inspection-sessions → { sessions, time_totals }
import { useQuery } from '@tanstack/react-query';
import { http, apiStatus } from '../../../api/http';
import type { S } from '../../../api/types';
import type { Job, JobAssignment } from '../api';

export type JobStatus = Job['status'];
export type JobPriority = Job['priority'];
export type AssignmentResponse = JobAssignment['response'];
export type InspectionReport = S<'InspectionReportDetail'>;
export type InspectionSessions = S<'InspectionSessionsResponse'>;

/** A jobs-list row. Mirrors the engineer list row (MyJobRow) — the closest existing list shape — but the current
 *  assignment can be null (unassigned jobs are in Purchase's list). */
export type JobListRow = Omit<S<'MyJobRow'>, 'current_assignment'> & { current_assignment: JobAssignment | null };

export type ListSource =
  | { state: 'unavailable'; gap: 'G15' }
  | { state: 'loading' }
  | { state: 'error'; error: unknown; retry: () => void; retrying: boolean }
  | { state: 'ready'; rows: JobListRow[] };

/** The Purchase jobs list. No endpoint exists (G15), so this never fabricates rows. */
export function useJobsList(): ListSource {
  return { state: 'unavailable', gap: 'G15' };
}

const get = <T,>(url: string) => http.get<T>(url).then((r) => r.data);

/** null = the job has no inspection report yet (API 404). */
export const useJobInspectionReport = (jobId: string) =>
  useQuery({
    queryKey: ['purchase', 'job', jobId, 'inspection-report'],
    queryFn: async () => {
      try {
        return await get<InspectionReport>(`/jobs/${jobId}/inspection-report`);
      } catch (e) {
        if (apiStatus(e) === 404) return null;
        throw e;
      }
    },
    enabled: !!jobId,
  });

export const useJobInspectionSessions = (jobId: string) =>
  useQuery({
    queryKey: ['purchase', 'job', jobId, 'inspection-sessions'],
    queryFn: () => get<InspectionSessions>(`/jobs/${jobId}/inspection-sessions`),
    enabled: !!jobId,
  });

// ------------------------------------------------------------------ filters (API enums)
// Status menu = service_jobs.status (schema JobDetail.status). Figma's labels are these enum values in sentence case;
// JOB_CREATED is not drawn but is the DB default status of a new job, so it is listed (deviation).
export const STATUS_OPTIONS: { value: JobStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'JOB_CREATED', label: 'Job created' },
  { value: 'AWAITING_ASSIGNMENT', label: 'Awaiting assignment' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'CLOSED', label: 'Closed' },
];

export const PRIORITY_OPTIONS: { value: JobPriority | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All priorities' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Critical' },
];

/** Engineer filter: no engineer lookup (G17) → only "All" and "Unassigned"; never invented names. */
export type EngineerFilter = 'ALL' | 'UNASSIGNED';
export const ENGINEER_OPTIONS: { value: EngineerFilter; label: string }[] = [
  { value: 'ALL', label: 'All engineers' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
];

/** Tab bar (Figma 177:111155) → service_jobs.status groups. The grouping is derived (Figma names, not API values). */
export type JobsTab = 'all' | 'awaiting' | 'progress' | 'hold' | 'closed';
export const TABS: { key: JobsTab; label: string; statuses: JobStatus[] | null }[] = [
  { key: 'all', label: 'All jobs', statuses: null },
  { key: 'awaiting', label: 'Awaiting assignment', statuses: ['JOB_CREATED', 'AWAITING_ASSIGNMENT'] },
  { key: 'progress', label: 'In progress', statuses: ['ASSIGNED', 'ACCEPTED', 'INSPECTION'] },
  { key: 'hold', label: 'On hold', statuses: ['ON_HOLD'] },
  { key: 'closed', label: 'Closed', statuses: ['CLOSED', 'CANCELLED'] },
];

export const isOpen = (s: JobStatus) => s !== 'CLOSED' && s !== 'CANCELLED';

/** Latest timestamp the row carries (no updated_at on service_jobs). */
export function lastActivity(r: JobListRow): string {
  const ts = [r.created_at, r.current_assignment?.assigned_at, r.current_assignment?.responded_at, r.closed_at, r.cancelled_at]
    .filter((x): x is string => !!x);
  return ts.reduce((a, b) => (new Date(b) > new Date(a) ? b : a), r.created_at);
}

/** Figma "Updated" cell: today → "09:40", yesterday → "Yesterday", else "03 Nov" (IST). */
const IST = 'Asia/Kolkata';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' });
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
const dm = new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: '2-digit', month: 'short' });
export function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const k = dayKey.format(d);
  if (k === dayKey.format(now)) return hm.format(d);
  if (k === dayKey.format(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return dm.format(d);
}

/** "waiting 1 h" style elapsed text since an ISO time. */
export function formatWaiting(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const isUuid = (s: string) => new RegExp(`^${UUID_RE.source}$`, 'i').test(s.trim());
/** Short id for display where no name exists (G17). */
export const shortId = (id: string) => id.slice(0, 8);
