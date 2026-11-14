// Job workspace tabs data layer (LOCAL — Inspection · Material · Authorisation · Purchase order · Repair & test).
// Shapes = generated OpenAPI types (S<'…'>). Keys sit under pk.job(jobId) so invalidating the job refreshes them.
// Reads are company-scoped and un-roled on the backend unless noted; writes carry the backend @Roles noted per hook
// (screens hide actions a role can't perform — can.purchaseWork()).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiStatus, http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk } from '../api';

const get = <T,>(url: string) => http.get<T>(url).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);
/** 404 → null (the record doesn't exist yet, e.g. no inspection / repair report). */
const getOrNull = async <T,>(url: string): Promise<T | null> => {
  try { return await get<T>(url); } catch (e) { if (apiStatus(e) === 404) return null; throw e; }
};
const jk = (jobId: string, ...rest: string[]) => [...pk.job(jobId), ...rest] as const;

// ------------------------------------------------------------------ BR-03 inspection (Inspection tab)
export type InspectionReport = S<'InspectionReportDetail'>;
export type InspectionVersion = S<'Br03InspectionReportVersionsRow'>;
export type InspectionReview = S<'Br03InspectionReviewsRow'>;
export type InspectionMedia = S<'Br03InspectionMediaRow'>;
export type ReviewInspectionBody = S<'ReviewInspectionDto'>;

/** Same cache entry as the Overview tab (jobs/jobsData.ts useJobInspectionReport). null = no report yet. */
export const useInspectionReport = (jobId: string) =>
  useQuery({ queryKey: jk(jobId, 'inspection-report'), queryFn: () => getOrNull<InspectionReport>(`/jobs/${jobId}/inspection-report`) });

/** GET /inspection-reports/{id}/media — every version's photos/videos, oldest first. */
export const useInspectionMedia = (jobId: string, reportId: string | undefined) =>
  useQuery({
    queryKey: jk(jobId, 'inspection-media', reportId ?? ''),
    queryFn: () => get<InspectionMedia[]>(`/inspection-reports/${reportId}/media`),
    enabled: !!reportId,
  });

/** POST /inspection-reports/{id}/review {decision ACCEPT|RETURN, comment} — @Roles(PURCHASE). */
export function useReviewInspection(jobId: string, reportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReviewInspectionBody) => post<S<'InspectionVersionResult'>>(`/inspection-reports/${reportId}/review`, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: pk.job(jobId) }),
  });
}

// ------------------------------------------------------------------ BR-03 / BR-05 / BR-07 material (Material tab)
export type MaterialRequest = S<'MaterialRequestDetail'>;
export type MaterialRequestRow = S<'Br03MaterialRequestsRow'>;
export type MaterialRequestLine = S<'Br03MaterialRequestLinesRow'>;
export type ChangeRequest = S<'Br03MaterialChangeRequestsRow'>;
export type JobMaterial = S<'JobMaterialResponse'>;
export type MaterialIssue = S<'Br07MaterialIssuesRow'>;
export type Reservation = S<'Br05MaterialReservationsRow'>;
export type StockRecheck = S<'StockRecheckWithLines'>;
export type StockRecheckLine = S<'Br05StockRecheckLinesRow'>;

/**
 * The job's material requests with lines + change requests, newest first.
 * API gap (G-MR-1): there is no per-job MR read — GET /material-requests is the company inbox (filter: status only),
 * so it is filtered by job_id here, then each request's detail is fetched (GET /material-requests/{id}).
 */
export const useJobMaterialRequests = (jobId: string) =>
  useQuery({
    queryKey: jk(jobId, 'material-requests'),
    queryFn: async () => {
      const all = await get<MaterialRequestRow[]>('/material-requests');
      const mine = all.filter((r) => r.job_id === jobId);
      const details = await Promise.all(mine.map((r) => get<MaterialRequest>(`/material-requests/${r.id}`)));
      return details.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

/** GET /jobs/{id}/material-issues → { issues, consumptions, returns } (un-roled read). */
export const useJobMaterial = (jobId: string) =>
  useQuery({ queryKey: jk(jobId, 'material-issues'), queryFn: () => get<JobMaterial>(`/jobs/${jobId}/material-issues`) });

/** GET /jobs/{id}/reservations — @Roles(PURCHASE). Newest first. */
export const useJobReservations = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'reservations'), queryFn: () => get<Reservation[]>(`/jobs/${jobId}/reservations`), enabled });

