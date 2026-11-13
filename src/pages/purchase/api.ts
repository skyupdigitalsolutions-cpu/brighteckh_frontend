// Purchase desktop data layer — one typed function + TanStack hook per endpoint the Purchase screens use.
// Shapes are the generated OpenAPI types (src/api/schema.d.ts); paths are relative to the /api base in http.ts.
// Every BR-02 / BR-04 write here is @Roles('PURCHASE') on the backend.
//
// Purchase desk reads (backend migration 024, backend CLAUDE.md §4i "Purchase desk reads") closed G14–G22:
// lists GET /inward-receipts, /jobs, /rfqs, /quotes · lookups GET /lookups/* · GET /equipment-units/:id/photos ·
// PATCH /equipment-units/:id · GET /jobs/:id/progress · GET /overview/purchase.
// Still not in the API (use GapNote): G23 notifications, G24 global search.
//
// Lists + lookups are server-paginated → { rows, total, page, page_size } (page_size max 100, unknown params = 400).
// Enum filters take one value or an array (sent comma-separated). Debounce search text with useDebouncedValue
// (src/lib/useDebouncedValue) before it reaches a hook.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { S } from '../../api/types';
import type { operations } from '../../api/schema';
import type { LookupSource } from '../../ui/desktop/LookupPicker';

const get = <T>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);
const patch = <T>(url: string, body: unknown) => http.patch<T>(url, body).then((r) => r.data);

