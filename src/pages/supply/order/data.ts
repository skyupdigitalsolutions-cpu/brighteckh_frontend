// Stage B local data helpers. All BR-11 reads / writes come from ../api (the shared data layer); this file only adds:
// - useItemsByIds: GET /masters/items/:id for the item codes on the order lines (the SO line view carries item_id +
//   description_snapshot, no code).
// - useOrderContext: customer name (GET /sales-supply/orders?search=<quote number>, matched by id) + quote number /
//   revision (GET /sales-quotes/:id), because the order detail carries customer_id / quote_id only.
// - Quantity / money helpers (decimal strings are compared as numbers only for gating, never displayed from floats).
// - The closure PREVIEW (PO4): computed on screen from the order detail; the server decides at close.
import { useQueries } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { enumLabel, formatQty } from '../../../lib/format';
import {
  useOrders, useQuote, type ChangeKind, type OrderDetail, type OrderLine, type OrderRow, type PaymentTerms, type SalesConfig,
} from '../api';

export type Role = 'SALES' | 'PURCHASE';
export type Item = S<'FdnItemMasterRow'>;
export type Invoice = OrderDetail['invoices'][number];

/** Decimal string -> number, for comparisons / gating only. */
export const num = (v: string | number | null | undefined) => (v == null || v === '' ? 0 : Number(v) || 0);

/** Item master rows by id (code + name). Failed / missing ids just fall back to the line description. */
export function useItemsByIds(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const qs = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['masters', 'item', id],
      queryFn: () => http.get<Item>(`/masters/items/${id}`).then((r) => r.data),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const map: Record<string, Item> = {};
  qs.forEach((q) => { if (q.data) map[q.data.id] = q.data; });
  return map;
}

export function lineLabel(l: OrderLine, items: Record<string, Item>) {
  const code = l.item_id ? items[l.item_id]?.item_code : undefined;
  const name = l.description_snapshot ?? (l.item_id ? items[l.item_id]?.standard_name : undefined) ?? `Line ${l.line_no ?? ''}`;
  return code ? `${code} · ${name}` : name;
}

/** Customer + quote context for the detail page. The list row (if found) also carries the payment / advance summary. */
export function useOrderContext(order: OrderDetail | undefined) {
  const quoteQ = useQuote(order?.quote_id ?? '');
  const quoteNumber = quoteQ.data?.quote_number;
  const revisionNo = quoteQ.data?.revisions.find((r) => r.id === order?.quote_revision_id)?.revision_no;
  const search = order?.sales_order_number ?? quoteNumber ?? '';
  const listQ = useOrders({ search, page_size: 25 }, !!search);
  const row: OrderRow | undefined = listQ.data?.rows.find((r) => r.id === order?.id);
  return {
    row,
    customerName: row?.customer_name ?? null,
    quoteNumber: quoteNumber ?? row?.quote_number ?? null,
    revisionNo: revisionNo ?? row?.quote_revision_no ?? null,
  };
}

export const quoteRef = (quoteNumber: string | null, revisionNo: number | null | undefined) =>
  quoteNumber ? `${quoteNumber}${revisionNo != null ? ` · r${revisionNo}` : ''}` : '—';

/** Sum of accepted_qty x unit_price over the lines (bigint paise). */
export function orderTotalPaise(lines: OrderLine[]): string {
  let t = 0n;
  for (const l of lines) t += lineTotalPaise(l);
  return t.toString();
}
/** round(qty x unit price) in paise, using string arithmetic on the decimal qty (no float on money). */
export function lineTotalPaise(l: OrderLine): bigint {
  const price = BigInt(l.unit_price_paise ?? '0');
  const m = /^(\d+)(?:\.(\d+))?$/.exec((l.accepted_qty ?? '0').trim());
  if (!m) return 0n;
  const frac = m[2] ?? '';
  const scale = 10n ** BigInt(frac.length);
  const q = BigInt(m[1]) * scale + BigInt(frac || '0');
  const raw = q * price;
  return (raw + scale / 2n) / scale;
}

/** Rupee text ("25,000.50") -> integer paise, or null when invalid. */
export function rupeesToPaise(text: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.replace(/,/g, '').trim());
  if (!m) return null;
  const p = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(p) ? p : null;
}

export const advanceSummary = (t: PaymentTerms | null | undefined): string => {
  if (!t) return 'Not recorded';
  if (t.advance_kind === 'NOT_REQUIRED') return 'No advance required';
  const amt = t.required_amount_paise ? formatPaiseShort(t.required_amount_paise) : '—';
  if (t.advance_kind === 'PERCENTAGE') return `Advance ${t.required_percent ? `${formatQty(t.required_percent)}% · ` : ''}${amt}`;
  if (t.advance_kind === 'FULL') return `Full advance ${amt}`;
  return `Advance ${amt}`;
};
/** "₹25,000" when the paise are whole rupees, else "₹25,000.50" (the header line drawn as "Advance ₹25,000"). */
export function formatPaiseShort(paise: string): string {
  const p = BigInt(paise);
  const r = p / 100n;
  const f = p % 100n;
  const grouped = groupIndian(r.toString());
  return f === 0n ? `₹${grouped}` : `₹${grouped}.${f.toString().padStart(2, '0')}`;
}
function groupIndian(d: string): string {
  if (d.length <= 3) return d;
  return d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + d.slice(-3);
}

