// BR-11 Sales & Supply data layer (SS-D 237:40367 · PS-D 238:41629 · F-D 247:51039 · A-D 247:55207).
// Shared by every BR-11 screen; screens must not call http directly.
//
// Lists (desk reads, paginated, `counts_by_*` under `search` only):
//   GET /sales-supply/enquiries · /quotes (derived stage) · /orders (+advance_pending) · /outwards · /invoice-queue (Finance)
// Details: GET /sales-enquiries/:id · /sales-quotes/:id · /sales-orders/:id · /sales-outwards/:id · /sales-config
//   (Purchase only) GET /sales-orders/:id/sourcing-authorisations · /sales-orders/:id/purchase-orders
// Finance: GET /payments?customer_id= (receipt picker) · POST /sales-invoices/preview · POST /sales-invoices
// Money = paise as bigint STRINGS (formatPaise). Quantities = decimal strings (formatQty). Never float them.
// Supplier price exists ONLY on the Purchase-only sourcing / PO reads: never render it in a Sales / Finance view.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { components } from '../../api/schema';

type Schemas = components['schemas'];

// ------------------------------------------------------------------ types (generated)
export type EnquiryRow = Schemas['SupplyEnquiryRow'];
export type EnquiryPage = Schemas['SupplyEnquiryPage'];
export type EnquiryDetail = Schemas['EnquiryDetail'];
export type EnquiryStatus = EnquiryDetail['status'];
export type EnquiryChannel = EnquiryDetail['enquiry_channel'];
export type QuoteRow = Schemas['SupplyQuoteRow'];
export type QuotePage = Schemas['SupplyQuotePage'];
export type QuoteStage = QuoteRow['stage'];
export type QuoteDetail = Schemas['SalesQuoteDetail'];
export type QuoteRevision = Schemas['QuoteRevisionDetail'];
export type RevisionStatus = QuoteRevision['revision_status'];
export type QuoteLine = Schemas['Br11QuoteLinesRow'];
export type ResponseKind = Schemas['Br11CustomerQuoteResponsesRow']['response_kind'];
export type DispatchChannel = Schemas['Br11QuoteDispatchEventsRow']['channel'];
export type OrderRow = Schemas['SupplyOrderRow'];
export type OrderPage = Schemas['SupplyOrderPage'];
export type OrderDetail = Schemas['SalesOrderDetail'];
export type OrderStatus = OrderDetail['status'];
export type OrderLine = Schemas['Br11VSalesOrderLinesRow'];
export type Authorisation = Schemas['Br11OrderAuthorisationEventsRow'];
export type AuthorisationSource = Authorisation['source_kind'];
export type AuthorisationStatus = Authorisation['verified_status'];
export type PaymentTerms = Schemas['Br11OrderPaymentConditionsRow'];
export type AdvanceKind = PaymentTerms['advance_kind'];
export type Reservation = Schemas['Br11InventoryReservationRequestsRow'];
export type ReservationState = Reservation['state'];
export type ChangeRequest = Schemas['Br11SalesChangeRequestsRow'];
export type ChangeKind = ChangeRequest['change_kind'];
export type ChangeDecision = ChangeRequest['decision'];
export type SourcingAuthorisation = Schemas['Br06SalesSourcingAuthorisationsRow'];
export type SupplierPoRow = Schemas['Br06SupplierPurchaseOrdersRow'];
export type OutwardRow = Schemas['SupplyOutwardRow'];
export type OutwardPage = Schemas['SupplyOutwardPage'];
export type OutwardDetail = Schemas['OutwardDetail'];
export type OutwardStatus = OutwardDetail['status'];
export type OutwardLine = Schemas['OutwardLineDetail'];
export type OutwardLineStatus = OutwardLine['status'];
export type DispatchMode = OutwardDetail['dispatch_mode'];
export type PackingEvidenceKind = Schemas['Br11PackingEvidenceRow']['evidence_kind'];
export type DeliveryStatus = Schemas['Br11DeliveryEvidenceRow']['delivery_status'];
export type InvoiceQueuePage = Schemas['InvoiceQueuePage'];
export type InvoiceQueueRow = Schemas['InvoiceQueueRow'];
export type InvoiceReadiness = InvoiceQueueRow['readiness'];
export type InvoicePreview = Schemas['SalesInvoicePreview'];
export type InvoiceDetail = Schemas['InvoiceDetail'];
export type ReceiptPage = Schemas['PaymentReceiptListPage'];
export type ReceiptRow = Schemas['PaymentReceiptListRow'];
export type SalesConfig = Schemas['SalesConfigResponse'];
export type InvoiceTrigger = Schemas['SalesPolicyDto']['invoice_trigger'];

