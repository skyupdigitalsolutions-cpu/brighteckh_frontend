// BR-04 sourcing — LOCAL query helpers this group needs beyond src/pages/purchase/api.ts.
//
// Item names: RFQ lines carry item_code / item_name (GET /rfqs/{id}); stock-check lines and shortages (via their
// stock-check line) carry only `item_bridge_id`, resolved with the shared useItemBridgeByIds (GET /lookups/item-bridge).
//
// Material requests: GET /material-requests is the Purchase inbox (whole company). The job's requests are
// filtered client-side by job_id (no /jobs/{id}/material-requests GET exists). A stock check needs the job's
// submitted (non-DRAFT) request.
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk, purchaseApi, type ItemBridgeLookupRow, type Rfq, type RfqRow } from '../api';

export type MaterialRequestRow = S<'Br03MaterialRequestsRow'>;
export type ItemName = { code: string; name: string };

const sk = {
  mrs: ['purchase', 'sourcing', 'material-requests'] as const,
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

/** Details of several RFQs (the job's RFQ list only returns headers; lines/invites/offers come from GET /rfqs/{id}). */
export function useRfqDetails(rows: RfqRow[] | undefined) {
  return useQueries({
    queries: (rows ?? []).map((r) => ({ queryKey: pk.rfq(r.id), queryFn: () => purchaseApi.rfq(r.id) })),
  }) as { data: Rfq | undefined; isPending: boolean; isError: boolean }[];
}

export const shortId = (uuid: string) => uuid.slice(0, 8);

/** Bridge row → {code, name}; while the lookup is loading (or the row is missing) → "…" placeholders. */
export function itemOf(rows: Record<string, ItemBridgeLookupRow> | undefined, bridgeId: string, loading: boolean): ItemName {
  const r = rows?.[bridgeId];
  if (r) return { code: r.item_code, name: r.item_name };
  return loading ? { code: '…', name: '…' } : { code: shortId(bridgeId), name: `Item ${shortId(bridgeId)}` };
}