/** GET /jobs/{id}/stock-rechecks — @Roles(PURCHASE). Post-authorisation rechecks with lines (reservations point at lines). */
export const useJobStockRechecks = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'stock-rechecks'), queryFn: () => get<StockRecheck[]>(`/jobs/${jobId}/stock-rechecks`), enabled });

/** POST /material-requests/{id}/start-processing — @Roles(PURCHASE). SUBMITTED → PROCESSING. */
export function useStartMrProcessing(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mrId: string) => post<MaterialRequestRow>(`/material-requests/${mrId}/start-processing`),
    onSuccess: () => qc.invalidateQueries({ queryKey: pk.job(jobId) }),
  });
}

// ------------------------------------------------------------------ BR-05 authorisation (Authorisation tab)
// Every BR-05 route is @Roles(PURCHASE) except GET /jobs/{id}/quote-responses (any role) and POST quote-responses (SALES).
export type QuoteResponseEvent = S<'Br05CustomerResponseEventsRow'>;
export type CustomerAuthority = S<'Br05CustomerOrdersRow'>;
export type CustomerAuthorityBody = S<'CustomerAuthorityDto'>;
export type OrderAllocation = S<'Br05OrderJobAllocationsRow'>;
export type OrderAllocationBody = S<'CreateOrderAllocationDto'>;
export type JobAuthorisation = S<'Br05JobAuthorisationsRow'>;
export type JobRelease = S<'Br05JobReleasesRow'>;

export const useQuoteResponses = (jobId: string) =>
  useQuery({ queryKey: jk(jobId, 'quote-responses'), queryFn: () => get<QuoteResponseEvent[]>(`/jobs/${jobId}/quote-responses`) });
export const useCustomerAuthorities = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'customer-authority'), queryFn: () => get<CustomerAuthority[]>(`/jobs/${jobId}/customer-authority`), enabled });
export const useOrderAllocations = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'order-allocations'), queryFn: () => get<OrderAllocation[]>(`/jobs/${jobId}/order-allocations`), enabled });
export const useJobAuthorisations = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'authorisations'), queryFn: () => get<JobAuthorisation[]>(`/jobs/${jobId}/authorisations`), enabled });
export const useJobReleases = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'release'), queryFn: () => get<JobRelease[]>(`/jobs/${jobId}/release`), enabled });

/** One hook per BR-05 write; each refreshes everything under the job (stepper, Material tab reservations, progress). */
function useJobWrite<A, R>(jobId: string, fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: pk.job(jobId) }) });
}
export const useRecordCustomerAuthority = (jobId: string) =>
  useJobWrite(jobId, (b: CustomerAuthorityBody) => post<CustomerAuthority>(`/jobs/${jobId}/customer-authority`, b));
export const useVerifyCustomerAuthority = (jobId: string) =>
  useJobWrite(jobId, (a: { id: string; verification_notes?: string }) => post<CustomerAuthority>(`/customer-authority/${a.id}/verify`, a.verification_notes ? { verification_notes: a.verification_notes } : {}));
export const useCreateOrderAllocation = (jobId: string) =>
  useJobWrite(jobId, (b: OrderAllocationBody) => post<OrderAllocation>(`/jobs/${jobId}/order-allocations`, b));
export const useVerifyOrderAllocation = (jobId: string) =>
  useJobWrite(jobId, (id: string) => post<OrderAllocation>(`/order-allocations/${id}/verify`));
export const useAuthoriseJob = (jobId: string) =>
  useJobWrite(jobId, (order_job_allocation_id: string) => post<JobAuthorisation>(`/jobs/${jobId}/authorisations`, { order_job_allocation_id }));
export const useStockRecheck = (jobId: string) =>
  useJobWrite(jobId, (material_request_id: string) => post<StockRecheck>(`/jobs/${jobId}/stock-rechecks`, { material_request_id }));
export const useReleaseJob = (jobId: string) =>
  useJobWrite(jobId, (release_notes: string) => post<JobRelease>(`/jobs/${jobId}/release`, release_notes ? { release_notes } : {}));