export type CreateEnquiryBody = Schemas['CreateEnquiryDto'];
export type CreateQuoteBody = Schemas['CreateSalesQuoteDto'];
export type CreateRevisionBody = Schemas['CreateRevisionDto'];
export type QuoteLineBody = Schemas['QuoteLineDto'];
export type QuoteDispatchBody = Schemas['QuoteDispatchDto'];
export type QuoteResponseBody = Schemas['QuoteResponseDto'];
export type CreateOrderBody = Schemas['CreateSalesOrderDto'];
export type AuthorisationBody = Schemas['OrderAuthorisationDto'];
export type PaymentTermsBody = Schemas['PaymentTermsDto'];
export type ConfirmAdvanceBody = Schemas['ConfirmAdvanceDto'];
export type SourcingBody = Schemas['CreateSalesSourcingDto'];
export type SalesOrderPoBody = Schemas['CreateSalesOrderPoDto'];
export type CreateOutwardBody = Schemas['CreateOutwardDto'];
export type PickBody = Schemas['PickDto'];
export type PackingEvidenceBody = Schemas['PackingEvidenceDto'];
export type DispatchOutwardBody = Schemas['DispatchOutwardDto'];
export type TrackingEventBody = Schemas['TrackingEventDto'];
export type DeliveryBody = Schemas['DeliveryEvidenceDto'];
export type ChangeRequestBody = Schemas['ChangeRequestDto'];
export type DecideChangeBody = Schemas['DecideChangeRequestDto'];
export type CloseOrderBody = Schemas['CloseOrderDto'];
export type SalesPolicyBody = Schemas['SalesPolicyDto'];
export type SalesInvoiceBody = Schemas['SalesInvoiceRequestDto'];

// ------------------------------------------------------------------ enum value lists (exact, from the contract)
export const ENQUIRY_STATUSES = ['RECEIVED', 'QUOTED', 'CANCELLED'] as const satisfies readonly EnquiryStatus[];
export const QUOTE_STAGES = ['TO_PRICE', 'ISSUED', 'WITH_CUSTOMER', 'ACCEPTED', 'PART_ACCEPTED', 'REJECTED', 'CANCELLED'] as const satisfies readonly QuoteStage[];
export const ORDER_STATUSES = ['DRAFT', 'VERIFIED', 'PART_DELIVERED', 'DELIVERED', 'CANCELLED', 'CLOSED'] as const satisfies readonly OrderStatus[];
export const OUTWARD_STATUSES = ['DRAFT', 'DISPATCHED', 'CANCELLED'] as const satisfies readonly OutwardStatus[];
export const INVOICE_READINESS = ['READY', 'WAITING', 'BLOCKED'] as const satisfies readonly InvoiceReadiness[];
export const ENQUIRY_CHANNELS = ['EMAIL', 'WHATSAPP', 'PHONE', 'WEBSITE', 'WALK_IN', 'REFERRAL', 'OTHER'] as const satisfies readonly EnquiryChannel[];
export const RESPONSE_KINDS = ['ENQUIRY', 'NEGOTIATING', 'ACCEPTED', 'PART_ACCEPTED', 'REJECTED', 'NO_RESPONSE'] as const satisfies readonly ResponseKind[];
export const DISPATCH_CHANNELS = ['EMAIL', 'WHATSAPP', 'PDF_PRINT', 'OTHER'] as const satisfies readonly DispatchChannel[];
export const PRODUCT_CONDITIONS = ['NEW', 'REFURBISHED', 'REPAIRED', 'OTHER'] as const satisfies readonly QuoteLine['product_condition'][];
export const AUTH_SOURCES = ['CUSTOMER_PO', 'ORDER_CONFIRMATION', 'EMAIL_AUTHORISATION'] as const satisfies readonly AuthorisationSource[];
export const ADVANCE_KINDS = ['NOT_REQUIRED', 'FIXED_AMOUNT', 'PERCENTAGE', 'FULL'] as const satisfies readonly AdvanceKind[];
export const CHANGE_KINDS = ['PRICE', 'QTY', 'CANCELLATION', 'SUBSTITUTION', 'BACKORDER_REMOVAL', 'DELIVERY_DATE', 'OTHER'] as const satisfies readonly ChangeKind[];
export const DISPATCH_MODES = ['COURIER', 'CUSTOMER_PICKUP', 'OWN_TRANSPORT', 'OTHER'] as const satisfies readonly DispatchMode[];
export const PACKING_EVIDENCE_KINDS = ['PHOTO', 'VIDEO', 'PACKING_LIST', 'SERIAL_LABEL', 'OTHER'] as const satisfies readonly PackingEvidenceKind[];
export const DELIVERY_STATUSES = ['DELIVERED', 'FAILED', 'DAMAGED'] as const satisfies readonly DeliveryStatus[];
/** SalesPolicyDto accepts MILESTONE, but the server refuses to invoice under it ("not modelled"). */
export const INVOICE_TRIGGERS = ['ADVANCE', 'DISPATCH', 'DELIVERY', 'MILESTONE'] as const satisfies readonly NonNullable<InvoiceTrigger>[];

