// I2 · Stock · Journal (/p/stock/journal) — Figma D·I2 177:105406; 03h: Reference menu 177:129392 (+ results 177:129579 …
// 129801), Movement menu 177:129850 (All, Receipt, Issue, Consume, Return, Supplier return, Adjust; results 177:130043 …).
// Toolbar: lock note "Append-only · retries never double-post (idempotency key)" + Reference / Movement menus. Table:
// Posted 120 · Movement 150 · Item 130 (mono) · Qty 90 → · From → to flex · Reference 170 (mono) · Status 110.
//
// DATA: GET /stock/journal (PURCHASE) — server pagination, `movement_type`, `location_role`, debounced `search`; movement
// option counts from `counts_by_movement_type` (search scope). Deviations from Figma (see the report):
// - Figma's "Reference: All" menu lists recent references; the API resolves each reference to its GRN / job / SOUT number
//   and searches them, so the menu is a search field ("Search item, GRN, job, SOUT") + a Location menu.
// - Reference text: GRN number (receipts / supplier returns), "ISS / CON / RTN · <job number>" (BR-07), SOUT number
//   (product sale). Clicking it opens the PO's goods receipts, the job, or the outward. "ADJ-0007": no adjustment document
//   or writer exists → GapNote GAP-STK-3 on the Adjust filter.
import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconLock, IconNotebook, IconSearch } from '@tabler/icons-react';
import {
  EmptyState, ErrorState, FilterMenu, GapNote, Ic, PageContent, Pagination, SearchField, SkeletonRows, StatusPill, TD, TH, TR,
  TableCard, ToolbarCard, ToolbarSpacer, errorBody, type FilterOption,
} from '../../../ui/desktop';
import { enumLabel, formatDayTime, formatQty } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { LOCATION_ROLES, useJournal, type JournalRow, type LocationRole, type MovementType } from './api';
import { StockHeader, StockTabs } from './shared';

