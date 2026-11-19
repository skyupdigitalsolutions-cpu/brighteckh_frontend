// Stage-C read helpers built ONLY on src/pages/supply/api.ts (+ the Purchase customer lookup).
//
// API gap (OUT-1): GET /sales-outwards/:id returns customer_id, item_id and sales_order_line_id only — no customer name,
// no Sales Order number, no item description. The screens rebuild them from other reads:
//   customer   → GET /lookups/customers?ids= (PURCHASE)
//   orders     → GET /sales-supply/outwards?search=<customer_code> row with this id → sales_orders[]
//   line label → GET /sales-orders/:id lines (description_snapshot, line_no) by sales_order_line_id
// A role-scoped detail field (customer_name, sales_orders[], line description) would remove these extra reads.
import { useQueries } from '@tanstack/react-query';
import { useCustomersByIds } from '../../purchase/api';
import { sk, supplyApi, useOutwards, type OrderDetail, type OutwardDetail, type OutwardLine } from '../api';

export type LineInfo = { description: string | null; lineNo: number | null; orderNumber: string | null; orderId: string | null };

export function useOrdersById(ids: string[]) {
  const qs = useQueries({ queries: ids.map((id) => ({ queryKey: sk.order(id), queryFn: () => supplyApi.order(id), enabled: !!id })) });
  const byId: Record<string, OrderDetail> = {};
  qs.forEach((q, i) => { if (q.data) byId[ids[i]] = q.data; });
  return byId;
}

export function lineInfoMap(orders: OrderDetail[]): Record<string, LineInfo> {
  const out: Record<string, LineInfo> = {};
  for (const o of orders) {
    for (const l of o.lines) {
      if (!l.sales_order_line_id) continue;
      out[l.sales_order_line_id] = { description: l.description_snapshot, lineNo: l.line_no, orderNumber: o.sales_order_number, orderId: o.id };
    }
  }
  return out;
}

export function useOutwardContext(o: OutwardDetail | undefined) {
  const cust = useCustomersByIds(o ? [o.customer_id] : []);
  const customer = o ? cust.data?.[o.customer_id] : undefined;
  const rows = useOutwards({ search: customer?.customer_code, page_size: 100 }, !!customer);
  const row = rows.data?.rows.find((r) => r.id === o?.id);
  const orderIds = (row?.sales_orders ?? []).map((s) => s.sales_order_id);
  const orders = useOrdersById(orderIds);
  const lines = lineInfoMap(Object.values(orders));
  const orderNumbers = (row?.sales_orders ?? []).map((s) => s.sales_order_number).filter(Boolean) as string[];
  return { customerName: customer?.customer_name ?? null, orderNumbers, lines };
}

export const lineLabel = (l: OutwardLine, info?: LineInfo) => info?.description ?? (info?.lineNo != null ? `Line ${info.lineNo}` : `Item ${l.item_id.slice(0, 8)}`);

/** Latest delivery evidence (rows are append-only; newest by created_at). */
export const latestDelivery = (l: OutwardLine) =>
  [...l.delivery_evidence].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

/** FAILED / DAMAGED POD: BR-11 has no follow-up path (open decision G20) — the line never reaches DELIVERED. */
export const isPodBlocked = (l: OutwardLine) => {
  const d = latestDelivery(l);
  return l.status !== 'DELIVERED' && !!d && d.delivery_status !== 'DELIVERED';
};

/** Integer / decimal string compare without floats beyond 4 dp (quantities are numeric(…,4)). */
export const qtyNum = (s: string | null | undefined) => (s == null || s === '' ? 0 : Number(s));
