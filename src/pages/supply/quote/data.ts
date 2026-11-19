// Stage A data helpers (non-component exports), see local.tsx for the layout pieces.
import { useState } from 'react';
import { useQueries, useQuery, keepPreviousData } from '@tanstack/react-query';
import { http, apiErrorText } from '../../../api/http';
import type { S } from '../../../api/types';
import { enumLabel } from '../../../lib/format';
import type { LookupSource } from '../../../ui/desktop';
import { purchaseApi, useCustomerLookup, useCustomersByIds } from '../../purchase/api';
import type { QuoteDetail, QuoteRevision } from '../api';

// ------------------------------------------------------------------ items (Item Master)
export type ItemRow = S<'FdnItemMasterRow'>;
export type ItemStatus = ItemRow['status'];
export const ISSUABLE_ITEM: readonly ItemStatus[] = ['APPROVED', 'ACTIVE'];

const itemKey = (id: string) => ['supply-a', 'item', id] as const;
const fetchItem = (id: string) => http.get<ItemRow>(`/masters/items/${id}`).then((r) => r.data);

/** GET /masters/items/:id for each id → Record<id, row>. Failed lookups (e.g. no access) are simply missing. */
export function useItems(ids: readonly (string | null | undefined)[]) {
  const clean = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const qs = useQueries({
    queries: clean.map((id) => ({ queryKey: itemKey(id), queryFn: () => fetchItem(id), staleTime: 60_000, retry: false })),
  });
  const map: Record<string, ItemRow> = {};
  qs.forEach((q, i) => { if (q.data) map[clean[i]!] = q.data; });
  return { map, pending: qs.some((q) => q.isPending), error: qs.find((q) => q.isError)?.error ?? null };
}

/** "CMP-IGB-0310 · IGBT module 1200 V 300 A" (code when the item resolves). */
export const itemLabel = (code: string | undefined, description: string) => (code ? `${code} · ${description}` : description);

const searchItems = async (search: string): Promise<{ rows: ItemRow[]; total: number }> => {
  const [a, b] = await Promise.all((['APPROVED', 'ACTIVE'] as const).map((status) =>
    http.get<ItemRow[]>('/masters/items', { params: { status, ...(search ? { search } : {}) } }).then((r) => r.data)));
  const rows = [...a!, ...b!].sort((x, y) => x.item_code.localeCompare(y.item_code));
  return { rows, total: rows.length };
};

/** Item Master picker: APPROVED + ACTIVE items (the statuses a quote can issue with, 11A-04). Never assemblies. */
export const itemSource: LookupSource<ItemRow> = {
  useSearch: (search, enabled) => useQuery({
    queryKey: ['supply-a', 'items', search], queryFn: () => searchItems(search), enabled, staleTime: 30_000, placeholderData: keepPreviousData,
  }),
  useResolve: (ids) => {
    const { map, pending, error } = useItems(ids);
    return { data: map, isPending: pending && ids.length > 0, isFetching: pending, isError: !!error, error, refetch: () => undefined };
  },
  getId: (r) => r.id,
  getLabel: (r) => `${r.item_code} · ${r.standard_name}`,
  getSub: (r) => `${r.base_uom} · ${enumLabel(r.status)}`,
  noun: 'items',
};

// ------------------------------------------------------------------ customers
type CustomerRow = S<'CustomerLookupRow'>;
export const ALL_CUSTOMER_STATUSES: NonNullable<CustomerRow['status']>[] = ['PENDING_APPROVAL', 'APPROVED', 'INACTIVE', 'REJECTED'];

export const approvedCustomerSource: LookupSource<CustomerRow> = {
  useSearch: (search, enabled) => useCustomerLookup({ search, page_size: 25, status: 'APPROVED' }, enabled),
  useResolve: (ids) => useCustomersByIds(ids, { status: ALL_CUSTOMER_STATUSES }),
  getId: (r) => r.id,
  getLabel: (r) => r.customer_name,
  getSub: (r) => r.customer_code,
  noun: 'customers',
};

// ------------------------------------------------------------------ money / dates
/** "7,400.50" → 740050 (integer paise) without floats; null when not a valid rupee amount. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/[,\s₹]/g, '');
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const p = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
  return p > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(p);
}


const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
/** ISO timestamp → company-local "YYYY-MM-DD" (prefill for date inputs). */
export const istYmd = (iso: string | null | undefined) => (iso ? ymd.format(new Date(iso)) : '');

export const cellText = {
  strong: 'truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg',
  text: 'truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2',
  num: 'whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg',
  numStrong: 'whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg',
  id: 'whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg',
};


// ------------------------------------------------------------------ quote helpers
type Line = QuoteRevision['lines'][number];
/** Pre-tax value of a revision = Σ line_total_paise (bigint string). */
export const revisionValue = (lines: Line[]) => lines.reduce((s, l) => s + BigInt(l.line_total_paise ?? '0'), 0n).toString();

export const latestRevision = (q: QuoteDetail): QuoteRevision | undefined =>
  [...q.revisions].sort((a, b) => b.revision_no - a.revision_no)[0];

export const termsLine = (r: QuoteRevision) =>
  [r.payment_terms_snapshot, r.delivery_terms_snapshot, r.warranty_terms_snapshot].filter(Boolean).join(' · ') || '—';

// ------------------------------------------------------------------ evidence upload (POST /uploads → file_uri)
export type Evidence = { name: string; state: 'uploading' | 'uploaded' | 'failed'; progress: number; uri?: string; error?: string; file: File };

export function useEvidence() {
  const [ev, setEv] = useState<Evidence | null>(null);
  const upload = (file: File) => {
    setEv({ name: file.name, state: 'uploading', progress: 0, file });
    purchaseApi.upload(file, (pct) => setEv((e) => (e && e.file === file ? { ...e, progress: pct } : e)))
      .then((r) => setEv((e) => (e && e.file === file ? { ...e, state: 'uploaded', progress: 100, uri: r.file_uri } : e)))
      .catch((err) => setEv((e) => (e && e.file === file ? { ...e, state: 'failed', error: apiErrorText(err) } : e)));
  };
  return { ev, upload, clear: () => setEv(null), busy: ev?.state === 'uploading', failed: ev?.state === 'failed', uri: ev?.uri };
}

/** File name from an /api/uploads/<id> uri (the API keeps no original name). */
export const fileLabel = (uri: string) => uri.split('/').filter(Boolean).pop() ?? uri;


const dmIst = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** ISO timestamp → "03 Nov" (IST). */
export const istDayMonth = (iso: string | null | undefined) => (iso ? dmIst.format(new Date(iso)) : '—');
