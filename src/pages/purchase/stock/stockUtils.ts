// Stock pill helpers: the approved-item picker source (I1 "Item picker open" 177:129118: "Search approved items", options
// "NOS · ACTIVE") and quantity formatting.
import { useQuery } from '@tanstack/react-query';
import { http } from '../../../api/http';
import { enumLabel } from '../../../lib/format';
import type { LookupSource } from '../../../ui/desktop/LookupPicker';
import { useStockItems, type ItemDetail, type ItemRow } from './api';

type ItemPick = Pick<ItemRow, 'id' | 'item_code' | 'standard_name' | 'base_uom' | 'status'>;

/** Approved / active items only — the statuses the ledger can hold stock for. */
export const approvedItemSource: LookupSource<ItemPick> = {
  useSearch: (search, enabled) => useStockItems({ status: ['APPROVED', 'ACTIVE'], page_size: 25, ...(search ? { search } : {}) }, enabled),
  useResolve: (ids) => useQuery({
    queryKey: ['stock', 'item-pick-resolve', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const out: Record<string, ItemPick> = {};
      for (const i of await Promise.all(ids.map((id) => http.get<ItemDetail>(`/stock/items/${id}`).then((r) => r.data)))) out[i.id] = i;
      return out;
    },
  }),
  getId: (r) => r.id,
  getLabel: (r) => `${r.item_code} · ${r.standard_name}`,
  getSub: (r) => `${r.base_uom} · ${enumLabel(r.status)}`,
  noun: 'approved items',
};

/** Decimal-string quantity → number (0 for null / bad input). */
export const num = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Plain quantity text with up to 4 decimals, no grouping noise for small numbers. */
export const qtyText = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
