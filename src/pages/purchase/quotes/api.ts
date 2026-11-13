// Local data layer for the BR-04 quote screens (shared hooks live in ../api.ts; nothing here edits them).
//
// WHY local create/revise hooks: the generated OpenAPI schema has a NAME COLLISION — `QuoteLineDto` in
// src/api/schema.d.ts is the BR-11 sales-quote line (item_id, product_condition, unit_price_paise …), so the shared
// CreateQuoteBody / ReviseQuoteBody types describe the wrong line shape. The real BR-04 body (backend
// src/modules/br04/dto/br04.dto.ts `QuoteLineDto`) is { line_type, line_description, quantity, uom,
// net_unit_price_pre_tax, scope_technically_indivisible?, customer_selectable? } with numeric RUPEE amounts.
// Gap code G?-D-1 (reported). Both endpoints are @Roles('PURCHASE').
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk, purchaseApi, useRfqs, type CreateQuoteBody, type QuoteWithRevision, type ReviseQuoteBody } from '../api';

export type QuoteLineRow = S<'Br04CustomerQuoteLinesRow'>;
export type LineType = QuoteLineRow['line_type'];
export type QuoteType = S<'Br04CustomerQuotesRow'>['quote_type'];
export type QuoteStatus = S<'Br04CustomerQuoteRevisionsRow'>['quote_status'];
export type RevisionWithLines = S<'QuoteRevisionWithLines'>;
export type QuoteResponse = S<'Br05CustomerResponseEventsRow'>;
export type OfferLine = S<'Br04SupplierOfferLinesRow'>;

/** Line types, in the API enum's order. */
export const LINE_TYPES: LineType[] = ['REPAIR_SERVICE', 'MATERIAL', 'LABOUR', 'INSPECTION', 'TESTING', 'EXTERNAL', 'FREIGHT', 'OTHER'];
export const QUOTE_TYPES: QuoteType[] = ['ITEM', 'ASSEMBLED'];

export type Br04QuoteLineBody = {
  line_type: LineType;
  line_description: string;
  quantity: number;
  uom: string;
  /** Final customer unit price, pre-tax, numeric rupees — typed by Purchase (no formula). */
  net_unit_price_pre_tax: number;
  scope_technically_indivisible?: boolean;
  customer_selectable?: boolean;
};
export type Br04CreateQuoteBody = Omit<CreateQuoteBody, 'lines'> & { lines: Br04QuoteLineBody[] };
export type Br04ReviseQuoteBody = Omit<ReviseQuoteBody, 'lines'> & { lines: Br04QuoteLineBody[] };

const post = <T>(url: string, body: unknown) => http.post<T>(url, body).then((r) => r.data);

/** POST /jobs/{id}/quotes — creates the quote + revision 0 (DRAFT). */
export function useCreateQuoteBr04(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Br04CreateQuoteBody) => post<QuoteWithRevision>(`/jobs/${jobId}/quotes`, b),
    onSuccess: (q) => Promise.all([
      qc.invalidateQueries({ queryKey: pk.quotes(jobId) }),
      qc.invalidateQueries({ queryKey: pk.quote(q.id) }),
    ]),
  });
}

/** POST /quotes/{id}/revise — always inserts a NEW revision (n+1). >10 % below the original authorised price is
 *  rejected by the DB unless higher_discount_approved_by_id + higher_discount_reason are sent (open decision). */
export function useReviseQuoteBr04(quoteId: string, jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Br04ReviseQuoteBody) => post<QuoteWithRevision>(`/quotes/${quoteId}/revise`, b),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: pk.quotes(jobId) }),
      qc.invalidateQueries({ queryKey: pk.quote(quoteId) }),
    ]),
  });
}

/** GET /jobs/{id}/quote-responses (BR-05; no @Roles → any signed-in role may read). Newest first. */
export const quoteResponsesKey = (jobId: string) => ['purchase', 'job', jobId, 'quote-responses'] as const;
export const useQuoteResponses = (jobId: string | undefined) =>
  useQuery({
    queryKey: quoteResponsesKey(jobId ?? ''),
    queryFn: () => http.get<QuoteResponse[]>(`/jobs/${jobId}/quote-responses`).then((r) => r.data),
    enabled: !!jobId,
  });

/** Every supplier offer line on the job's RFQs, for the reference / procurement offer pickers (Purchase only). */
export type OfferOption = { line: OfferLine; label: string };
export function useJobOfferLines(jobId: string, enabled: boolean) {
  const rfqsQ = useRfqs(enabled ? jobId : undefined);
  const details = useQueries({
    queries: (rfqsQ.data ?? []).map((r) => ({ queryKey: pk.rfq(r.id), queryFn: () => purchaseApi.rfq(r.id), enabled })),
  });
  const options: OfferOption[] = [];
  for (const d of details) {
    const rfq = d.data;
    if (!rfq) continue;
    for (const offer of rfq.offers) {
      const supplier = rfq.invites.find((i) => i.id === offer.supplier_invite_id)?.supplier_name_snapshot ?? 'Supplier';
      for (const line of offer.lines) {
        const part = [line.offered_make, line.offered_part_number].filter(Boolean).join(' ');
        options.push({ line, label: [rfq.rfq_number ?? `RFQ ${rfq.rfq_seq}`, supplier, part || null, line.technical_status].filter(Boolean).join(' · ') });
      }
    }
  }
  return {
    options,
    isPending: enabled && (rfqsQ.isPending || details.some((d) => d.isPending)),
    isError: rfqsQ.isError || details.some((d) => d.isError),
  };
}

// ---------------------------------------------------------------- recently opened quotes (G21 stand-in)
// There is no cross-job quote list (G21). The Quotes page lists the quotes opened on THIS device, re-read live from
// GET /quotes/{id}. Per-viewer convenience only; storage may be unavailable, so every access is guarded.
const RECENT_KEY = 'bt:purchase:recent-quotes';
export function readRecentQuotes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  } catch { return []; }
}
export function rememberQuote(id: string) {
  try {
    const next = [id, ...readRecentQuotes().filter((x) => x !== id)].slice(0, 30);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage blocked — the list just stays empty */ }
}
export function forgetQuote(id: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(readRecentQuotes().filter((x) => x !== id))); } catch { /* ignore */ }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** A pasted quote UUID or a link containing /quotes/<uuid> → the UUID. */
export function parseQuoteRef(v: string): string | null {
  const t = v.trim();
  const link = /quotes\/([0-9a-f-]{36})/i.exec(t);
  if (link && UUID.test(link[1])) return link[1].toLowerCase();
  const m = UUID.exec(t);
  return m && m[0].length === t.length ? m[0].toLowerCase() : null;
}
export const isUuid = (v: string) => { const m = UUID.exec(v.trim()); return !!m && m[0].length === v.trim().length; };