/** Drops empty params; arrays → comma-separated (the API's multi-value format). */
function qs(p: object | undefined): Record<string, string | number> | undefined {
  if (!p) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

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

// Purchase desk reads (024)
export type Page<T> = { rows: T[]; total: number; page: number; page_size: number };
export type ReceiptListRow = S<'ReceiptListRow'>;
export type ReceiptListPage = S<'ReceiptListPage'>;
export type JobListRow = S<'JobListRow'>;
export type JobListPage = S<'JobListPage'>;
export type RfqListRow = S<'RfqListRow'>;
export type RfqListPage = S<'RfqListPage'>;
export type QuoteListRow = S<'QuoteListRow'>;
export type QuoteListPage = S<'QuoteListPage'>;
export type CustomerLookupRow = S<'CustomerLookupRow'>;
export type EngineerLookupRow = S<'EngineerLookupRow'>;
export type EmployeeLookupRow = S<'EmployeeLookupRow'>;
export type AssemblyLookupRow = S<'AssemblyLookupRow'>;
export type CustodyLocationLookupRow = S<'CustodyLocationLookupRow'>;
export type ItemBridgeLookupRow = S<'ItemBridgeLookupRow'>;
export type JobProgress = S<'JobProgress'>;
export type JobProgressStage = S<'JobProgressStage'>;
export type JobAssignmentHistoryRow = S<'JobAssignmentHistoryRow'>;
export type PurchaseOverview = S<'PurchaseOverview'>;

export type CreateReceiptBody = S<'CreateInwardReceiptDto'>;
export type AddGroupBody = S<'CreateEquipmentGroupDto'>;
export type ExpandGroupBody = S<'ExpandEquipmentGroupDto'>;
export type AddUnitPhotoBody = S<'AddUnitPhotoDto'>;
export type UpdateUnitBody = S<'UpdateEquipmentUnitDto'>;
export type AssignEngineerBody = S<'AssignEngineerDto'>;
export type StockCheckBody = S<'StockCheckDto'>;
export type CreateRfqBody = S<'CreateRfqDto'>;
export type RfqLineBody = S<'RfqLineDto'>;
export type SupplierInviteBody = S<'SupplierInviteDto'>;
export type RecordOfferBody = S<'RecordOfferDto'>;
export type OfferLineBody = S<'OfferLineDto'>;
export type MarkOfferValidityBody = S<'MarkOfferValidityDto'>;
/** BR-04 POST /jobs/{id}/quotes. `lines` are RepairQuoteLineDto (numeric rupee amounts). */
export type CreateQuoteBody = S<'CreateQuoteDto'>;
/** BR-04 POST /quotes/{id}/revise. `lines` are RepairQuoteLineDto. */
export type ReviseQuoteBody = S<'ReviseQuoteDto'>;
/** BR-04 repair-quote line { line_type, line_description, quantity, uom, net_unit_price_pre_tax (rupees), … }.
 *  The backend renamed it from QuoteLineDto (which in the schema is now ONLY the BR-11 sales-quote line). */
export type RepairQuoteLineBody = S<'RepairQuoteLineDto'>;
/** Alias kept for existing imports — the BR-04 repair line, NOT the schema's BR-11 `QuoteLineDto`. */
export type QuoteLineBody = RepairQuoteLineBody;
export type ReleaseToSalesBody = S<'ReleaseToSalesDto'>;

// ------------------------------------------------------------------ list / lookup params (from the schema)
type QueryOf<K extends keyof operations> = NonNullable<operations[K]['parameters']['query']>;
/** Enum filters K become `V | V[]` (the API takes comma-separated values). */
type Multi<Q, K extends keyof Q> = Omit<Q, K> & { [P in K]?: NonNullable<Q[P]> | NonNullable<Q[P]>[] };
type Lookup<K extends keyof operations, M extends keyof QueryOf<K> = never> =
  Omit<Multi<QueryOf<K>, M>, 'ids'> & { ids?: string[] };

/** status, priority (one or many), month 'YYYY-MM', search (JIN, customer name/code, DC no.), page, page_size. */
export type ReceiptsListParams = Multi<QueryOf<'PurchaseDeskBr02Controller_listReceipts'>, 'status' | 'priority'>;
/** status, priority, engineer_id (uuid | 'unassigned'), search (job, JIN, serial, make, model, assembly, customer). */
export type JobsListParams = Multi<QueryOf<'PurchaseDeskBr02Controller_listJobs'>, 'status' | 'priority'>;
/** status, job_id, search. PURCHASE only. */
export type RfqsListParams = Multi<QueryOf<'PurchaseDeskBr04Controller_listRfqs'>, 'status'>;
/** status (latest revision), job_id, search. */
export type QuotesListParams = Multi<QueryOf<'PurchaseDeskBr04Controller_listQuotes'>, 'status'>;
/** Default status = PENDING_APPROVAL,APPROVED (what a JIN accepts). */
export type CustomerLookupParams = Lookup<'LookupsController_customers', 'status'>;
export type EngineerLookupParams = Lookup<'LookupsController_engineers'>;
export type EmployeeLookupParams = Lookup<'LookupsController_employees', 'role'>;
/** Default status = PENDING_APPROVAL,APPROVED (what an equipment group accepts). */
export type AssemblyLookupParams = Lookup<'LookupsController_assemblies', 'status'>;
export type CustodyLocationLookupParams = Lookup<'LookupsController_custodyLocations'>;
/** The API requires `ids` or `search`. */
export type ItemBridgeLookupParams = Lookup<'LookupsController_itemBridge'>;
export type EmployeeRole = NonNullable<QueryOf<'LookupsController_employees'>['role']>;

export type LookupKind = 'customers' | 'engineers' | 'employees' | 'assemblies' | 'custody-locations' | 'item-bridge';
type LookupRowOf = {
  customers: CustomerLookupRow; engineers: EngineerLookupRow; employees: EmployeeLookupRow;
  assemblies: AssemblyLookupRow; 'custody-locations': CustodyLocationLookupRow; 'item-bridge': ItemBridgeLookupRow;
};
type LookupParamsOf = {
  customers: CustomerLookupParams; engineers: EngineerLookupParams; employees: EmployeeLookupParams;
  assemblies: AssemblyLookupParams; 'custody-locations': CustodyLocationLookupParams; 'item-bridge': ItemBridgeLookupParams;
};
/** Row id per lookup (item-bridge rows are keyed by item_bridge_id). */
export const lookupId = {
  customers: (r: CustomerLookupRow) => r.id,
  engineers: (r: EngineerLookupRow) => r.id,
  employees: (r: EmployeeLookupRow) => r.id,
  assemblies: (r: AssemblyLookupRow) => r.id,
  'custody-locations': (r: CustodyLocationLookupRow) => r.id,
  'item-bridge': (r: ItemBridgeLookupRow) => r.item_bridge_id,
} satisfies { [K in LookupKind]: (r: LookupRowOf[K]) => string };

// ------------------------------------------------------------------ raw calls
export const purchaseApi = {
  me: () => get<Me>('/auth/me'),

  // BR-02
  receiptsList: (p?: ReceiptsListParams) => get<ReceiptListPage>('/inward-receipts', qs(p)),
  createReceipt: (b: CreateReceiptBody) => post<InwardReceiptRow>('/inward-receipts', b),
  receipt: (id: string) => get<InwardReceipt>(`/inward-receipts/${id}`),
  addGroup: (receiptId: string, b: AddGroupBody) => post<EquipmentGroup>(`/inward-receipts/${receiptId}/equipment-groups`, b),
  expandGroup: (groupId: string, b: ExpandGroupBody) => post<ExpandGroupResult>(`/equipment-groups/${groupId}/expand`, b),
  unitPhotos: (unitId: string) => get<EquipmentPhoto[]>(`/equipment-units/${unitId}/photos`),
  addUnitPhoto: (unitId: string, b: AddUnitPhotoBody) => post<EquipmentPhoto>(`/equipment-units/${unitId}/photos`, b),
  /** Only while verification_status is PENDING/ON_HOLD (DB-enforced). Send only the changed fields. */
  updateUnit: (unitId: string, b: UpdateUnitBody) => patch<EquipmentUnit>(`/equipment-units/${unitId}`, b),
  verifyUnit: (unitId: string) => post<VerifyUnitResult>(`/equipment-units/${unitId}/verify`),
  jobsList: (p?: JobsListParams) => get<JobListPage>('/jobs', qs(p)),
  job: (id: string) => get<Job>(`/jobs/${id}`),
  jobProgress: (id: string) => get<JobProgress>(`/jobs/${id}/progress`),
  assignEngineer: (jobId: string, b: AssignEngineerBody) => post<JobAssignment>(`/jobs/${jobId}/assign`, b),
  overview: () => get<PurchaseOverview>('/overview/purchase'),

  // BR-04
  stockChecks: (jobId: string) => get<StockCheck[]>(`/jobs/${jobId}/stock-checks`),
  runStockCheck: (jobId: string, b: StockCheckBody) => post<StockCheck>(`/jobs/${jobId}/stock-checks`, b),
  shortages: (jobId: string) => get<Shortage[]>(`/jobs/${jobId}/shortages`),
  rfqsList: (p?: RfqsListParams) => get<RfqListPage>('/rfqs', qs(p)),
  rfqs: (jobId: string) => get<RfqRow[]>(`/jobs/${jobId}/rfqs`),
  createRfq: (jobId: string, b: CreateRfqBody) => post<RfqCreated>(`/jobs/${jobId}/rfqs`, b),
  rfq: (id: string) => get<Rfq>(`/rfqs/${id}`),
  addSupplierInvite: (rfqId: string, b: SupplierInviteBody) => post<SupplierInvite>(`/rfqs/${rfqId}/supplier-invites`, b),
  recordOffer: (rfqId: string, b: RecordOfferBody) => post<OfferRecorded>(`/rfqs/${rfqId}/offers`, b),
  markOfferValidity: (offerLineId: string, b: MarkOfferValidityBody) => post<OfferLine>(`/offer-lines/${offerLineId}/mark-validity`, b),
  quotesList: (p?: QuotesListParams) => get<QuoteListPage>('/quotes', qs(p)),
  quotes: (jobId: string) => get<QuoteRow[]>(`/jobs/${jobId}/quotes`),
  createQuote: (jobId: string, b: CreateQuoteBody) => post<QuoteWithRevision>(`/jobs/${jobId}/quotes`, b),
  quote: (id: string) => get<Quote>(`/quotes/${id}`),
  reviseQuote: (quoteId: string, b: ReviseQuoteBody) => post<QuoteWithRevision>(`/quotes/${quoteId}/revise`, b),
  releaseToSales: (quoteId: string, b: ReleaseToSalesBody) => post<QuoteRevision>(`/quotes/${quoteId}/release-to-sales`, b),

  // Lookups (GET /lookups/{kind}); all take ids= (max 100) for resolving stored ids to names.
  lookup: <K extends LookupKind>(kind: K, p?: LookupParamsOf[K]) => get<Page<LookupRowOf[K]>>(`/lookups/${kind}`, qs(p)),

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
// Prefix keys (receiptsLists, jobsLists, rfqsLists, quotesLists, lookups(kind)) are for invalidation;
// the param-specific keys sit under them.
export const pk = {
  all: ['purchase'] as const,
  receiptsLists: ['purchase', 'receipts-list'] as const,
  receiptsList: (p?: ReceiptsListParams) => ['purchase', 'receipts-list', qs(p) ?? {}] as const,
  receipt: (id: string) => ['purchase', 'receipt', id] as const,
  unitPhotos: (unitId: string) => ['purchase', 'unit', unitId, 'photos'] as const,
  jobsLists: ['purchase', 'jobs-list'] as const,
  jobsList: (p?: JobsListParams) => ['purchase', 'jobs-list', qs(p) ?? {}] as const,
  job: (id: string) => ['purchase', 'job', id] as const,
  /** Nested under pk.job(id), so invalidating the job also refreshes its progress. */
  jobProgress: (id: string) => ['purchase', 'job', id, 'progress'] as const,
  overview: ['purchase', 'overview'] as const,
  stockChecks: (jobId: string) => ['purchase', 'job', jobId, 'stock-checks'] as const,
  shortages: (jobId: string) => ['purchase', 'job', jobId, 'shortages'] as const,
  rfqsLists: ['purchase', 'rfqs-list'] as const,
  rfqsList: (p?: RfqsListParams) => ['purchase', 'rfqs-list', qs(p) ?? {}] as const,
  rfqs: (jobId: string) => ['purchase', 'job', jobId, 'rfqs'] as const,
  rfq: (id: string) => ['purchase', 'rfq', id] as const,
  quotesLists: ['purchase', 'quotes-list'] as const,
  quotesList: (p?: QuotesListParams) => ['purchase', 'quotes-list', qs(p) ?? {}] as const,
  quotes: (jobId: string) => ['purchase', 'job', jobId, 'quotes'] as const,
  quote: (id: string) => ['purchase', 'quote', id] as const,
  lookups: (kind: LookupKind) => ['purchase', 'lookup', kind] as const,
  lookup: (kind: LookupKind, p?: object) => ['purchase', 'lookup', kind, qs(p) ?? {}] as const,
  /** By-ids resolve; ids sorted so order doesn't split the cache. */
  lookupIds: (kind: LookupKind, ids: string[], extra?: object) =>
    ['purchase', 'lookup', kind, 'ids', [...ids].sort().join(','), qs(extra) ?? {}] as const,
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

// ---- Purchase desk lists (server pagination; previous page stays on screen while the next loads → `isPlaceholderData`)
/** GET /inward-receipts — inward register (PURCHASE, MANAGEMENT). Newest receipt_at first. */
export const useInwardReceiptsList = (p: ReceiptsListParams = {}, enabled = true) =>
  useQuery({ queryKey: pk.receiptsList(p), queryFn: () => purchaseApi.receiptsList(p), enabled, placeholderData: keepPreviousData });
/** GET /jobs — Purchase jobs list (PURCHASE, MANAGEMENT). */
export const useJobsList = (p: JobsListParams = {}, enabled = true) =>
  useQuery({ queryKey: pk.jobsList(p), queryFn: () => purchaseApi.jobsList(p), enabled, placeholderData: keepPreviousData });
/** GET /rfqs — cross-job RFQ list (PURCHASE). Counts only, no prices. */
export const useRfqsList = (p: RfqsListParams = {}, enabled = true) =>
  useQuery({ queryKey: pk.rfqsList(p), queryFn: () => purchaseApi.rfqsList(p), enabled, placeholderData: keepPreviousData });
/** GET /quotes — cross-job quote list (PURCHASE, MANAGEMENT); status filter matches the LATEST revision. */
export const useQuotesList = (p: QuotesListParams = {}, enabled = true) =>
  useQuery({ queryKey: pk.quotesList(p), queryFn: () => purchaseApi.quotesList(p), enabled, placeholderData: keepPreviousData });

/** GET /equipment-units/{id}/photos — oldest first. */
export const useUnitPhotos = (unitId: string | undefined) =>
  useQuery({ queryKey: pk.unitPhotos(unitId ?? ''), queryFn: () => purchaseApi.unitPhotos(unitId!), enabled: !!unitId });
/** GET /jobs/{id}/progress — 10 derived stages + assignment history (PURCHASE, MANAGEMENT). */
export const useJobProgress = (jobId: string | undefined) =>
  useQuery({ queryKey: pk.jobProgress(jobId ?? ''), queryFn: () => purchaseApi.jobProgress(jobId!), enabled: !!jobId });
/** GET /overview/purchase — raw counts for the Purchase dashboard (no targets). */
export const usePurchaseOverview = () =>
  useQuery({ queryKey: pk.overview, queryFn: purchaseApi.overview, staleTime: 30_000 });

// ---- Lookups
// Search hooks: pass `enabled=false` while a picker is closed. Resolve hooks (`use…ByIds`) return
// Record<id, row> so stored ids render as names; they are disabled for an empty id list.
const LOOKUP_STALE = 30_000;
const MAX_IDS = 100;

function useLookup<K extends LookupKind>(kind: K, p: LookupParamsOf[K], enabled: boolean) {
  return useQuery({
    queryKey: pk.lookup(kind, p),
    queryFn: () => purchaseApi.lookup(kind, p),
    enabled,
    staleTime: LOOKUP_STALE,
    placeholderData: keepPreviousData,
  });
}

function useLookupByIds<K extends LookupKind>(kind: K, ids: readonly (string | null | undefined)[], extra?: Omit<LookupParamsOf[K], 'ids' | 'search' | 'page' | 'page_size'>) {
  const clean = Array.from(new Set(ids.filter((x): x is string => !!x)));
  return useQuery({
    queryKey: pk.lookupIds(kind, clean, extra),
    enabled: clean.length > 0,
    staleTime: LOOKUP_STALE,
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < clean.length; i += MAX_IDS) chunks.push(clean.slice(i, i + MAX_IDS));
      const pages = await Promise.all(chunks.map((c) =>
        purchaseApi.lookup(kind, { ...extra, ids: c, page_size: MAX_IDS } as LookupParamsOf[K])));
      const idOf = lookupId[kind] as (r: LookupRowOf[K]) => string;
      const out: Record<string, LookupRowOf[K]> = {};
      for (const pg of pages) for (const r of pg.rows) out[idOf(r)] = r;
      return out;
    },
  });
}

/** GET /lookups/customers (PURCHASE, SALES). Default statuses PENDING_APPROVAL,APPROVED. No contact/GST fields. */
export const useCustomerLookup = (p: CustomerLookupParams = {}, enabled = true) => useLookup('customers', p, enabled);
/** Resolve customer ids → rows. Pass `status` to include INACTIVE/REJECTED (the default filter would hide them). */
export const useCustomersByIds = (ids: readonly (string | null | undefined)[], extra?: Pick<CustomerLookupParams, 'status'>) =>
  useLookupByIds('customers', ids, extra ?? { status: ['PENDING_APPROVAL', 'APPROVED', 'INACTIVE', 'REJECTED'] });

/** GET /lookups/engineers (PURCHASE): active ENGINEERs + open_jobs / pending_custody. */
export const useEngineerLookup = (p: EngineerLookupParams = {}, enabled = true) => useLookup('engineers', p, enabled);
export const useEngineersByIds = (ids: readonly (string | null | undefined)[]) => useLookupByIds('engineers', ids);

/** GET /lookups/employees?role= (PURCHASE): active employees, optional role filter (one or many). */
export const useEmployeeLookup = (p: EmployeeLookupParams = {}, enabled = true) => useLookup('employees', p, enabled);
export const useEmployeesByIds = (ids: readonly (string | null | undefined)[]) => useLookupByIds('employees', ids);

/** GET /lookups/assemblies (PURCHASE): the shared `assemblies` table (equipment groups), not fdn_assembly_master. */
export const useAssemblyLookup = (p: AssemblyLookupParams = {}, enabled = true) => useLookup('assemblies', p, enabled);
export const useAssembliesByIds = (ids: readonly (string | null | undefined)[], extra?: Pick<AssemblyLookupParams, 'status'>) =>
  useLookupByIds('assemblies', ids, extra ?? { status: ['PENDING_APPROVAL', 'APPROVED', 'INACTIVE', 'REJECTED'] });

/** GET /lookups/custody-locations (PURCHASE): active locations + units_here. */
export const useCustodyLocationLookup = (p: CustodyLocationLookupParams = {}, enabled = true) => useLookup('custody-locations', p, enabled);
export const useCustodyLocationsByIds = (ids: readonly (string | null | undefined)[]) => useLookupByIds('custody-locations', ids);

/** GET /lookups/item-bridge (PURCHASE). The API needs `ids` or `search`, so this is disabled until one is set.
 *  Rows are keyed by `item_bridge_id`. */
export const useItemBridgeLookup = (p: ItemBridgeLookupParams = {}, enabled = true) =>
  useLookup('item-bridge', p, enabled && (!!p.search?.trim() || !!p.ids?.length));
export const useItemBridgeByIds = (ids: readonly (string | null | undefined)[]) => useLookupByIds('item-bridge', ids);

// ------------------------------------------------------------------ BR-02 mutations
/** POST /inward-receipts. Returns the header row (jin_number assigned by the DB). Navigate to /p/inward/{id} after. */
export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateReceiptBody) => purchaseApi.createReceipt(b),
    onSuccess: (r) => inv(qc, pk.receipt(r.id), pk.receiptsLists, pk.overview),
  });
}
export function useAddEquipmentGroup(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: AddGroupBody) => purchaseApi.addGroup(receiptId, b),
    onSuccess: () => inv(qc, pk.receipt(receiptId), pk.receiptsLists, pk.overview),
  });
}
export function useExpandGroup(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { groupId: string; body: ExpandGroupBody }) => purchaseApi.expandGroup(v.groupId, v.body),
    onSuccess: () => inv(qc, pk.receipt(receiptId), pk.receiptsLists, pk.lookups('custody-locations'), pk.overview),
  });
}
export function useAddUnitPhoto(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { unitId: string; body: AddUnitPhotoBody }) => purchaseApi.addUnitPhoto(v.unitId, v.body),
    onSuccess: (_r, v) => inv(qc, pk.receipt(receiptId), pk.unitPhotos(v.unitId)),
  });
}
/** PATCH /equipment-units/{id} — serial/make/model/fault/condition/accessories, before verification only. */
export function useUpdateUnit(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { unitId: string; body: UpdateUnitBody }) => purchaseApi.updateUnit(v.unitId, v.body),
    onSuccess: () => inv(qc, pk.receipt(receiptId), pk.receiptsLists),
  });
}
/** POST /equipment-units/{id}/verify — photo-gated in the DB; allocates the Job ID. */
export function useVerifyUnit(receiptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => purchaseApi.verifyUnit(unitId),
    onSuccess: (r) => inv(qc, pk.receipt(receiptId), pk.job(r.job.id), pk.receiptsLists, pk.jobsLists, pk.overview),
  });
}
/** POST /jobs/{id}/assign — also refreshes the jobs list, the engineers lookup (open_jobs) and the overview. */
export function useAssignEngineer(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: AssignEngineerBody) => purchaseApi.assignEngineer(jobId, b),
    onSuccess: () => inv(qc, pk.job(jobId), pk.jobsLists, pk.lookups('engineers'), pk.overview),
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
    onSuccess: () => inv(qc, pk.rfqs(jobId), pk.shortages(jobId), pk.rfqsLists),
  });
}
/** `jobId` (optional) also refreshes that job's RFQ list (status column). */
export function useAddSupplierInvite(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: SupplierInviteBody) => purchaseApi.addSupplierInvite(rfqId, b),
    onSuccess: () => inv(qc, pk.rfq(rfqId), pk.rfqsLists, ...(jobId ? [pk.rfqs(jobId)] : [])),
  });
}
export function useRecordOffer(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RecordOfferBody) => purchaseApi.recordOffer(rfqId, b),
    onSuccess: () => inv(qc, pk.rfq(rfqId), pk.rfqsLists, ...(jobId ? [pk.rfqs(jobId), pk.shortages(jobId)] : [])),
  });
}
export function useMarkOfferValidity(rfqId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { offerLineId: string; body: MarkOfferValidityBody }) => purchaseApi.markOfferValidity(v.offerLineId, v.body),
    onSuccess: () => inv(qc, pk.rfq(rfqId), pk.rfqsLists, ...(jobId ? [pk.shortages(jobId)] : [])),
  });
}
/** POST /jobs/{id}/quotes — BR-04 body (CreateQuoteDto with RepairQuoteLineDto lines). */
export function useCreateQuote(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateQuoteBody) => purchaseApi.createQuote(jobId, b),
    onSuccess: (q) => inv(qc, pk.quotes(jobId), pk.quote(q.id), pk.quotesLists),
  });
}
/** POST /quotes/{id}/revise — BR-04 body (ReviseQuoteDto). >10 % below the original authorised price needs
 *  higher_discount_approved_by_id + higher_discount_reason (open decision, DB-enforced). */