export const useReserveMaterial = (jobId: string) =>
  useJobWrite(jobId, (b: S<'ReserveMaterialDto'>) => post<S<'ReservationCommitted'>>(`/jobs/${jobId}/reservations`, b));

// ------------------------------------------------------------------ BR-06 supplier PO (Purchase order tab)
// All @Roles(PURCHASE) except GRN creation / posting (STORES_QUALITY) and GET /grns/{id} (un-roled).
export type PurchaseOrderRow = S<'Br06SupplierPurchaseOrdersRow'>;
export type PurchaseOrder = S<'PurchaseOrderDetail'>;
export type PoLine = S<'Br06PoLinesRow'>;
export type Grn = S<'Br06GrnsRow'>;
export type CreatePoBody = S<'CreatePoDto'>;
export type AcknowledgePoBody = S<'AcknowledgePoDto'>;
export type ShipmentBody = S<'RecordShipmentDto'>;

export const useJobPurchaseOrders = (jobId: string, enabled = true) =>
  useQuery({ queryKey: jk(jobId, 'purchase-orders'), queryFn: () => get<PurchaseOrderRow[]>(`/jobs/${jobId}/purchase-orders`), enabled });
export const usePurchaseOrder = (jobId: string, poId: string | undefined) =>
  useQuery({ queryKey: jk(jobId, 'purchase-order', poId ?? ''), queryFn: () => get<PurchaseOrder>(`/purchase-orders/${poId}`), enabled: !!poId });
export const usePoGrns = (jobId: string, poId: string | undefined) =>
  useQuery({ queryKey: jk(jobId, 'purchase-order', poId ?? '', 'grns'), queryFn: () => get<Grn[]>(`/purchase-orders/${poId}/grns`), enabled: !!poId });

export const useCreatePo = (jobId: string) => useJobWrite(jobId, (b: CreatePoBody) => post<PurchaseOrder>(`/jobs/${jobId}/purchase-orders`, b));
export const useReleasePo = (jobId: string) => useJobWrite(jobId, (poId: string) => post<PurchaseOrderRow>(`/purchase-orders/${poId}/release`));
export const useAcknowledgePo = (jobId: string) =>
  useJobWrite(jobId, (a: { poId: string; body: AcknowledgePoBody }) => post<PurchaseOrderRow>(`/purchase-orders/${a.poId}/acknowledge`, a.body));
export const useRecordShipment = (jobId: string) =>
  useJobWrite(jobId, (a: { poId: string; body: ShipmentBody }) => post<PurchaseOrderRow>(`/purchase-orders/${a.poId}/shipment`, a.body));

// ------------------------------------------------------------------ BR-07 repair, test & dispatch release (Repair & test tab)
// GET /jobs/{id}/repair-status is un-roled; the Purchase writes below are @Roles(PURCHASE).
export type RepairStatus = S<'RepairStatusResponse'>;
export type TestRun = S<'Br07TestRunsRow'>;
export type MaterialReturn = S<'Br07MaterialReturnsRow'>;

/** One-call aggregate: material {issues, consumptions, returns} · repair sessions + totals · report header · tests
 *  (runs, failed_cycles, purchase_review_required, reviews, test_sla) · handoffs · dispatch_release. */
export const useRepairStatus = (jobId: string) =>
  useQuery({ queryKey: jk(jobId, 'repair-status'), queryFn: () => get<RepairStatus>(`/jobs/${jobId}/repair-status`) });

export const useIssueMaterial = (jobId: string) =>
  useJobWrite(jobId, (br05_material_reservation_id: string) => post<S<'MaterialIssued'>>(`/jobs/${jobId}/material-issues`, { br05_material_reservation_id }));
export const useVerifyReturn = (jobId: string) =>
  useJobWrite(jobId, (a: { id: string; body: S<'VerifyReturnDto'> }) => post<S<'ReturnVerified'>>(`/material-returns/${a.id}/verify`, a.body));
export const useReviewTestFailures = (jobId: string) =>
  useJobWrite(jobId, (b: S<'FailureReviewDto'>) => post<S<'Br07TestFailureReviewsRow'>>(`/jobs/${jobId}/test-failure-reviews`, b));
export const useDispatchRelease = (jobId: string) =>
  useJobWrite(jobId, (note: string) => post<S<'DispatchReleased'>>(`/jobs/${jobId}/dispatch-release`, note ? { note } : {}));