/** Advance state for the header / side card. null = no advance required or no terms. */
export function advanceState(t: PaymentTerms | null | undefined): 'CONFIRMED' | 'PENDING' | null {
  if (!t || t.advance_kind === 'NOT_REQUIRED') return null;
  return t.finance_confirmed_at ? 'CONFIRMED' : 'PENDING';
}

/** 11B-02: reservation / sourcing need recorded terms and (when an advance is required) Finance's confirmation. */
export function supplyGate(o: OrderDetail): { ok: boolean; reason: string | null } {
  if (!o.payment_terms) return { ok: false, reason: 'Record payment terms first' };
  if (advanceState(o.payment_terms) === 'PENDING') return { ok: false, reason: 'Waiting for Finance to confirm the advance' };
  return { ok: true, reason: null };
}

export const isOpenOrder = (o: OrderDetail) => o.status === 'VERIFIED' || o.status === 'PART_DELIVERED' || o.status === 'DELIVERED';

/** Single UOM across lines (to add quantities into one label), else null. */
export function commonUom(lines: OrderLine[]): string | null {
  const u = new Set(lines.map((l) => l.uom ?? ''));
  return u.size === 1 ? (lines[0]?.uom ?? null) : null;
}
export const sumQty = (lines: OrderLine[], k: keyof Pick<OrderLine, 'accepted_qty' | 'delivered_qty' | 'invoiced_qty'>) =>
  lines.reduce((t, l) => t + num(l[k]), 0);

// ------------------------------------------------------------------ closure preview (PO4)
export type CheckState = 'PASS' | 'FAIL' | 'BLOCKED';
export type ClosureCheck = { key: string; title: string; detail: string; state: CheckState };

export const liveInvoices = (o: OrderDetail) => o.invoices.filter((i) => i.invoice_status !== 'CANCELLED');

export function closurePreview(o: OrderDetail, config: SalesConfig | undefined): ClosureCheck[] {
  const lines = o.lines;
  const uom = commonUom(lines);
  const q = (n: number) => formatQty(String(n), uom);
  const ordered = sumQty(lines, 'accepted_qty');
  const delivered = sumQty(lines, 'delivered_qty');
  const invoiced = sumQty(lines, 'invoiced_qty');
  const allDelivered = lines.length > 0 && lines.every((l) => num(l.delivered_qty) >= num(l.accepted_qty));
  const allInvoiced = lines.length > 0 && lines.every((l) => num(l.invoiced_qty) >= num(l.accepted_qty));
  const live = liveInvoices(o);
  const policy = config?.policy?.requires_full_payment_for_closure ?? null;

  let payment: ClosureCheck;
  if (policy === null) {
    payment = {
      key: 'payment', title: 'Payment complete (if policy requires)', state: 'BLOCKED',
      detail: 'requires_full_payment_for_closure is not set (11C-09 CLIENT-UNCONFIRMED)',
    };
  } else if (!policy) {
    payment = { key: 'payment', title: 'Payment complete (policy: not required)', state: 'PASS', detail: 'Policy does not require full payment' };
  } else {
    const total = live.reduce((t, i) => t + BigInt(i.total_paise), 0n);
    const paid = live.reduce((t, i) => t + BigInt(i.amount_paid_paise), 0n);
    payment = {
      key: 'payment', title: 'Payment complete (policy: required)',
      state: live.length > 0 && paid >= total ? 'PASS' : 'FAIL',
      detail: live.length ? `${paisePlain(paid)} of ${paisePlain(total)} received` : 'No live invoice to pay',
    };
  }
  return [
    { key: 'pod', title: 'POD-delivered = ordered', state: allDelivered ? 'PASS' : 'FAIL', detail: `${q(delivered)} of ${q(ordered)} delivered` },
    { key: 'inv', title: 'Invoiced = ordered', state: allInvoiced ? 'PASS' : 'FAIL', detail: `${q(invoiced)} of ${q(ordered)} invoiced` },
    {
      key: 'live', title: 'Live invoice exists', state: live.length ? 'PASS' : 'FAIL',
      detail: live.length ? live.map((i) => `${i.invoice_number} · ${enumLabel(i.invoice_status)}`).join(', ') : 'No live product invoice',
    },
    payment,
  ];
}
const paisePlain = (p: bigint) => {
  const r = groupIndian((p / 100n).toString());
  return `₹${r}.${(p % 100n).toString().padStart(2, '0')}`;
};

// ------------------------------------------------------------------ labels
export const CHANGE_KIND_HELP: Partial<Record<ChangeKind, string>> = {
  CANCELLATION: 'Only an APPROVED cancellation changes the order (line / order cancelled if nothing is shipped, invoiced, reserved or on a PO).',
  SUBSTITUTION: 'Attach the engineer / technical suitability evidence (11B-09).',
};
