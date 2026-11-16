// Stores / Quality desk data layer (ST-D panel 177:139285).
//
// Reads (STORES_QUALITY only, quantities only: the server never sends price / currency / payment terms):
//   GET /stores/receivable-pos       POs to receive (RELEASED / ACKNOWLEDGED / SHIPPED) + ack + latest shipment
//   GET /stores/purchase-orders/:id  PO lines with item code/name, received / outstanding qty, the PO's GRNs
//   GET /stores/grns                 GRN register, derived grn_status OPEN / PARTIAL / POSTED
//   GET /stores/grns/:id             GRN lines with photos, posted-by and the ledger movements they produced
// Writes (BR-06, STORES_QUALITY):
//   POST /purchase-orders/:id/grns   { lines: [{ po_line_id, received_quantity >= 1 }], notes? }  (PO ACKNOWLEDGED / SHIPPED)
//   POST /grn-lines/:id/media        { file_uri, file_name }   (file_uri from POST /uploads)
//   POST /grn-lines/:id/post         { accepted_quantity, rejected_quantity, held_quantity }
//     -> server: photo gate (DB trigger), accepted + rejected + held <= received, accepted -> MAIN_STORE,
//        rejected + held -> QUARANTINE, one post per line (re-post = 400 "already posted").
// Quantities arrive as decimal strings; the post body takes numbers (PostGrnLineDto).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { components } from '../../api/schema';

type Schemas = components['schemas'];
export type ReceivablePoRow = Schemas['ReceivablePoRow'];
export type ReceivablePoPage = Schemas['ReceivablePoPage'];
export type PoStatus = ReceivablePoRow['po_status'];
export type StoresPoDetail = Schemas['StoresPoDetail'];
export type StoresPoLine = Schemas['StoresPoLine'];
export type StoresGrnRow = Schemas['StoresGrnRow'];
export type StoresGrnPage = Schemas['StoresGrnPage'];
export type GrnStatus = StoresGrnRow['grn_status'];
export type StoresGrnDetail = Schemas['StoresGrnDetail'];
export type StoresGrnLine = Schemas['StoresGrnLine'];
export type LedgerMovement = Schemas['StoresLedgerMovement'];
export type CreateGrnBody = Schemas['CreateGrnDto'];
export type PostGrnLineBody = Schemas['PostGrnLineDto'];
type GrnCreated = Schemas['GrnDetail'];
type GrnLineMedia = Schemas['Br06GrnLineMediaRow'];
type GrnLinePosted = Schemas['Br06GrnLinesRow'];

export type ListParams = { status?: string[]; search?: string; page?: number; page_size?: number };

/** Drops empty params; arrays -> comma-separated (the API's multi-value format). */
function qs(p: ListParams = {}): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = v as string | number;
  }
  return out;
}

const get = <T>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

export const storesApi = {
  receivablePos: (p?: ListParams) => get<ReceivablePoPage>('/stores/receivable-pos', qs(p)),
  purchaseOrder: (id: string) => get<StoresPoDetail>(`/stores/purchase-orders/${id}`),
  grns: (p?: ListParams) => get<StoresGrnPage>('/stores/grns', qs(p)),
  grn: (id: string) => get<StoresGrnDetail>(`/stores/grns/${id}`),
  createGrn: (poId: string, b: CreateGrnBody) => post<GrnCreated>(`/purchase-orders/${poId}/grns`, b),
  addLineMedia: (lineId: string, b: { file_uri: string; file_name: string }) => post<GrnLineMedia>(`/grn-lines/${lineId}/media`, b),
  postLine: (lineId: string, b: PostGrnLineBody) => post<GrnLinePosted>(`/grn-lines/${lineId}/post`, b),
};

export const stk = {
  all: ['stores'] as const,
  receivable: (p?: ListParams) => ['stores', 'receivable', qs(p)] as const,
  po: (id: string) => ['stores', 'po', id] as const,
  grns: (p?: ListParams) => ['stores', 'grns', qs(p)] as const,
  grn: (id: string) => ['stores', 'grn', id] as const,
};

export const useReceivablePos = (p?: ListParams) =>
  useQuery({ queryKey: stk.receivable(p), queryFn: () => storesApi.receivablePos(p), placeholderData: keepPreviousData });
export const useStoresPo = (id: string) => useQuery({ queryKey: stk.po(id), queryFn: () => storesApi.purchaseOrder(id) });
export const useGrns = (p?: ListParams) =>
  useQuery({ queryKey: stk.grns(p), queryFn: () => storesApi.grns(p), placeholderData: keepPreviousData });
export const useGrn = (id: string) => useQuery({ queryKey: stk.grn(id), queryFn: () => storesApi.grn(id) });

/** Every write changes PO progress, the GRN register and the GRN itself: refresh all Stores reads. */
const useInvalidateStores = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: stk.all });
};

export function useCreateGrn(poId: string) {
  const inv = useInvalidateStores();
  return useMutation({ mutationFn: (b: CreateGrnBody) => storesApi.createGrn(poId, b), onSuccess: () => inv() });
}

export function useAddLineMedia() {
  const inv = useInvalidateStores();
  return useMutation({
    mutationFn: ({ lineId, ...b }: { lineId: string; file_uri: string; file_name: string }) => storesApi.addLineMedia(lineId, b),
    onSuccess: () => inv(),
  });
}

export function usePostLine() {
  const inv = useInvalidateStores();
  return useMutation({
    mutationFn: ({ lineId, ...b }: PostGrnLineBody & { lineId: string }) => storesApi.postLine(lineId, b),
    onSuccess: () => inv(),
  });
}

// ------------------------------------------------------------------ quantities
/** Decimal string -> number for arithmetic (GRN quantities are numeric(16,4); NOS/units in practice). */
export const num = (s: string | null | undefined) => (s == null || s === '' ? 0 : Number(s));
