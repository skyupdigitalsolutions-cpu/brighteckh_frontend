// Data source for the Inward register (D·P1, Figma 177:102734).
//
// G14: the API has NO list endpoint for inward receipts — `/api/inward-receipts` is POST only and only
// `GET /api/inward-receipts/{id}` exists (verified against openapi/brightech-openapi.json). `fetchRegister` is the
// single swap point: when a list endpoint ships, call it here and set `available: true`. Until then it resolves to
// an empty, explicitly-unavailable result, so the page renders the designed empty state + GapNote G14. The loading
// and error states are driven by the real query states and already work for the future endpoint.
import { useQuery } from '@tanstack/react-query';
import type { InwardReceiptRow } from '../../api';

/**
 * One register row = the `inward_receipts` row (InwardReceiptsRow, real API fields) plus the three columns the
 * Figma table needs that the header row does not carry. They are optional and render "—" when absent:
 * - customer_name  (Customer column; the row only has customer_id — no customers lookup, G16)
 * - units_verified / units_total  (Units verified column; derived from inward_equipment_units)
 */
export type RegisterRow = InwardReceiptRow & {
  customer_name?: string | null;
  units_verified?: number | null;
  units_total?: number | null;
};

export type RegisterResult = { rows: RegisterRow[]; /** false = no list endpoint (G14). */ available: boolean };

async function fetchRegister(): Promise<RegisterResult> {
  // G14 — replace with: http.get<RegisterRow[]>('/inward-receipts', { params }) once the endpoint exists.
  return { rows: [], available: false };
}

export const inwardRegisterKey = ['purchase', 'inward-register'] as const;

export function useInwardRegister() {
  return useQuery({ queryKey: inwardRegisterKey, queryFn: fetchRegister, staleTime: 30_000 });
}

// ------------------------------------------------------------------ filters (client-side; API enums)
export type ReceiptStatus = InwardReceiptRow['receipt_status'];
export type ReceiptPriority = InwardReceiptRow['priority'];

/** Tabs (177:102738): All receipts · Awaiting verification (REGISTERED + VERIFYING, frame 177:105577) · On hold · Closed. */
export type RegisterTab = 'ALL' | 'AWAITING' | 'ON_HOLD' | 'CLOSED';
export const TAB_STATUSES: Record<RegisterTab, ReceiptStatus[] | null> = {
  ALL: null,
  AWAITING: ['REGISTERED', 'VERIFYING'],
  ON_HOLD: ['ON_HOLD'],
  CLOSED: ['CLOSED'],
};

export type DateKey = 'm0' | 'm1' | 'm2' | '7d';

const IST = 'Asia/Kolkata';
const ymFmt = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit' });
/** "2026-11" for a date, in IST. */
export const istYearMonth = (d: Date) => ymFmt.format(d).slice(0, 7);

/** First day of the month `back` months before `now` (local calendar), for labels and matching. */
export function monthStart(back: number, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - back, 15);
}

export function matchesDate(receiptAt: string, key: DateKey, now = new Date()) {
  const d = new Date(receiptAt);
  if (Number.isNaN(d.getTime())) return false;
  if (key === '7d') return now.getTime() - d.getTime() <= 7 * 24 * 3600 * 1000;
  const back = key === 'm0' ? 0 : key === 'm1' ? 1 : 2;
  return istYearMonth(d) === istYearMonth(monthStart(back, now));
}

export type RegisterFilters = {
  tab: RegisterTab;
  status: ReceiptStatus | 'ALL';
  priority: ReceiptPriority | 'ALL';
  date: DateKey;
  search: string;
};

export function applyFilters(rows: RegisterRow[], f: RegisterFilters, now = new Date()) {
  const tabSet = TAB_STATUSES[f.tab];
  const q = f.search.trim().toLowerCase();
  return rows
    .filter((r) => !tabSet || tabSet.includes(r.receipt_status))
    .filter((r) => f.status === 'ALL' || r.receipt_status === f.status)
    .filter((r) => f.priority === 'ALL' || r.priority === f.priority)
    .filter((r) => matchesDate(r.receipt_at, f.date, now))
    // Search placeholder: "Search JIN, customer, DC no."
    .filter((r) => !q || [r.jin_number, r.customer_name, r.customer_dc_number].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => b.receipt_at.localeCompare(a.receipt_at));
}
