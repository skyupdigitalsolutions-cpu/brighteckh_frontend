// Purchase "Stock" pill data layer. Backend CLAUDE.md §4i "Purchase Stock desk" — every route PURCHASE only, read-only.
//
// Availability: the existing GET /inventory/availability?company_id=&item_id= → {allocatable (fdn_allocatable), balances
// [{role, code, qty_on_hand}]}. company_id must be the caller's own (CompanyScopeGuard), so it comes from /auth/me.
// Journal: GET /stock/journal → {rows, total, page, page_size, counts_by_movement_type (company + search only)}. Each row has
// the item, from/to location role + code, the reference resolved to a GRN / job / SOUT number (`reference_label`), actor.
// Items: GET /stock/items (all statuses, counts by status + record type) and /stock/items/{id} (+ used_in on assemblies'
// latest BOM revision, + the company's availability incl. reserved).
// Assemblies: GET /stock/assemblies (+ latest BOM revision, line count, non-requestable lines) and /stock/assemblies/{id}
// (?revision=, default latest; BOM lines with item status).
// Quantities are decimal strings (trailing zeros trimmed on /stock/*).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { http } from '../../../api/http';
import type { S } from '../../../api/types';

const get = <T,>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);

// ------------------------------------------------------------------ types (generated)
export type JournalRow = S<'StockJournalRow'>;
export type JournalPage = S<'StockJournalPage'>;
export type MovementType = JournalRow['movement_type'];
export type ItemRow = S<'StockItemRow'>;
export type ItemsPage = S<'StockItemsPage'>;
export type ItemDetail = S<'StockItemDetail'>;
export type MasterStatus = ItemRow['status'];
export type RecordType = ItemRow['record_type'];
export type AssemblyRow = S<'StockAssemblyRow'>;
export type AssembliesPage = S<'StockAssembliesPage'>;
export type AssemblyDetail = S<'StockAssemblyDetail'>;
export type Availability = S<'InventoryAvailabilityResponse'>;
export type LocationRole = S<'StockBalance'>['role'];

/** The 7 ledger location roles in Figma's "By location role" order (D·I1 177:105342). */
export const LOCATION_ROLES: LocationRole[] = ['MAIN_STORE', 'ENGINEER_HELD', 'QUARANTINE', 'IN_TRANSIT', 'RETURNED', 'CONSUMED', 'SUPPLIER_RETURN'];

type Csv<T extends string> = T | T[];
export type JournalParams = {
  page?: number; page_size?: number; search?: string;
  movement_type?: Csv<MovementType>; reference_kind?: Csv<string>; reference_id?: string; item_id?: string;
  location_role?: Csv<LocationRole>; from?: string; to?: string;
};
export type ItemsParams = { page?: number; page_size?: number; search?: string; status?: Csv<MasterStatus>; record_type?: Csv<RecordType>; stock_flag?: Csv<string> };
export type AssembliesParams = { page?: number; page_size?: number; search?: string; status?: Csv<MasterStatus> };

/** Drops empty params; arrays → comma-separated. */
function qs(p: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

// ------------------------------------------------------------------ keys
export const sk = {
  availability: (company: string, item: string) => ['stock', 'availability', company, item] as const,
  journal: (p: JournalParams) => ['stock', 'journal', qs(p)] as const,
  items: (p: ItemsParams) => ['stock', 'items', qs(p)] as const,
  item: (id: string) => ['stock', 'item', id] as const,
  assemblies: (p: AssembliesParams) => ['stock', 'assemblies', qs(p)] as const,
  assembly: (id: string, revision?: number) => ['stock', 'assembly', id, revision ?? 'latest'] as const,
};

// ------------------------------------------------------------------ reads
export const useAvailability = (companyId: string | undefined, itemId: string | null) =>
  useQuery({
    queryKey: sk.availability(companyId ?? '', itemId ?? ''),
    queryFn: () => get<Availability>('/inventory/availability', { company_id: companyId, item_id: itemId }),
    enabled: !!companyId && !!itemId,
  });

export const useJournal = (p: JournalParams) =>
  useQuery({ queryKey: sk.journal(p), queryFn: () => get<JournalPage>('/stock/journal', qs(p)), placeholderData: keepPreviousData });

export const useStockItems = (p: ItemsParams, enabled = true) =>
  useQuery({ queryKey: sk.items(p), queryFn: () => get<ItemsPage>('/stock/items', qs(p)), placeholderData: keepPreviousData, enabled });

export const useStockItem = (id: string | null | undefined) =>
  useQuery({ queryKey: sk.item(id ?? ''), queryFn: () => get<ItemDetail>(`/stock/items/${id}`), enabled: !!id });

export const useStockAssemblies = (p: AssembliesParams) =>
  useQuery({ queryKey: sk.assemblies(p), queryFn: () => get<AssembliesPage>('/stock/assemblies', qs(p)), placeholderData: keepPreviousData });

export const useStockAssembly = (id: string | undefined, revision?: number) =>
  useQuery({
    queryKey: sk.assembly(id ?? '', revision),
    queryFn: () => get<AssemblyDetail>(`/stock/assemblies/${id}`, revision === undefined ? undefined : { revision }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
