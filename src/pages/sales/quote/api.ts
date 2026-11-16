// Sales quote data layer (BR-04 send + BR-05 customer response). Reads reuse the shared Purchase hooks where the
// endpoint has no @Roles (any signed-in role, company-scoped): GET /quotes/:id, /jobs/:id, /inward-receipts/:id,
// /lookups/customers (PURCHASE + SALES). Nothing here calls a PURCHASE-only endpoint (job progress, /quotes list,
// /lookups/employees|assemblies, /rfqs*): those are 403 for Sales.
//
// Two revision ids exist (sales-map fact 5):
// - BR-04 revision id = GET /quotes/:id → revisions[].id. POST /jobs/:id/quote-responses takes THIS one.
// - BR-05 ref id = `quote_revision_id` on response rows. Never compare it with a BR-04 id: match responses to a
//   revision on `source_br04_quote_revision_id` only.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../../api/http';
import { api } from '../../../api/endpoints';
import type { S } from '../../../api/types';
import { pk, useCustomersByIds, useJob, useQuote, useReceipt } from '../../purchase/api';
import { quoteResponsesKey } from '../../purchase/quotes/api';
import { formatPaiseBig, lineTotalPaise, toPaise } from '../../purchase/quotes/money';
import { formatINR, formatQty } from '../../../lib/format';

// ------------------------------------------------------------------ types
/** Sent metadata added to GET /quotes/:id revisions (sales-contract §B). Optional until schema.d.ts is regenerated. */
export type SalesRevision = S<'QuoteRevisionWithLines'>;
export type SalesQuote = S<'QuoteDetail'>;
export type QuoteLine = S<'Br04CustomerQuoteLinesRow'>;
/** GET /jobs/:id/quote-responses row (carries source_br04_quote_revision_id). Newest first. */
export type ResponseEvent = S<'QuoteResponseEvent'>;
export type ResponseType = S<'RepairQuoteResponseDto'>['response_type'];
export type ResponseChannel = NonNullable<S<'RepairQuoteResponseDto'>['response_channel']>;
export type RecordResponseBody = S<'RepairQuoteResponseDto'>;
export type ResponseRecorded = S<'QuoteResponseRecorded'>;

// ------------------------------------------------------------------ reads
/** GET /jobs/:id/quote-responses, typed as the endpoint really returns it (QuoteResponseEvent). Shares the cache key
 *  with the Purchase hook so either side's invalidation refreshes both. */
export const useResponseEvents = (jobId: string | undefined) =>
  useQuery({
    queryKey: quoteResponsesKey(jobId ?? ''),
    queryFn: () => http.get<ResponseEvent[]>(`/jobs/${jobId}/quote-responses`).then((r) => r.data),
    enabled: !!jobId,
  });

/** GET /br08/entity-profile (no @Roles): letterhead for the preview. Same key as AuthProvider. */
export const useEntityProfile = (companyId: string) =>
  useQuery({ queryKey: ['entity-profile', companyId], queryFn: api.entityProfile, staleTime: Infinity, retry: false });

/** The quote plus everything the Sales view shows around it: job number, customer, equipment, responses. */
export function useSalesQuoteData(quoteId: string | undefined) {
  const quoteQ = useQuote(quoteId);
  const quote = quoteQ.data as SalesQuote | undefined;
  const jobQ = useJob(quote?.job_id);
  const receiptQ = useReceipt(jobQ.data?.inward_id);
  const customersQ = useCustomersByIds([receiptQ.data?.customer_id]);
  const responsesQ = useResponseEvents(quote?.job_id);
  const unit = receiptQ.data?.equipment_units.find((u) => u.id === jobQ.data?.unit_id);
  const customerId = receiptQ.data?.customer_id;
  return {
    quoteQ,
    quote,
    job: jobQ.data,
    unit,
    customer: customerId ? customersQ.data?.[customerId] : undefined,
    /** Context still loading (job → receipt → customer). The quote itself drives the 4 states. */
    contextPending: !!quote && (jobQ.isPending || (!!jobQ.data && receiptQ.isPending) || (!!receiptQ.data && customersQ.isPending)),
    contextError: jobQ.isError || receiptQ.isError || customersQ.isError,
    responsesQ,
    /** This quote's responses only (a job can have several quotes), newest first. */
    responses: (responsesQ.data ?? []).filter((r) => r.quote_id === quote?.id),
  };
}

