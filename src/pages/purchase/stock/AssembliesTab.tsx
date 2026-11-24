// M2 · Stock · Assemblies (/p/stock/assemblies) — Figma 177:134888 "M2 · Assemblies list". Table: Assembly code 140 (mono)
// · Name flex · Make / model 240 (secondary) · BOM rev 90 · Lines 70 · Status 150. Row → assembly page (D·M2 177:105242).
//
// DATA: GET /stock/assemblies (PURCHASE) — server pagination, `status`, debounced `search`; option counts from
// `counts_by_status` (search scope). Deviations from Figma (see the report):
// - "Make / model" has no column in the Assembly Master: the closest field, OEM compatibility, is shown (GapNote GAP-STK-4).
// - Read-only pill: "+ New assembly" is not shown (the Masters write exists, but its drawer needs fields Figma doesn't draw).
// - The toolbar gains a count, search and Status menu (not drawn) so the list can page and filter like Items.
import { useState } from 'react';
import { IconSearch, IconStack2 } from '@tabler/icons-react';
import {
  EmptyState, ErrorState, FilterMenu, GapNote, PageContent, Pagination, SearchField, SkeletonRows, StatusPill, TD, TH, TR,
  TableCard, ToolbarCard, ToolbarSpacer, errorBody, type FilterOption,
} from '../../../ui/desktop';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { useStockAssemblies, type AssemblyRow, type MasterStatus } from './api';
import { StockHeader, StockTabs } from './shared';

const PAGE_SIZE = 25;
const COLS = { code: 140, make: 240, rev: 90, lines: 70, status: 150 } as const;
const STATUSES: MasterStatus[] = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'SUPERSEDED', 'INACTIVE'];
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function AssembliesTab() {
  const [status, setStatus] = useState<MasterStatus | 'ALL'>('ALL');
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const q = useStockAssemblies({ page, page_size: PAGE_SIZE, ...(status === 'ALL' ? {} : { status }), ...(search ? { search } : {}) });
  const data = q.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const sc = data?.counts_by_status;
  const statusOptions: FilterOption<MasterStatus | 'ALL'>[] = [
    { value: 'ALL', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: sc ? `${cap(s)} · ${sc[s]}` : cap(s) })),
  ];

  return (
    <>
      <StockHeader meta="Only approved items can be requested by engineers." />
      <PageContent className="flex-1">
        <StockTabs />
        <ToolbarCard className="pl-[20px]">
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{!data ? '…' : `${total} assembl${total === 1 ? 'y' : 'ies'}`}</p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search code, name or OEM" />
          <FilterMenu label="Status" value={status} options={statusOptions} allValue="ALL" align="end" onChange={(v) => { setStatus(v); setPage(1); }} />
        </ToolbarCard>
        <GapNote code="GAP-STK-4">The Assembly Master has no make or model columns: the Make / model column shows its OEM compatibility text.</GapNote>

        <TableCard fill>
          <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
            <TH w={COLS.code}>Assembly code</TH>
            <TH grow>Name</TH>
            <TH w={COLS.make}>Make / model</TH>
            <TH w={COLS.rev}>BOM rev</TH>
            <TH w={COLS.lines}>Lines</TH>
            <TH w={COLS.status}>Status</TH>
          </div>
          {q.isPending ? <SkeletonRows rows={6} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load assemblies" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconStack2}
                title={search ? `No assemblies match “${search}”` : status !== 'ALL' ? 'No assemblies in this status' : 'No assemblies in the Assembly Master yet'}
                body={search ? 'Search covers assembly code, name and OEM compatibility.' : undefined}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <AssemblyRowView key={r.id} r={r} />)}
            </div>
          )}
        </TableCard>
        {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />}
      </PageContent>
    </>
  );
}

function AssemblyRowView({ r }: { r: AssemblyRow }) {
  return (
    <TR to={`/p/stock/assemblies/${r.id}`} className="gap-[12px]">
      <TD w={COLS.code} kind="id">{r.assembly_code}</TD>
      <TD grow kind="strong">{r.standard_name}</TD>
      <TD w={COLS.make} kind="text">{r.oem_compatibility ?? '—'}</TD>
      <TD w={COLS.rev} kind="number">{r.latest_bom_revision ?? '—'}</TD>
      <TD w={COLS.lines} kind="number">{r.bom_lines}</TD>
      <TD w={COLS.status}><StatusPill domain="itemStatus" value={r.status} /></TD>
    </TR>
  );
}
