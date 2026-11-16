// Sales desk data layer.
//
// GET /api/sales/quotes (SALES only). Types come from the generated src/api/schema.d.ts (SalesQuoteListPage).
//
// Scope (server-side): quotes whose LATEST revision was released to the caller (br04_quote_sales_handoffs.assigned_sales_id
// = me). Money fields are numeric strings (rupees) — format with formatINR, never through floats.
// `sales_stage` is DERIVED by the server from the latest revision + its latest BR-05 response; the BR-04
// quote_status never moves past SENT through any API, so every Sales badge reads `sales_stage`, not quote_status.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { components } from '../../api/schema';
import type { Tone } from '../../lib/tones';

// ------------------------------------------------------------------ types — generated (src/api/schema.d.ts)
type Schemas = components['schemas'];
export const SALES_STAGES = ['TO_SEND', 'AWAITING', 'IN_DISCUSSION', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const satisfies readonly Schemas['SalesQuoteRow']['sales_stage'][];
export type SalesStage = Schemas['SalesQuoteRow']['sales_stage'];
export type SalesLatestResponse = Schemas['SalesQuoteLatestResponse'];
/** BR-05 br05_customer_response_events.response_type. */
export type ResponseType = SalesLatestResponse['response_type'];
export type ResponseChannel = NonNullable<SalesLatestResponse['response_channel']>;
/** One row of GET /sales/quotes. Money fields are numeric strings; `revision_no` is 0-based as stored. */
export type SalesQuoteRow = Schemas['SalesQuoteRow'];
export type SalesStageCounts = Schemas['SalesStageCounts'];
/** `counts_by_stage` covers the caller's scope under the current `search`; ignores `stage` and `valid_until_before`. */
export type SalesQuotePage = Schemas['SalesQuoteListPage'];

export type SalesQuotesParams = {
  stage?: SalesStage[];
  search?: string;
  /** YYYY-MM-DD, strict (valid_until < this date). */
  valid_until_before?: string;
  page?: number;
  /** Max 100. */
  page_size?: number;
};

// ------------------------------------------------------------------ fetch
/** Drops empty params; arrays → comma-separated (the API's multi-value format). */
function qs(p: SalesQuotesParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

export const salesApi = {
  quotes: (p: SalesQuotesParams = {}) => http.get<SalesQuotePage>('/sales/quotes', { params: qs(p) }).then((r) => r.data),
};

/** Every Sales list key starts with this; invalidate it after a send / response so all Sales lists refresh. */
export const SALES_QUOTES_KEY = ['sales', 'quotes'] as const;
export const sk = {
  quotes: (p: SalesQuotesParams) => [...SALES_QUOTES_KEY, 'list', qs(p)] as const,
  responseFeed: (search: string) => [...SALES_QUOTES_KEY, 'response-feed', search] as const,
};

export const useSalesQuotes = (p: SalesQuotesParams, enabled = true) =>
  useQuery({ queryKey: sk.quotes(p), queryFn: () => salesApi.quotes(p), enabled, placeholderData: keepPreviousData });

/** Stages of a quote that has been sent (everything except TO_SEND). */
export const SENT_STAGES: SalesStage[] = ['AWAITING', 'IN_DISCUSSION', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

/**
 * Responses page source. There is NO responses-feed endpoint, so this pages through GET /sales/quotes (sent stages,
 * 100 per page, at most FEED_MAX_PAGES pages), keeps rows that carry a `latest_response` and sorts them newest response
 * first. One row per quote = the latest response on its latest revision only.
 */
export const FEED_MAX_PAGES = 10;
export type ResponseFeed = { rows: (SalesQuoteRow & { latest_response: SalesLatestResponse })[]; scanned: number; total: number; truncated: boolean };
export function useSalesResponseFeed(search: string) {
  return useQuery({
    queryKey: sk.responseFeed(search),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ResponseFeed> => {
      const all: SalesQuoteRow[] = [];
      let total = 0;
      for (let page = 1; page <= FEED_MAX_PAGES; page++) {
        const r = await salesApi.quotes({ stage: SENT_STAGES, page, page_size: 100, ...(search ? { search } : {}) });
        total = r.total;
        all.push(...r.rows);
        if (all.length >= r.total || r.rows.length === 0) break;
      }
      const rows = all
        .filter((q): q is SalesQuoteRow & { latest_response: SalesLatestResponse } => q.latest_response != null)
        .sort((a, b) => b.latest_response.responded_at.localeCompare(a.latest_response.responded_at)
          || a.quote_number.localeCompare(b.quote_number));
      return { rows, scanned: all.length, total, truncated: all.length < total };
    },
  });
}

// ------------------------------------------------------------------ display helpers
/**
 * Badge tones for the derived sales stage. Not in src/lib/tones.ts (no API enum there); tones follow the Figma badges
 * drawn for the same rows: RELEASED TO SALES / SENT = Progress, ACCEPTED = Success, REJECTED / EXPIRED = Blocked.
 */
export const STAGE_TONE: Record<SalesStage, Tone> = {
  TO_SEND: 'progress', AWAITING: 'progress', IN_DISCUSSION: 'progress', ACCEPTED: 'success', REJECTED: 'blocked', EXPIRED: 'blocked',
};

/** BR-05 response_type tones (Figma SR0 177:139228: ACCEPTED success, REJECTED / EXPIRED blocked). */
export const RESPONSE_TONE: Record<ResponseType, Tone> = {
  AWAITING_RESPONSE: 'neutral', ACCEPTED: 'success', COUNTER_OFFER: 'progress', TECHNICAL_QUERY: 'progress',
  PARTIAL_ACCEPTANCE: 'progress', ON_HOLD: 'progress', REJECTED: 'blocked', EXPIRED: 'blocked',
};

const DAY_MS = 86_400_000;
/** Whole calendar days since `iso` (not working days — no Sales rule uses the calendar). */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}
/** Raw age: "< 1 day" · "1 day" · "3 days". */
export function ageText(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d == null) return '—';
  return d === 0 ? '< 1 day' : d === 1 ? '1 day' : `${d} days`;
}

/** Raw age as a phrase: "today" · "1 day ago" · "3 days ago". */
export function agoText(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d == null) return '—';
  return d === 0 ? 'today' : `${ageText(iso)} ago`;
}

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Today (+ n days) as YYYY-MM-DD in IST. */
export function istDate(plusDays = 0, now = Date.now()) {
  return ymd.format(new Date(now + plusDays * DAY_MS));
}

const dm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** "2026-11-16" / ISO → "16 Nov" (Figma short date). */
export const dayMonth = (iso: string | null | undefined) => (iso ? dm.format(new Date(iso)) : '—');

/** Quote revision as Figma labels it ("Q-00087 · r1") — API value, 0-based as stored (same rule as Purchase Q0). */
export const quoteRef = (q: Pick<SalesQuoteRow, 'quote_number' | 'revision_no'>) => `${q.quote_number} · r${q.revision_no}`;