// ------------------------------------------------------------------ fetch helpers
export type ListParams = { status?: string[]; stage?: string[]; readiness?: string[]; search?: string; page?: number; page_size?: number; advance_pending?: boolean };

function qs(p: object = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number | boolean;
  }
  return out;
}
const get = <T>(url: string, params?: object) => http.get<T>(url, { params: params ? qs(params) : undefined }).then((r) => r.data);
const post = <T>(url: string, body?: unknown, headers?: Record<string, string>) => http.post<T>(url, body ?? {}, { headers }).then((r) => r.data);
const put = <T>(url: string, body?: unknown) => http.put<T>(url, body ?? {}).then((r) => r.data);

export const supplyApi = {
  // lists
  enquiries: (p?: ListParams) => get<EnquiryPage>('/sales-supply/enquiries', p),
  quotes: (p?: ListParams) => get<QuotePage>('/sales-supply/quotes', p),
  orders: (p?: ListParams) => get<OrderPage>('/sales-supply/orders', p),
  outwards: (p?: ListParams) => get<OutwardPage>('/sales-supply/outwards', p),
  invoiceQueue: (p?: ListParams) => get<InvoiceQueuePage>('/sales-supply/invoice-queue', p),
  // details
  enquiry: (id: string) => get<EnquiryDetail>(`/sales-enquiries/${id}`),
  quote: (id: string) => get<QuoteDetail>(`/sales-quotes/${id}`),
  order: (id: string) => get<OrderDetail>(`/sales-orders/${id}`),
  outward: (id: string) => get<OutwardDetail>(`/sales-outwards/${id}`),
  config: () => get<SalesConfig>('/sales-config'),
  sourcingAuthorisations: (orderId: string) => get<SourcingAuthorisation[]>(`/sales-orders/${orderId}/sourcing-authorisations`),
  supplierPos: (orderId: string) => get<SupplierPoRow[]>(`/sales-orders/${orderId}/purchase-orders`),
  receipts: (p: { customer_id?: string; search?: string; page?: number; page_size?: number }) => get<ReceiptPage>('/payments', p),
  invoice: (id: string) => get<InvoiceDetail>(`/invoices/${id}`),
  // enquiry (SALES)
  createEnquiry: (b: CreateEnquiryBody) => post<EnquiryDetail>('/sales-enquiries', b),
  cancelEnquiry: (id: string, reason: string) => post<EnquiryDetail>(`/sales-enquiries/${id}/cancel`, { reason }),
  // quote (PURCHASE prices; SALES sends / records responses)
  createQuote: (b: CreateQuoteBody) => post<QuoteDetail>('/sales-quotes', b),
  createRevision: (quoteId: string, b: CreateRevisionBody) => post<QuoteDetail>(`/sales-quotes/${quoteId}/revisions`, b),
  addQuoteLine: (revisionId: string, b: QuoteLineBody) => post<QuoteLine>(`/sales-quote-revisions/${revisionId}/lines`, b),
  issueRevision: (revisionId: string) => post<QuoteDetail>(`/sales-quote-revisions/${revisionId}/issue`),
  cancelRevision: (revisionId: string) => post<QuoteDetail>(`/sales-quote-revisions/${revisionId}/cancel`),
  sendQuote: (revisionId: string, b: QuoteDispatchBody) => post<Schemas['Br11QuoteDispatchEventsRow']>(`/sales-quote-revisions/${revisionId}/dispatch`, b),
  recordResponse: (revisionId: string, b: QuoteResponseBody) => post<Schemas['Br11CustomerQuoteResponsesRow']>(`/sales-quote-revisions/${revisionId}/responses`, b),
  // order
  createOrder: (b: CreateOrderBody) => post<OrderDetail>('/sales-orders', b),
  addAuthorisation: (orderId: string, b: AuthorisationBody) => post<Authorisation>(`/sales-orders/${orderId}/authorisations`, b),
  verifyOrder: (orderId: string, authorisation_event_id: string) => post<OrderDetail>(`/sales-orders/${orderId}/verify`, { authorisation_event_id }),
  cancelDraftOrder: (orderId: string) => post<OrderDetail>(`/sales-orders/${orderId}/cancel`),
  recordPaymentTerms: (orderId: string, b: PaymentTermsBody) => post<PaymentTerms>(`/sales-orders/${orderId}/payment-terms`, b),
  confirmAdvance: (orderId: string, b: ConfirmAdvanceBody) => post<PaymentTerms>(`/sales-orders/${orderId}/payment-terms/confirm-advance`, b),
  /** `idempotencyKey`: one per user click (retries of the same click reuse it -> no double reservation). */
  reserve: (lineId: string, qty: number, idempotencyKey: string) =>
    post<Schemas['ReservationResult']>(`/sales-order-lines/${lineId}/reservations`, { qty }, { 'Idempotency-Key': idempotencyKey }),
  releaseReservation: (reservationId: string) => post<Reservation>(`/sales-reservations/${reservationId}/release`),
  authoriseSourcing: (lineId: string, b: SourcingBody) => post<SourcingAuthorisation>(`/sales-order-lines/${lineId}/sourcing-authorisations`, b),
  cancelSourcing: (id: string) => post<SourcingAuthorisation>(`/sales-sourcing-authorisations/${id}/cancel`),
  raiseSalesOrderPo: (orderId: string, b: SalesOrderPoBody) => post<Schemas['PurchaseOrderDetail']>(`/sales-orders/${orderId}/purchase-orders`, b),
  raiseChangeRequest: (orderId: string, b: ChangeRequestBody) => post<ChangeRequest>(`/sales-orders/${orderId}/change-requests`, b),
  decideChangeRequest: (id: string, b: DecideChangeBody) => post<Schemas['ChangeDecisionResult']>(`/sales-change-requests/${id}/decide`, b),
  closeOrder: (orderId: string, closure_reason: string) => post<OrderDetail>(`/sales-orders/${orderId}/close`, { closure_reason }),
  // outward (PURCHASE)
  createOutward: (b: CreateOutwardBody) => post<OutwardDetail>('/sales-outwards', b),
  pick: (lineId: string, b: PickBody) => post<Schemas['Br11OutwardLinesRow']>(`/sales-outward-lines/${lineId}/pick`, b),
  addPackingEvidence: (lineId: string, b: PackingEvidenceBody) => post<Schemas['Br11PackingEvidenceRow']>(`/sales-outward-lines/${lineId}/packing-evidence`, b),
  dispatchOutward: (id: string, b: DispatchOutwardBody) => post<OutwardDetail>(`/sales-outwards/${id}/dispatch`, b),
  cancelOutward: (id: string) => post<OutwardDetail>(`/sales-outwards/${id}/cancel`),
  addTrackingEvent: (id: string, b: TrackingEventBody) => post<Schemas['Br11CarrierTrackingEventsRow']>(`/sales-outwards/${id}/tracking-events`, b),
  recordDelivery: (lineId: string, b: DeliveryBody) => post<Schemas['Br11DeliveryEvidenceRow']>(`/sales-outward-lines/${lineId}/delivery`, b),
  // finance + admin
  previewInvoice: (b: SalesInvoiceBody) => post<InvoicePreview>('/sales-invoices/preview', b),
  /** `idempotencyKey`: one per Issue click -> a retried click returns the same invoice, never a second number. */
  issueInvoice: (b: SalesInvoiceBody, idempotencyKey: string) => post<InvoiceDetail>('/sales-invoices', b, { 'Idempotency-Key': idempotencyKey }),
  setPolicy: (b: SalesPolicyBody) => put<SalesConfig>('/sales-config/policy', b),
};

