// Purchase desktop data layer — one typed function + TanStack hook per endpoint the Purchase screens use.
// Shapes are the generated OpenAPI types (src/api/schema.d.ts); paths are relative to the /api base in http.ts.
// Every BR-02 / BR-04 write here is @Roles('PURCHASE') on the backend.
//
// Not available in the API (use GapNote with these codes): G14 no JIN list, G15 no Purchase jobs list,
// G16 no customers lookup, G17 no engineer/employee lookup, G18 no custody-location lookup, G19 no `assemblies`
// list (equipment groups), G20 no cross-job RFQ list, G21 no cross-job quote list, G22 no dashboard metrics,
// G23 no notifications, G24 no global search.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { S } from '../../api/types';

const get = <T>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

// ------------------------------------------------------------------ types
export type Me = S<'MeResponse'>;
export type InwardReceipt = S<'InwardReceiptDetail'>;
export type InwardReceiptRow = S<'InwardReceiptsRow'>;
export type EquipmentGroup = S<'InwardEquipmentGroupsRow'>;
export type EquipmentUnit = S<'InwardEquipmentUnitsRow'>;
export type EquipmentPhoto = S<'EquipmentPhotosRow'>;
export type Job = S<'JobDetail'>;
export type JobAssignment = S<'JobAssignmentsRow'>;
export type VerifyUnitResult = S<'VerifyUnitResponse'>;
export type ExpandGroupResult = S<'ExpandGroupResponse'>;
export type StockCheck = S<'StockCheckWithLines'>;
export type StockCheckLine = S<'Br04StockCheckLinesRow'>;
export type Shortage = S<'Br04ShortageSourcesRow'>;
export type RfqRow = S<'Br04RfqsRow'>;
export type Rfq = S<'RfqDetail'>;
export type RfqCreated = S<'RfqWithLines'>;
export type SupplierInvite = S<'Br04RfqSupplierInvitesRow'>;
export type OfferRecorded = S<'OfferRecorded'>;
export type OfferLine = S<'Br04SupplierOfferLinesRow'>;
export type QuoteRow = S<'Br04CustomerQuotesRow'>;
export type Quote = S<'QuoteDetail'>;
export type QuoteWithRevision = S<'QuoteWithRevision'>;
export type QuoteRevision = S<'Br04CustomerQuoteRevisionsRow'>;
export type Item = S<'FdnItemMasterRow'>;
export type ItemStatus = Item['status'];
export type Upload = S<'UploadResult'>;

export type CreateReceiptBody = S<'CreateInwardReceiptDto'>;
export type AddGroupBody = S<'CreateEquipmentGroupDto'>;
export type ExpandGroupBody = S<'ExpandEquipmentGroupDto'>;
export type AddUnitPhotoBody = S<'AddUnitPhotoDto'>;
export type AssignEngineerBody = S<'AssignEngineerDto'>;
export type StockCheckBody = S<'StockCheckDto'>;
export type CreateRfqBody = S<'CreateRfqDto'>;
export type RfqLineBody = S<'RfqLineDto'>;
export type SupplierInviteBody = S<'SupplierInviteDto'>;
export type RecordOfferBody = S<'RecordOfferDto'>;
export type OfferLineBody = S<'OfferLineDto'>;
export type MarkOfferValidityBody = S<'MarkOfferValidityDto'>;
export type CreateQuoteBody = S<'CreateQuoteDto'>;
export type ReviseQuoteBody = S<'ReviseQuoteDto'>;
export type QuoteLineBody = S<'QuoteLineDto'>;
export type ReleaseToSalesBody = S<'ReleaseToSalesDto'>;

