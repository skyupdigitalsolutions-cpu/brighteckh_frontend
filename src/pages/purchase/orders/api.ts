// Purchase "Orders" (supplier PO register + PO page) data layer. Backend CLAUDE.md §4i "Purchase PO register".
//
// List: GET /purchase-orders (PURCHASE only) → PurchasePoPage {rows, total, page, page_size, counts_by_status (all 7, under
// `search` only)}. Value = Σ round(qty × unit_price, 2) in rupees (numeric string, NOT paise); no discount / freight / tax.
// Detail: GET /purchase-orders/{id} (PURCHASE) → PurchaseOrderReadDetail: header + names, job / SO number, customer,
// acknowledgement, shipments[] (newest first), grns[] (summaries), lines with item code/name, offered make / part /
// condition (repair lines) and received / outstanding qty.
// Writes (all @Roles(PURCHASE)): POST /purchase-orders/{id}/release · /acknowledge {supplier_reference?,
// expected_delivery_date?, notes?} · /shipment {carrier?, awb_or_lr_number?, expected_arrival_date?, notes?}. The server
// stamps acknowledged_at / shipped_at (no "on" date input). No cancel / close endpoint exists.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';
import { pk } from '../api';

const get = <T,>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

// ------------------------------------------------------------------ types (generated)
export type PoListRow = S<'PurchasePoRow'>;
export type PoListPage = S<'PurchasePoPage'>;
export type PoStatus = PoListRow['po_status'];
export type PoPurpose = PoListRow['purchase_purpose'];
export type PoDetail = S<'PurchaseOrderReadDetail'>;
export type PoLine = S<'PurchaseOrderReadLine'>;
export type PoGrnSummary = S<'PurchaseOrderGrnSummary'>;
export type PoRow = S<'Br06SupplierPurchaseOrdersRow'>;
export type AcknowledgePoBody = S<'AcknowledgePoDto'>;
export type ShipmentBody = S<'RecordShipmentDto'>;

export type PoListParams = {
  page?: number;
  /** ≤ 100 */
  page_size?: number;
  status?: PoStatus | PoStatus[];
  purpose?: PoPurpose | PoPurpose[];
  job_id?: string;
  sales_order_id?: string;
  supplier_id?: string;
  /** PO number, supplier, job number, sales order number, ack supplier reference, shipment AWB / LR. */
  search?: string;
};

/** Drops empty params; arrays → comma-separated. */
function qs(p: PoListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

// ------------------------------------------------------------------ keys
export const ok = {
  lists: ['purchase', 'po-register'] as const,
  list: (p: PoListParams) => ['purchase', 'po-register', qs(p)] as const,
  detail: (id: string) => ['purchase', 'po', id] as const,
};

// ------------------------------------------------------------------ reads
/** GET /purchase-orders — server pagination; the previous page stays on screen while the next loads. */
export const usePoList = (p: PoListParams) =>
  useQuery({ queryKey: ok.list(p), queryFn: () => get<PoListPage>('/purchase-orders', qs(p)), placeholderData: keepPreviousData });

/** GET /purchase-orders/{id} */
export const usePoDetail = (id: string | undefined) =>
  useQuery({ queryKey: ok.detail(id ?? ''), queryFn: () => get<PoDetail>(`/purchase-orders/${id}`), enabled: !!id });

// ------------------------------------------------------------------ writes
/** Each write refreshes the register, this PO, and (repair POs) the job workspace whose PO tab shows the same PO. */
function usePoWrite<A>(po: Pick<PoDetail, 'id' | 'job_id'>, fn: (a: A) => Promise<PoRow>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ok.lists }),
      qc.invalidateQueries({ queryKey: ok.detail(po.id) }),
      ...(po.job_id ? [qc.invalidateQueries({ queryKey: pk.job(po.job_id) })] : []),
    ]),
  });
}

export const useReleasePoDesk = (po: Pick<PoDetail, 'id' | 'job_id'>) =>
  usePoWrite<void>(po, () => post<PoRow>(`/purchase-orders/${po.id}/release`));
export const useAcknowledgePoDesk = (po: Pick<PoDetail, 'id' | 'job_id'>) =>
  usePoWrite<AcknowledgePoBody>(po, (b) => post<PoRow>(`/purchase-orders/${po.id}/acknowledge`, b));
export const useRecordShipmentDesk = (po: Pick<PoDetail, 'id' | 'job_id'>) =>
  usePoWrite<ShipmentBody>(po, (b) => post<PoRow>(`/purchase-orders/${po.id}/shipment`, b));