// ------------------------------------------------------------------ query keys + hooks
export const sk = {
  all: ['supply'] as const,
  list: (kind: string, p?: object) => ['supply', 'list', kind, qs(p)] as const,
  enquiry: (id: string) => ['supply', 'enquiry', id] as const,
  quote: (id: string) => ['supply', 'quote', id] as const,
  order: (id: string) => ['supply', 'order', id] as const,
  outward: (id: string) => ['supply', 'outward', id] as const,
  config: ['supply', 'config'] as const,
  sourcing: (orderId: string) => ['supply', 'order', orderId, 'sourcing'] as const,
  supplierPos: (orderId: string) => ['supply', 'order', orderId, 'pos'] as const,
  receipts: (p: object) => ['supply', 'receipts', qs(p)] as const,
  invoice: (id: string) => ['supply', 'invoice', id] as const,
};

const listQuery = <T>(kind: string, fn: (p?: ListParams) => Promise<T>, p?: ListParams, enabled = true) =>
  ({ queryKey: sk.list(kind, p), queryFn: () => fn(p), placeholderData: keepPreviousData, enabled });
export const useEnquiries = (p?: ListParams, enabled = true) => useQuery(listQuery('enquiries', supplyApi.enquiries, p, enabled));
export const useQuotes = (p?: ListParams, enabled = true) => useQuery(listQuery('quotes', supplyApi.quotes, p, enabled));
export const useOrders = (p?: ListParams, enabled = true) => useQuery(listQuery('orders', supplyApi.orders, p, enabled));
export const useOutwards = (p?: ListParams, enabled = true) => useQuery(listQuery('outwards', supplyApi.outwards, p, enabled));
/** FINANCE / MANAGEMENT only. */
export const useInvoiceQueue = (p?: ListParams, enabled = true) => useQuery(listQuery('invoice-queue', supplyApi.invoiceQueue, p, enabled));