// ------------------------------------------------------------------ writes
const salesKeys = ['sales'] as const;

/** POST /quotes/:id/send (SALES). No body: no recipients, email or PDF — it only moves RELEASED_TO_SALES → SENT. */
export function useSendQuote(quoteId: string, jobId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http.post<S<'Br04CustomerQuoteRevisionsRow'>>(`/quotes/${quoteId}/send`).then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: pk.quote(quoteId) }),
      ...(jobId ? [qc.invalidateQueries({ queryKey: pk.quotes(jobId) })] : []),
      qc.invalidateQueries({ queryKey: salesKeys }),
    ]),
  });
}

/** POST /jobs/:id/quote-responses (SALES). `br04_quote_revision_id` is the BR-04 revision id. */
export function useRecordResponse(jobId: string, quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RecordResponseBody) => http.post<ResponseRecorded>(`/jobs/${jobId}/quote-responses`, b).then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: quoteResponsesKey(jobId) }),
      qc.invalidateQueries({ queryKey: pk.quote(quoteId) }),
      qc.invalidateQueries({ queryKey: salesKeys }),
    ]),
  });
}

// ------------------------------------------------------------------ derived
export const RESPONSE_TYPES: ResponseType[] = ['ACCEPTED', 'PARTIAL_ACCEPTANCE', 'COUNTER_OFFER', 'TECHNICAL_QUERY', 'ON_HOLD', 'REJECTED', 'EXPIRED'];
export const RESPONSE_CHANNELS: ResponseChannel[] = ['EMAIL', 'WHATSAPP', 'CALL', 'IN_PERSON', 'OTHER'];
const IN_DISCUSSION = new Set<ResponseType>(['COUNTER_OFFER', 'TECHNICAL_QUERY', 'ON_HOLD', 'PARTIAL_ACCEPTANCE']);

/** Sales stage (same rule as GET /sales/quotes `sales_stage`). BR-04 quote_status stays SENT after a response, so the
 *  outcome comes from the latest BR-05 response for THAT revision (matched on source_br04_quote_revision_id). */
export type SalesStage = 'TO_SEND' | 'AWAITING' | 'IN_DISCUSSION' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'OTHER';
export function deriveStage(rev: SalesRevision, responses: ResponseEvent[]): { stage: SalesStage; latest?: ResponseEvent } {
  if (rev.quote_status === 'RELEASED_TO_SALES') return { stage: 'TO_SEND' };
  if (rev.quote_status !== 'SENT') return { stage: 'OTHER' };
  const latest = responses.find((r) => r.source_br04_quote_revision_id === rev.id);
  if (!latest || latest.response_type === 'AWAITING_RESPONSE') return { stage: 'AWAITING', latest };
  if (latest.response_type === 'ACCEPTED' || latest.response_type === 'REJECTED' || latest.response_type === 'EXPIRED') {
    return { stage: latest.response_type, latest };
  }
  return { stage: IN_DISCUSSION.has(latest.response_type) ? 'IN_DISCUSSION' : 'OTHER', latest };
}

/** The revision Sales is shown: the latest one Purchase has released (never an unreleased DRAFT, whose prices are
 *  still being worked on). `overallLatest` is the newest revision of any status. */
export function pickRevisions(quote: SalesQuote) {
  const revs = quote.revisions;
  const overallLatest = revs[revs.length - 1];
  const shown = [...revs].reverse().find((r) => r.quote_status !== 'DRAFT');
  return { overallLatest, shown };
}

/** Whole days since an ISO time (calendar days, not working days). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** valid_until (date, serialised as an ISO timestamp) is before today (IST date). Client hint only — no expiry rule exists. */
export function validityPassed(validUntil: string | null | undefined): boolean {
  if (!validUntil) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return validUntil.slice(0, 10) < today;
}

/** Line amount: the stored net_line_pre_tax, else qty × unit price (half-up). */
export function lineAmount(l: QuoteLine): string {
  if (l.net_line_pre_tax != null) return formatINR(l.net_line_pre_tax);
  return formatPaiseBig(lineTotalPaise(l.quantity, toPaise(l.net_unit_price_pre_tax)));
}
export const qtyUom = (l: QuoteLine) => `${formatQty(l.quantity)} ${l.uom}`;