export function useReviseQuote(quoteId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReviseQuoteBody) => purchaseApi.reviseQuote(quoteId, b),
    onSuccess: (q) => inv(qc, pk.quote(quoteId), pk.quotes(jobId ?? q.job_id), pk.quotesLists),
  });
}
export function useReleaseToSales(quoteId: string, jobId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReleaseToSalesBody) => purchaseApi.releaseToSales(quoteId, b),
    onSuccess: () => inv(qc, pk.quote(quoteId), pk.quotesLists, ...(jobId ? [pk.quotes(jobId)] : [])),
  });
}

// ------------------------------------------------------------------ uploads
/** POST /uploads. mutate({ file, onProgress }) → UploadResult; pass result.file_uri / original_name to the photo endpoints. */
export function useUpload() {
  return useMutation({
    mutationFn: (v: { file: File; onProgress?: (pct: number) => void }) => purchaseApi.upload(v.file, v.onProgress),
  });
}

// ------------------------------------------------------------------ picker sources (LookupPicker / LookupRadioList)
// Each source = search hook (25 rows) + by-ids resolve + accessors. Module-level constants, so they are stable.
const PICK_PAGE = 25;
const pendingNote = (status: string) => (status === 'APPROVED' ? '' : ` · ${status.replace(/_/g, ' ').toLowerCase()}`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Customers (JIN-acceptable statuses). Label = name; sub = code (+ "pending approval"). */
export const customerSource: LookupSource<CustomerLookupRow> = {
  useSearch: (search, enabled) => useCustomerLookup({ search, page_size: PICK_PAGE }, enabled),
  useResolve: (ids) => useCustomersByIds(ids),
  getId: (r) => r.id,
  getLabel: (r) => r.customer_name,
  getSub: (r) => `${r.customer_code}${pendingNote(r.status)}`,
  noun: 'customers',
};

/** Assemblies (the shared `assemblies` table). Label = name; sub = code (+ status, + "not repairable"). */
export const assemblySource: LookupSource<AssemblyLookupRow> = {
  useSearch: (search, enabled) => useAssemblyLookup({ search, page_size: PICK_PAGE }, enabled),
  useResolve: (ids) => useAssembliesByIds(ids),
  getId: (r) => r.id,
  getLabel: (r) => r.assembly_name,
  getSub: (r) => `${r.assembly_code}${pendingNote(r.status)}${r.repairable ? '' : ' · not repairable'}`,
  noun: 'assemblies',
};

/** Custody / store locations. Label = name; sub = code · n units here. */
export const custodyLocationSource: LookupSource<CustodyLocationLookupRow> = {
  useSearch: (search, enabled) => useCustodyLocationLookup({ search, page_size: PICK_PAGE }, enabled),
  useResolve: (ids) => useCustodyLocationsByIds(ids),
  getId: (r) => r.id,
  getLabel: (r) => r.location_name,
  getSub: (r) => `${r.location_code} · ${plural(r.units_here, 'unit', 'units')} here`,
  noun: 'locations',
};

/** Active engineers. Sub = "n open jobs" (+ " · n awaiting custody") — the P2b card sub-line, as far as the API has data. */
export const engineerSource: LookupSource<EngineerLookupRow> = {
  useSearch: (search, enabled) => useEngineerLookup({ search, page_size: 50 }, enabled),
  useResolve: (ids) => useEngineersByIds(ids),
  getId: (r) => r.id,
  getLabel: (r) => r.full_name,
  getSub: (r) => plural(r.open_jobs, 'open job', 'open jobs') + (r.pending_custody > 0 ? ` · ${r.pending_custody} awaiting custody` : ''),
  noun: 'engineers',
};

const employeeSources = new Map<string, LookupSource<EmployeeLookupRow>>();
/** Active employees, optionally limited to role(s) (e.g. custodian = employeeSource(['STORES_QUALITY','PURCHASE'])).
 *  Memoised per role set, so the returned object is stable across renders. Sub = code · role. */
export function employeeSource(role?: EmployeeRole | EmployeeRole[]): LookupSource<EmployeeLookupRow> {
  const roles = role === undefined ? [] : Array.isArray(role) ? [...role].sort() : [role];
  const key = roles.join(',');
  let src = employeeSources.get(key);
  if (!src) {
    src = {
      useSearch: (search, enabled) => useEmployeeLookup({ search, page_size: PICK_PAGE, ...(roles.length ? { role: roles } : {}) }, enabled),
      useResolve: (ids) => useEmployeesByIds(ids),
      getId: (r) => r.id,
      getLabel: (r) => r.full_name,
      getSub: (r) => `${r.employee_code} · ${r.role_code.replace(/_/g, ' ').toLowerCase()}`,
      noun: 'employees',
    };
    employeeSources.set(key, src);
  }
  return src;
}

/** Item catalogue bridge (needs ≥1 search character). id = item_bridge_id; label = name; sub = code · UOM (+ status). */
export const itemBridgeSource: LookupSource<ItemBridgeLookupRow> = {
  useSearch: (search, enabled) => useItemBridgeLookup({ search, page_size: PICK_PAGE }, enabled),
  useResolve: (ids) => useItemBridgeByIds(ids),
  getId: (r) => r.item_bridge_id,
  getLabel: (r) => r.item_name,
  getSub: (r) => `${r.item_code} · ${r.uom}${r.approval_status === 'APPROVED' && r.is_active ? '' : ` · ${r.approval_status.replace(/_/g, ' ').toLowerCase()}`}`,
  minSearch: 1,
  noun: 'items',
};
