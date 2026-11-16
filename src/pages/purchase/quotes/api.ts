// Local data layer for the BR-04 quote screens (shared hooks live in ../api.ts; nothing here edits them).
// Create / revise use the shared useCreateQuote / useReviseQuote (RepairQuoteLineDto lines, invalidate the quotes list).
import { useQueries, useQuery } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk, purchaseApi, useRfqs } from '../api';

export type QuoteLineRow = S<'Br04CustomerQuoteLinesRow'>;
export type LineType = QuoteLineRow['line_type'];
export type QuoteType = S<'Br04CustomerQuotesRow'>['quote_type'];
export type QuoteStatus = S<'Br04CustomerQuoteRevisionsRow'>['quote_status'];
export type RevisionWithLines = S<'QuoteRevisionWithLines'>;
/** GET /jobs/:id/quote-responses row. `quote_revision_id` is the BR-05 ref id; the BR-04 revision is `source_br04_quote_revision_id`. */
export type QuoteResponse = S<'QuoteResponseEvent'>;
export type OfferLine = S<'Br04SupplierOfferLinesRow'>;

/** Line types, in the API enum's order. */
export const LINE_TYPES: LineType[] = ['REPAIR_SERVICE', 'MATERIAL', 'LABOUR', 'INSPECTION', 'TESTING', 'EXTERNAL', 'FREIGHT', 'OTHER'];
export const QUOTE_TYPES: QuoteType[] = ['ITEM', 'ASSEMBLED'];

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Route-param format check (/p/quotes/:quoteId). */
export const isUuid = (v: string) => UUID.test(v.trim());
