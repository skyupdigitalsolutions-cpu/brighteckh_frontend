// Jobs group data layer (LOCAL — not in the shared api.ts).
//
// The jobs list itself is the shared useJobsList (GET /jobs, server pagination/filters/search) from ../api.
// Overview reads (both un-roled on the backend, company-scoped, so Purchase can call them):
//   GET /jobs/{id}/inspection-report   → InspectionReportDetail (404 "inspection report not found" = no report yet)
//   GET /jobs/{id}/inspection-sessions → { sessions, time_totals }
import { useQuery } from '@tanstack/react-query';
import { http, apiStatus } from '../../../api/http';
import type { S } from '../../../api/types';
import type { Job } from '../api';

export type JobStatus = Job['status'];
export type JobPriority = Job['priority'];
export type InspectionReport = S<'InspectionReportDetail'>;
export type InspectionSessions = S<'InspectionSessionsResponse'>;

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

/** Tab bar (Figma 177:111155, no counts drawn) → service_jobs.status groups sent as the list's `status` filter.
 *  The grouping is derived (Figma names, not API values). */
export type JobsTab = 'all' | 'awaiting' | 'progress' | 'hold' | 'closed';
export const TABS: { key: JobsTab; label: string; statuses: JobStatus[] | null }[] = [
  { key: 'all', label: 'All jobs', statuses: null },
  { key: 'awaiting', label: 'Awaiting assignment', statuses: ['JOB_CREATED', 'AWAITING_ASSIGNMENT'] },
  { key: 'progress', label: 'In progress', statuses: ['ASSIGNED', 'ACCEPTED', 'INSPECTION'] },
  { key: 'hold', label: 'On hold', statuses: ['ON_HOLD'] },
  { key: 'closed', label: 'Closed', statuses: ['CLOSED', 'CANCELLED'] },
];

export const isOpen = (s: JobStatus) => s !== 'CLOSED' && s !== 'CANCELLED';

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

export const OPEN_STATUSES: JobStatus[] = ['JOB_CREATED', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED', 'INSPECTION', 'ON_HOLD'];