// ------------------------------------------------------------------ raw calls
export const purchaseApi = {
  me: () => get<Me>('/auth/me'),

  // BR-02
  createReceipt: (b: CreateReceiptBody) => post<InwardReceiptRow>('/inward-receipts', b),
  receipt: (id: string) => get<InwardReceipt>(`/inward-receipts/${id}`),
  addGroup: (receiptId: string, b: AddGroupBody) => post<EquipmentGroup>(`/inward-receipts/${receiptId}/equipment-groups`, b),
  expandGroup: (groupId: string, b: ExpandGroupBody) => post<ExpandGroupResult>(`/equipment-groups/${groupId}/expand`, b),
  addUnitPhoto: (unitId: string, b: AddUnitPhotoBody) => post<EquipmentPhoto>(`/equipment-units/${unitId}/photos`, b),
  verifyUnit: (unitId: string) => post<VerifyUnitResult>(`/equipment-units/${unitId}/verify`),
  job: (id: string) => get<Job>(`/jobs/${id}`),
  assignEngineer: (jobId: string, b: AssignEngineerBody) => post<JobAssignment>(`/jobs/${jobId}/assign`, b),

  // BR-04
  stockChecks: (jobId: string) => get<StockCheck[]>(`/jobs/${jobId}/stock-checks`),
  runStockCheck: (jobId: string, b: StockCheckBody) => post<StockCheck>(`/jobs/${jobId}/stock-checks`, b),
  shortages: (jobId: string) => get<Shortage[]>(`/jobs/${jobId}/shortages`),
  rfqs: (jobId: string) => get<RfqRow[]>(`/jobs/${jobId}/rfqs`),
  createRfq: (jobId: string, b: CreateRfqBody) => post<RfqCreated>(`/jobs/${jobId}/rfqs`, b),
  rfq: (id: string) => get<Rfq>(`/rfqs/${id}`),
  addSupplierInvite: (rfqId: string, b: SupplierInviteBody) => post<SupplierInvite>(`/rfqs/${rfqId}/supplier-invites`, b),
  recordOffer: (rfqId: string, b: RecordOfferBody) => post<OfferRecorded>(`/rfqs/${rfqId}/offers`, b),
  markOfferValidity: (offerLineId: string, b: MarkOfferValidityBody) => post<OfferLine>(`/offer-lines/${offerLineId}/mark-validity`, b),
  quotes: (jobId: string) => get<QuoteRow[]>(`/jobs/${jobId}/quotes`),
  createQuote: (jobId: string, b: CreateQuoteBody) => post<QuoteWithRevision>(`/jobs/${jobId}/quotes`, b),
  quote: (id: string) => get<Quote>(`/quotes/${id}`),
  reviseQuote: (quoteId: string, b: ReviseQuoteBody) => post<QuoteWithRevision>(`/quotes/${quoteId}/revise`, b),
  releaseToSales: (quoteId: string, b: ReleaseToSalesBody) => post<QuoteRevision>(`/quotes/${quoteId}/release-to-sales`, b),

  // Shared
  items: (p?: { status?: ItemStatus; search?: string }) => get<Item[]>('/masters/items', p),
  /** POST /uploads (multipart field `file`) → { file_uri: "/api/uploads/<id>", … }. Types: jpeg/png/webp/heic/heif/mp4/mov/pdf. */
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post<Upload>('/uploads', fd, {
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => r.data);
  },
};

// ------------------------------------------------------------------ query keys
export const pk = {
  all: ['purchase'] as const,
  receipt: (id: string) => ['purchase', 'receipt', id] as const,
  job: (id: string) => ['purchase', 'job', id] as const,
  stockChecks: (jobId: string) => ['purchase', 'job', jobId, 'stock-checks'] as const,
  shortages: (jobId: string) => ['purchase', 'job', jobId, 'shortages'] as const,
  rfqs: (jobId: string) => ['purchase', 'job', jobId, 'rfqs'] as const,
  rfq: (id: string) => ['purchase', 'rfq', id] as const,
  quotes: (jobId: string) => ['purchase', 'job', jobId, 'quotes'] as const,
  quote: (id: string) => ['purchase', 'quote', id] as const,
  items: (p?: { status?: ItemStatus; search?: string }) => ['purchase', 'items', p?.status ?? null, p?.search ?? ''] as const,
};