export const useEnquiry = (id: string) => useQuery({ queryKey: sk.enquiry(id), queryFn: () => supplyApi.enquiry(id), enabled: !!id });
export const useQuote = (id: string) => useQuery({ queryKey: sk.quote(id), queryFn: () => supplyApi.quote(id), enabled: !!id });
export const useOrder = (id: string) => useQuery({ queryKey: sk.order(id), queryFn: () => supplyApi.order(id), enabled: !!id });
export const useOutward = (id: string) => useQuery({ queryKey: sk.outward(id), queryFn: () => supplyApi.outward(id), enabled: !!id });
export const useSalesConfig = () => useQuery({ queryKey: sk.config, queryFn: supplyApi.config, staleTime: 60_000 });
/** PURCHASE only (server 403s other roles): only call from Purchase screens. */
export const useSourcingAuthorisations = (orderId: string) =>
  useQuery({ queryKey: sk.sourcing(orderId), queryFn: () => supplyApi.sourcingAuthorisations(orderId), enabled: !!orderId });
/** PURCHASE only. */
export const useSupplierPos = (orderId: string) =>
  useQuery({ queryKey: sk.supplierPos(orderId), queryFn: () => supplyApi.supplierPos(orderId), enabled: !!orderId });
/** FINANCE / MANAGEMENT only. */
export const useReceipts = (p: { customer_id?: string; search?: string; page?: number; page_size?: number }, enabled = true) =>
  useQuery({ queryKey: sk.receipts(p), queryFn: () => supplyApi.receipts(p), enabled });
export const useInvoice = (id: string) => useQuery({ queryKey: sk.invoice(id), queryFn: () => supplyApi.invoice(id), enabled: !!id });

/**
 * Every BR-11 write can move enquiries, quotes, orders, outwards, the invoice queue and receipts at once (the DB derives
 * statuses), so a successful write refreshes every Sales & Supply read.
 */
export function useSupplyMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: sk.all }) });
}

/** A fresh Idempotency-Key for one user action (reservation, invoice issue). */
export const newIdempotencyKey = () => crypto.randomUUID();
