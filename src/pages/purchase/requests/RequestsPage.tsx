// Purchase "Requests" — company-wide material-request inbox. Figma section 03d "Purchase · Requests · every interaction"
// 177:117991 (detail frames 177:117992 / 118135 / 118278 / 118421 / 118564 / 118707, results 177:118852 / 118996 /
// 119149 / 119302 / 119446, tabs 177:119590 / 119689 / 119776 / 119864, search 177:119943) + static D·P3 177:103332.
//
// Layout: page header "Material requests" + meta · glass tab bar (no shadow) with "Label · n" counts · optional result
// banner (success InlineAlert) · Split (gap 16, fills the height):
//   List card  (glass-strong, radius 24, p-20, flex-1): search (subtle fill, h-40, radius 20, no border) · 14px gap ·
//     header row (subtle, radius 18, px-14 py-10) · rows (px-14 py-13, 1px bottom border; selected = brand-subtle fill +
//     1px brand-border, radius 16). Columns: Request 110 · Job 90 · Engineer flex · Priority 96 · Status 150.
//   Detail card (glass-strong, radius 24, p-20, gap 14, w-460): see RequestDetail.tsx.
//
// DATA: GET /purchase/material-requests (contract: purchase-pills-map.md §1) — server pagination, `status` per tab,
// debounced `search`, tab counts from `counts_by_status`. Detail = GET /jobs/{id}/material-requests (see ./api.ts).
// Deviations from Figma: see RequestDetail.tsx and the report; on this page — numbers are DB values (MR-BLR-000057,
// JOB-…), the "All" tab = every status except DRAFT (an engineer's unsent draft; RETURNED / WITHDRAWN have no tab of
// their own and show under All), pagination (kit) under the rows when there is more than one page (not drawn).
import { useState } from 'react';
import { IconInbox, IconSearch } from '@tabler/icons-react';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { SearchField } from '../../../ui/desktop/SearchField';
import { THead, TH, TR, TD, SkeletonRows } from '../../../ui/desktop/DataTable';
import { StatusPill, PriorityChip } from '../../../ui/desktop/Badge';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { Pagination } from '../../../ui/desktop/Pagination';
import { Button } from '../../../ui/desktop/Button';
import { GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { cx } from '../../../ui/desktop/Icon';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { usePurchaseMrList, type MrStatus, type PurchaseMrListPage, type PurchaseMrListRow } from './api';
import { RequestDetail, DetailSkeleton, type ResultBanner } from './RequestDetail';

const PAGE_SIZE = 10;
const COLS = { request: 110, job: 90, priority: 96, status: 150 } as const;

type TabKey = 'all' | 'SUBMITTED' | 'CHANGE_REQUESTED' | 'PROCESSING' | 'CLOSED';
/** "All" leaves out DRAFT: the engineer hasn't sent it to Purchase yet. */
const ALL_SENT: MrStatus[] = ['SUBMITTED', 'CHANGE_REQUESTED', 'PROCESSING', 'RETURNED', 'WITHDRAWN', 'CLOSED'];
const TABS: { key: TabKey; label: string; statuses: MrStatus[] }[] = [
  { key: 'all', label: 'All', statuses: ALL_SENT },
  { key: 'SUBMITTED', label: 'Submitted', statuses: ['SUBMITTED'] },
  { key: 'CHANGE_REQUESTED', label: 'Change requested', statuses: ['CHANGE_REQUESTED'] },
  { key: 'PROCESSING', label: 'Processing', statuses: ['PROCESSING'] },
  { key: 'CLOSED', label: 'Closed', statuses: ['CLOSED'] },
];
const countFor = (counts: PurchaseMrListPage['counts_by_status'] | undefined, statuses: MrStatus[]) =>
  counts ? statuses.reduce((n, s) => n + (counts[s] ?? 0), 0) : null;

const card = 'glass-strong flex flex-col items-start overflow-clip rounded-[24px] p-[20px]';

export function RequestsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // The picked row is kept as a snapshot so an action that moves it out of the current tab (e.g. Start processing on
  // the Submitted tab) leaves it open with its result banner. Changing tab / search / page clears the pick.
  const [picked, setPicked] = useState<PurchaseMrListRow | null>(null);
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const q = useDebouncedValue(search.trim());

  const statuses = TABS.find((t) => t.key === tab)!.statuses;
  const listQ = usePurchaseMrList({ page, page_size: PAGE_SIZE, status: statuses, ...(q ? { search: q } : {}) });
  const data = listQ.data;
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  // Fresh row for the pick, else the pick's snapshot, else the first row (Figma always shows a row open).
  const selected: PurchaseMrListRow | undefined = (picked && (rows.find((r) => r.id === picked.id) ?? picked)) ?? rows[0];
  // A banner describes the last action on one request; it shows only while that request is open.
  const shownBanner = banner && selected && banner.mrId === selected.id ? banner : null;

  const changeTab = (k: TabKey) => { setTab(k); setPage(1); setPicked(null); };
  const changeSearch = (v: string) => { setSearch(v); setPage(1); setPicked(null); };
  const changePage = (p: number) => { setPage(p); setPicked(null); };
  const filtered = tab !== 'all' || !!q;

  return (
    <>
      <PageHeader title="Material requests" meta="Straight from engineers — no approval step. Pick one up and start sourcing." />
      <PageContent className="flex-1">
        <TabBar label="Request status">
          {TABS.map((t) => (
            <Tab key={t.key} active={tab === t.key} onClick={() => changeTab(t.key)} label={t.label} count={countFor(data?.counts_by_status, t.statuses)} />
          ))}
        </TabBar>

        {shownBanner && (
          <InlineAlert tone="success" title={shownBanner.title}>{shownBanner.body}</InlineAlert>
        )}
        {shownBanner?.notifyGap && (
          <GapNote code="GAP-MR-3">
            The engineer isn&apos;t notified of this decision — the system has no notifications yet (G23). Tell them directly.
          </GapNote>
        )}

        {!data && listQ.isError ? (
          <StateCard>
            <ErrorState title="Couldn't load material requests" body={errorBody(listQ.error)} onRetry={() => listQ.refetch()} retrying={listQ.isFetching} />
          </StateCard>
        ) : (
          <div className="flex min-h-[586px] w-full flex-1 items-stretch gap-[16px]">
            {/* List (177:118003) */}
            <section aria-label="Material requests" className={cx(card, 'min-w-px flex-1')}>
              <SearchField
                value={search}
                onChange={changeSearch}
                placeholder="Search MR, job, engineer"
                width="full"
                className="w-full !rounded-[20px] !border-transparent !bg-subtle"
              />
              <div className="h-[14px] w-px shrink-0" aria-hidden />
              {!data ? (
                <>
                  <HeadRow />
                  <div className="w-full"><SkeletonRows rows={7} widths={[80, 64, 140, 60, 110]} /></div>
                </>
              ) : rows.length === 0 ? (
                <div className="flex w-full flex-1 items-center justify-center">
                  <EmptyState
                    icon={filtered ? IconSearch : IconInbox}
                    title={filtered ? 'No requests match' : 'No material requests yet'}
                    body={filtered ? 'Try another tab or search.' : 'Engineers raise a material request from the mobile app once Purchase accepts their inspection report. It lands here.'}
                    action={filtered ? <Button kind="secondary" onClick={() => { changeTab('all'); changeSearch(''); }}>Clear filters</Button> : undefined}
                  />
                </div>
              ) : (
                <>
                  <HeadRow />
                  <div
                    role="rowgroup"
                    className={cx('flex w-full flex-col transition-opacity', listQ.isPlaceholderData && 'opacity-60')}
                    aria-busy={listQ.isPlaceholderData || undefined}
                  >
                    {rows.map((r) => <MrRow key={r.id} row={r} selected={r.id === selected?.id} onSelect={() => setPicked(r)} />)}
                  </div>
                  {listQ.isError && <p className="mt-[8px] text-[12px] leading-[16px] text-st-blocked-fg">Couldn't refresh: {errorBody(listQ.error)}</p>}
                  <div className="h-px min-h-[16px] w-full flex-1" aria-hidden />
                  <Pagination page={Math.min(page, pages)} pages={pages} onChange={changePage} />
                </>
              )}
            </section>

            {/* Detail (177:118096) */}
            <section aria-label="Request detail" className={cx(card, 'w-[460px] shrink-0 gap-[14px]')}>
              {!data ? <DetailSkeleton />
                : !selected ? (
                  <div className="flex w-full flex-1 items-center justify-center">
                    <p className="text-[14px] leading-[20px] text-fg-2">Select a request to see its parts.</p>
                  </div>
                )
                  : <RequestDetail key={selected.id} row={selected} onResult={setBanner} />}
            </section>
          </div>
        )}
      </PageContent>
    </>
  );
}

// ------------------------------------------------------------------ list rows
const headCls = '!rounded-[18px] !px-[14px] !py-[10px]';

function HeadRow() {
  return (
    <THead className={headCls}>
      <TH w={COLS.request}>Request</TH>
      <TH w={COLS.job}>Job</TH>
      <TH grow>Engineer</TH>
      <TH w={COLS.priority}>Priority</TH>
      <TH w={COLS.status}>Status</TH>
    </THead>
  );
}

function MrRow({ row, selected, onSelect }: { row: PurchaseMrListRow; selected: boolean; onSelect: () => void }) {
  return (
    <TR
      onClick={onSelect}
      selected={selected}
      className={cx(
        '!px-[14px] !py-[13px]',
        selected && '!rounded-[16px] !border !border-brand-border !bg-brand-subtle',
      )}
    >
      <TD w={COLS.request}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          aria-pressed={selected}
          className="truncate whitespace-nowrap text-left font-mono text-[13px] font-medium leading-[18px] text-fg focus:outline-none focus-visible:underline"
          title={row.request_number}
        >
          {row.request_number}
        </button>
      </TD>
      <TD w={COLS.job}>
        <span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg-2" title={row.job_number}>{row.job_number}</span>
      </TD>
      <TD grow kind="strong">{row.responsible_engineer_name ?? '—'}</TD>
      <TD w={COLS.priority}><PriorityChip priority={row.priority} /></TD>
      <TD w={COLS.status}><StatusPill domain="materialRequest" value={row.status} /></TD>
    </TR>
  );
}
