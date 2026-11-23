// Purchase "Requests" (material-request inbox) data layer.
//
// List: GET /purchase/material-requests (PURCHASE, MANAGEMENT); rows / page / enums are the generated PurchaseMr* types.
// Detail: GET /jobs/{id}/material-requests (PURCHASE, MANAGEMENT; generated type JobMaterialRequest): lines with
// item_code / item_name + live fulfilment (allocatable_now), and the change requests. The job-tab hook
// (jobtabs/data.ts useJobMaterialRequests) reads the older GET /material-requests + /{id} pair with a different shape,
// so this read keeps its own key under pk.job(jobId) — invalidating the job refreshes both.
// Writes: POST /material-requests/{id}/start-processing (jobtabs/data.ts useStartMrProcessing, reused) and
// POST /material-requests/{id}/change-requests/{crId}/review {decision ACCEPTED|REJECTED, comment?} — both @Roles(PURCHASE).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk } from '../api';

const get = <T,>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

// ------------------------------------------------------------------ list types (generated: PurchaseMrPage)
export type PurchaseMrListRow = S<'PurchaseMrRow'>;
export type PurchaseMrListPage = S<'PurchaseMrPage'>;
export type MrStatus = PurchaseMrListRow['status'];
export type MrPriority = PurchaseMrListRow['priority'];

/** Query params of GET /purchase/material-requests (csv enums are sent joined; see `qs`). */
export type PurchaseMrListParams = {
  page?: number;
  /** ≤ 100 */
  page_size?: number;
  /** One or many (sent comma-separated). */
  status?: MrStatus | MrStatus[];
  priority?: MrPriority | MrPriority[];
  job_id?: string;
  /** Responsible engineer (employees.id). */
  engineer_id?: string;
  /** Request number, job number, engineer name, customer name. */
  search?: string;
};

/** Drops empty params; arrays → comma-separated. */
function qs(p: PurchaseMrListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

// ------------------------------------------------------------------ detail + write types (generated)
export type JobMaterialRequest = S<'JobMaterialRequest'>;
export type JobMaterialRequestLine = S<'JobMaterialRequestLine'>;
export type ChangeRequest = S<'Br03MaterialChangeRequestsRow'>;
export type ReviewChangeRequestBody = S<'ReviewChangeRequestDto'>;

// ------------------------------------------------------------------ keys
export const rk = {
  lists: ['purchase', 'mr-inbox'] as const,
  list: (p: PurchaseMrListParams) => ['purchase', 'mr-inbox', qs(p)] as const,
  jobMrs: (jobId: string) => [...pk.job(jobId), 'material-requests-desk'] as const,
};

// ------------------------------------------------------------------ hooks
/** GET /purchase/material-requests — server pagination; previous page stays on screen while the next loads. */
export const usePurchaseMrList = (p: PurchaseMrListParams, enabled = true) =>
  useQuery({
    queryKey: rk.list(p),
    queryFn: () => get<PurchaseMrListPage>('/purchase/material-requests', qs(p)),
    enabled,
    placeholderData: keepPreviousData,
  });

/** GET /jobs/{id}/material-requests — the job's MRs (newest first) with lines + fulfilment + change requests. */
export const useJobMrsDesk = (jobId: string | undefined) =>
  useQuery({
    queryKey: rk.jobMrs(jobId ?? ''),
    queryFn: () => get<JobMaterialRequest[]>(`/jobs/${jobId}/material-requests`),
    enabled: !!jobId,
  });

/** POST /material-requests/{id}/change-requests/{crId}/review — @Roles(PURCHASE). Refreshes the inbox + the job. */
export function useReviewChangeRequest(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { mrId: string; crId: string; body: ReviewChangeRequestBody }) =>
      post<ChangeRequest>(`/material-requests/${a.mrId}/change-requests/${a.crId}/review`, a.body),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: rk.lists }),
      qc.invalidateQueries({ queryKey: pk.job(jobId) }),
    ]),
  });
}
