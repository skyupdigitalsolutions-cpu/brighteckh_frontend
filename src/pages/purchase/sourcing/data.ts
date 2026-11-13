// BR-04 sourcing — LOCAL query hooks this group needs beyond src/pages/purchase/api.ts (reported to the coordinator).
//
// Item names: stock-check lines, shortages (via their stock-check line) and RFQ lines carry only `item_bridge_id`.
// There is no "bridge row by id" endpoint (gap G?-C2-1). The closest real source is
// GET /material-requests/{id}/catalogue (any role, company-scoped, APPROVED + active bridge rows, max 200 rows),
// which returns item_bridge_id + item_code + item_name. We read it once (limit 200) and map ids → code/name; an id
// that isn't in that list (de-listed item, >200 items) renders its UUID prefix with a GapNote.
//
// Material requests: GET /material-requests is the Purchase inbox (whole company). The job's requests are
// filtered client-side by job_id (no /jobs/{id}/material-requests GET exists).
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk, purchaseApi, type Rfq, type RfqRow } from '../api';

export type MaterialRequestRow = S<'Br03MaterialRequestsRow'>;
export type CatalogueItem = S<'CatalogueItem'>;
export type ItemName = { code: string; name: string; uom: string };

const sk = {
  mrs: ['purchase', 'sourcing', 'material-requests'] as const,
  catalogue: (mrId: string) => ['purchase', 'sourcing', 'catalogue', mrId] as const,
};

/** GET /material-requests (Purchase inbox, newest first). */
export const useMaterialRequests = (enabled = true) =>
  useQuery({
    queryKey: sk.mrs,
    queryFn: () => http.get<MaterialRequestRow[]>('/material-requests').then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });

/** The job's material requests (newest first) + the latest submitted (non-DRAFT) one, which a stock check needs. */
export function useJobMaterialRequests(jobId: string | undefined) {
  const q = useMaterialRequests(!!jobId);
  const forJob = useMemo(() => (q.data ?? []).filter((m) => m.job_id === jobId), [q.data, jobId]);
  const submitted = forJob.find((m) => m.status !== 'DRAFT');
  return { query: q, forJob, submitted };
}

/** bridge id → {code, name, uom}, from GET /material-requests/{mrId}/catalogue?limit=200. */
export function useItemNames(mrId: string | undefined) {
  const q = useQuery({
    queryKey: sk.catalogue(mrId ?? ''),
    queryFn: () => http.get<CatalogueItem[]>(`/material-requests/${mrId}/catalogue`, { params: { limit: '200' } }).then((r) => r.data),
    enabled: !!mrId,
    staleTime: 5 * 60_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, ItemName>();
    for (const c of q.data ?? []) m.set(c.item_bridge_id, { code: c.master_item_code ?? c.item_code, name: c.master_standard_name ?? c.item_name, uom: c.uom });
    return m;
  }, [q.data]);
  return { query: q, map };
}

/** Details of several RFQs (the job's RFQ list only returns headers; lines/invites/offers come from GET /rfqs/{id}). */
export function useRfqDetails(rows: RfqRow[] | undefined) {
  return useQueries({
    queries: (rows ?? []).map((r) => ({ queryKey: pk.rfq(r.id), queryFn: () => purchaseApi.rfq(r.id) })),
  }) as { data: Rfq | undefined; isPending: boolean; isError: boolean }[];
}

export const shortId = (uuid: string) => uuid.slice(0, 8);