const PAGE_SIZE = 25;
const COLS = { posted: 120, movement: 150, item: 130, qty: 90, ref: 170, status: 110 } as const;
const MOVEMENTS: MovementType[] = ['RECEIPT', 'ISSUE', 'CONSUME', 'RETURN', 'SUPPLIER_RETURN', 'TRANSFER', 'ADJUST'];
const BR07_PREFIX: Record<string, string> = { BR07_ISSUE: 'ISS', BR07_CONSUME: 'CON', BR07_RETURN: 'RTN' };
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function JournalTab() {
  const [movement, setMovement] = useState<MovementType | 'ALL'>('ALL');
  const [location, setLocation] = useState<LocationRole | 'ALL'>('ALL');
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);

  const q = useJournal({
    page, page_size: PAGE_SIZE,
    ...(movement === 'ALL' ? {} : { movement_type: movement }),
    ...(location === 'ALL' ? {} : { location_role: location }),
    ...(search ? { search } : {}),
  });
  const data = q.data;
  const counts = data?.counts_by_movement_type;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const movementOptions: FilterOption<MovementType | 'ALL'>[] = [
    { value: 'ALL', label: counts ? `All · ${Object.values(counts).reduce((a, b) => a + b, 0)}` : 'All' },
    ...MOVEMENTS.map((m) => ({ value: m, label: counts ? `${cap(m)} · ${counts[m]}` : cap(m) })),
  ];
  const locationOptions: FilterOption<LocationRole | 'ALL'>[] = [
    { value: 'ALL', label: 'All locations' },
    ...LOCATION_ROLES.map((r) => ({ value: r, label: cap(r) })),
  ];
  const filtered = movement !== 'ALL' || location !== 'ALL' || !!search;

  return (
    <>
      <StockHeader meta="Every stock movement, newest first. Entries are never edited." />
      <PageContent className="flex-1">
        <StockTabs />
        <ToolbarCard className="pl-[20px]">
          <p className="flex items-center gap-[6px] whitespace-nowrap text-[12px] leading-[16px] text-fg-2">
            <Ic icon={IconLock} size={14} /> Append-only · retries never double-post (idempotency key)
          </p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search item, GRN, job, SOUT" />
          <FilterMenu label="Location" value={location} options={locationOptions} allValue="ALL" align="end"
            onChange={(v) => { setLocation(v); setPage(1); }} />
          <FilterMenu label="Movement" value={movement} options={movementOptions} allValue="ALL" align="end"
            onChange={(v) => { setMovement(v); setPage(1); }} />
        </ToolbarCard>

        {movement === 'ADJUST' && (
          <GapNote code="GAP-STK-3">Stock adjustments have no document (no ADJ number) and no API posts them yet, so this filter stays empty.</GapNote>
        )}

        <TableCard fill>
          <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
            <TH w={COLS.posted}>Posted</TH>
            <TH w={COLS.movement}>Movement</TH>
            <TH w={COLS.item}>Item</TH>
            <TH w={COLS.qty} align="right">Qty</TH>
            <TH grow>From → to</TH>
            <TH w={COLS.ref}>Reference</TH>
            <TH w={COLS.status}>Status</TH>
          </div>
          {q.isPending ? <SkeletonRows rows={8} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load the stock journal" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconNotebook}
                title={search ? `No movements match “${search}”` : filtered ? 'No movements for this filter' : 'No stock movements yet'}
                body={search
                  ? 'Search covers item code and name, GRN, PO, job, SOUT and sales order numbers, and who posted it.'
                  : filtered ? undefined : 'Goods receipts, job issues, consumption, returns and sales dispatches post here.'}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <JournalRowView key={r.id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </TableCard>
      </PageContent>
    </>
  );
}

function referenceText(r: JournalRow): string {
  if (!r.reference_label) return enumLabel(r.reference_kind);
  const p = BR07_PREFIX[r.reference_kind];
  return p ? `${p} · ${r.reference_label}` : r.reference_label;
}

function referenceLink(r: JournalRow): string | null {
  if (r.reference_document === 'GRN' && r.po_id) return `/p/orders/${r.po_id}#goods-receipts`;
  if (r.reference_document === 'JOB' && r.job_id) return `/p/jobs/${r.job_id}/overview`;
  if (r.reference_document === 'SALES_OUTWARD' && r.outward_id) return `/p/supply/outwards/${r.outward_id}`;
  return null;
}

function JournalRowView({ r }: { r: JournalRow }) {
  const navigate = useNavigate();
  const link = referenceLink(r);
  const loc = (role: string | null) => (role ? enumLabel(role) : '—');
  const go = (e: MouseEvent) => { e.stopPropagation(); if (link) navigate(link); };
  return (
    <TR className="gap-[12px]">
      <TD w={COLS.posted} kind="text">{formatDayTime(r.posted_at)}</TD>
      <TD w={COLS.movement}><StatusPill domain="stockMovement" value={r.movement_type} /></TD>
      <TD w={COLS.item}>
        <span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg" title={r.item_name}>{r.item_code}</span>
      </TD>
      <TD w={COLS.qty} align="right">
        <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{formatQty(r.qty, r.uom)}</span>
      </TD>
      <TD grow kind="text">
        <span title={[r.from_location_code, r.to_location_code].filter(Boolean).join(' → ')}>{loc(r.from_location_role)} → {loc(r.to_location_role)}</span>
      </TD>
      <TD w={COLS.ref}>
        {link ? (
          <button type="button" onClick={go} className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg underline-offset-2 hover:underline"
            title={r.actor_name ? `Posted by ${r.actor_name}` : undefined}>
            {referenceText(r)}
          </button>
        ) : (
          <span className="truncate text-[12px] leading-[16px] text-fg-2" title={r.reference_id ?? undefined}>{referenceText(r)}</span>
        )}
      </TD>
      <TD w={COLS.status}><StatusPill domain="journalStatus" value={r.status} /></TD>
    </TR>
  );
}