const inv = (qc: QueryClient, ...keys: readonly (readonly unknown[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));

// ------------------------------------------------------------------ queries
/** GET /auth/me — same cache entry as AuthProvider (['me']). Prefer useMe() from AuthProvider in components. */
export const useAuthMe = () => useQuery({ queryKey: ['me'], queryFn: purchaseApi.me, staleTime: 60_000 });

export const useReceipt = (id: string | undefined) =>
  useQuery({ queryKey: pk.receipt(id ?? ''), queryFn: () => purchaseApi.receipt(id!), enabled: !!id });
export const useJob = (id: string | undefined) =>
  useQuery({ queryKey: pk.job(id ?? ''), queryFn: () => purchaseApi.job(id!), enabled: !!id });
export const useStockChecks = (jobId: string | undefined) =>
  useQuery({ queryKey: pk.stockChecks(jobId ?? ''), queryFn: () => purchaseApi.stockChecks(jobId!), enabled: !!jobId });
export const useShortages = (jobId: string | undefined) =>
  useQuery({ queryKey: pk.shortages(jobId ?? ''), queryFn: () => purchaseApi.shortages(jobId!), enabled: !!jobId });
export const useRfqs = (jobId: string | undefined) =>
  useQuery({ queryKey: pk.rfqs(jobId ?? ''), queryFn: () => purchaseApi.rfqs(jobId!), enabled: !!jobId });
export const useRfq = (id: string | undefined) =>
  useQuery({ queryKey: pk.rfq(id ?? ''), queryFn: () => purchaseApi.rfq(id!), enabled: !!id });
export const useQuotes = (jobId: string | undefined) =>
  useQuery({ queryKey: pk.quotes(jobId ?? ''), queryFn: () => purchaseApi.quotes(jobId!), enabled: !!jobId });
export const useQuote = (id: string | undefined) =>
  useQuery({ queryKey: pk.quote(id ?? ''), queryFn: () => purchaseApi.quote(id!), enabled: !!id });
/** GET /masters/items?status=&search= (server caps the list; filter is server-side). */
export const useItems = (p?: { status?: ItemStatus; search?: string }, enabled = true) =>
  useQuery({ queryKey: pk.items(p), queryFn: () => purchaseApi.items(p), enabled });

// ------------------------------------------------------------------ BR-02 mutations
/** POST /inward-receipts. Returns the header row (jin_number assigned by the DB). Navigate to /p/inward/{id} after. */
export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateReceiptBody) => purchaseApi.createReceipt(b),
    onSuccess: (r) => inv(qc, pk.receipt(r.id)),
  });
}
export function useAddEquipmentGroup(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: AddGroupBody) => purchaseApi.addGroup(receiptId, b),
    onSuccess: () => inv(qc, pk.receipt(receiptId)),
  });
}
export function useExpandGroup(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { groupId: string; body: ExpandGroupBody }) => purchaseApi.expandGroup(v.groupId, v.body),
    onSuccess: () => inv(qc, pk.receipt(receiptId)),
  });
}
export function useAddUnitPhoto(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { unitId: string; body: AddUnitPhotoBody }) => purchaseApi.addUnitPhoto(v.unitId, v.body),
    onSuccess: () => inv(qc, pk.receipt(receiptId)),
  });
}
/** POST /equipment-units/{id}/verify — photo-gated in the DB; allocates the Job ID. */
export function useVerifyUnit(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => purchaseApi.verifyUnit(unitId),
    onSuccess: (r) => inv(qc, pk.receipt(receiptId), pk.job(r.job.id)),
  });
}
export function useAssignEngineer(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: AssignEngineerBody) => purchaseApi.assignEngineer(jobId, b),
    onSuccess: () => inv(qc, pk.job(jobId)),
  });
}

// ------------------------------------------------------------------ BR-04 mutations
export function useRunStockCheck(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: StockCheckBody) => purchaseApi.runStockCheck(jobId, b),
    onSuccess: () => inv(qc, pk.stockChecks(jobId), pk.shortages(jobId)),
  });
}
export function useCreateRfq(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateRfqBody) => purchaseApi.createRfq(jobId, b),
    onSuccess: () => inv(qc, pk.rfqs(jobId), pk.shortages(jobId)),
  });
}
/** `jobId` (optional) also refreshes that job's RFQ list (status column). */
export function useAddSupplierInvite(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: SupplierInviteBody) => purchaseApi.addSupplierInvite(rfqId, b),
    onSuccess: () => inv(qc, pk.rfq(rfqId), ...(jobId ? [pk.rfqs(jobId)] : [])),
  });
}
export function useRecordOffer(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RecordOfferBody) => purchaseApi.recordOffer(rfqId, b),
    onSuccess: () => inv(qc, pk.rfq(rfqId), ...(jobId ? [pk.rfqs(jobId), pk.shortages(jobId)] : [])),
  });
}
export function useMarkOfferValidity(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { offerLineId: string; body: MarkOfferValidityBody }) => purchaseApi.markOfferValidity(v.offerLineId, v.body),
    onSuccess: () => inv(qc, pk.rfq(rfqId), ...(jobId ? [pk.shortages(jobId)] : [])),
  });
}
export function useCreateQuote(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateQuoteBody) => purchaseApi.createQuote(jobId, b),
    onSuccess: (q) => inv(qc, pk.quotes(jobId), pk.quote(q.id)),
  });
}
export function useReviseQuote(quoteId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReviseQuoteBody) => purchaseApi.reviseQuote(quoteId, b),
    onSuccess: (q) => inv(qc, pk.quote(quoteId), pk.quotes(jobId ?? q.job_id)),
  });
}
export function useReleaseToSales(quoteId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReleaseToSalesBody) => purchaseApi.releaseToSales(quoteId, b),
    onSuccess: () => inv(qc, pk.quote(quoteId), ...(jobId ? [pk.quotes(jobId)] : [])),
  });
}

// ------------------------------------------------------------------ uploads
/** POST /uploads. mutate({ file, onProgress }) → UploadResult; pass result.file_uri / original_name to the photo endpoints. */
export function useUpload() {
  return useMutation({
    mutationFn: (v: { file: File; onProgress?: (pct: number) => void }) => purchaseApi.upload(v.file, v.onProgress),
  });
}
