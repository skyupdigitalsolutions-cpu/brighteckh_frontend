// D·P1 · Inward register — success 177:102734 · loading 177:102937 · empty 177:103043 · error 177:103069.
// 03b interactions: tabs 177:105577 / 105680 / 105743; status menu 177:105806 + applied 106026…106382; priority
// menu 177:106445 + applied 106659 / 106802 / 106885; date menu 177:106948 + Oct 177:107164 / Sep 177:107367;
// search "bharat" 177:107570; pages 2/3/4 177:107634 / 107837 / 108040; row menus 177:108729…110276.
//
// Layout: PageHeader (title + meta, no action) → Tab bar (shadow) → Toolbar (Create JIN · spacer · search 300 ·
// Status · Priority · date) → Table card (header row + rows, 8 per page) → Pagination. With one page the card
// fills to the bottom (656 tall, as in the loading / search frames); with pagination it is 586.
//
// Data: GET /inward-receipts (useInwardReceiptsList) — server pagination (page_size 8), status / priority / month
// filters and search (JIN, customer, DC no.), newest receipt_at first. The tab's status set and the Status filter are
// intersected before they are sent. The previous page stays on screen (dimmed) while the next one loads.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCamera, IconEye, IconFilePlus, IconPackage, IconPlus } from '@tabler/icons-react';
import { useAuth } from '../../../../auth/AuthProvider';
import { can } from '../../../../auth/access';
import { enumLabel, formatDayTime, formatMonthYear } from '../../../../lib/format';
import { useDebouncedValue } from '../../../../lib/useDebouncedValue';
import {
  Button, cx, EmptyState, ErrorState, FilterMenu, GapNote, Ic, PageContent, PageHeader, Pagination, PriorityChip,
  RowMenuTrigger, SearchField, SkeletonRows, StateCard, StatusPill, Tab, TabBar, TableCard, TD, TH, THead, TR,
  ToolbarCard, ToolbarSpacer, UnitsProgress, errorBody, useToast, type RowMenuItem,
} from '../../../../ui/desktop';
import { useInwardReceiptsList, type ReceiptListRow, type ReceiptsListParams } from '../../api';
import { CreateJinDrawer } from '../detail/CreateJinDrawer';

const PAGE_SIZE = 8; // rows per page in 177:102734

type ReceiptStatus = ReceiptListRow['receipt_status'];
type ReceiptPriority = ReceiptListRow['priority'];

/** Tabs (177:102738, no counts drawn): All receipts · Awaiting verification (REGISTERED + VERIFYING, 177:105577) ·
 *  On hold · Closed. */
type RegisterTab = 'ALL' | 'AWAITING' | 'ON_HOLD' | 'CLOSED';
const TAB_STATUSES: Record<RegisterTab, ReceiptStatus[] | null> = {
  ALL: null,
  AWAITING: ['REGISTERED', 'VERIFYING'],
  ON_HOLD: ['ON_HOLD'],
  CLOSED: ['CLOSED'],
};
const TABS: { value: RegisterTab; label: string }[] = [
  { value: 'ALL', label: 'All receipts' },
  { value: 'AWAITING', label: 'Awaiting verification' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'CLOSED', label: 'Closed' },
];

// Values = inward_receipts.receipt_status enum (API); labels as drawn in the Status menu (177:106010).
const STATUS_OPTIONS: { value: ReceiptStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'VERIFYING', label: 'Verifying' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
];
// Values = inward_receipts.priority enum; labels as drawn in the Priority menu (177:106649).
const PRIORITY_OPTIONS: { value: ReceiptPriority | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All priorities' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Critical' },
];

// Date menu (trigger 177:102755, menu 177:106948) = kit FilterMenu kind="date" align="end" (200 wide): current month
// (default, unapplied look) and the two previous months, sent as `month=YYYY-MM` (the API matches receipt_at in the
// company timezone). Figma's "Last 7 days" can't be sent (the API filters by month only) — replaced by "All months".
type DateKey = 'm0' | 'm1' | 'm2' | 'all';
const ymFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
const monthAgo = (back: number, now = new Date()) => new Date(now.getFullYear(), now.getMonth() - back, 15);
const yearMonth = (d: Date) => ymFmt.format(d).slice(0, 7); // "2026-11"
function dateOptions(now = new Date()): { value: DateKey; label: string }[] {
  return [
    { value: 'm0', label: formatMonthYear(monthAgo(0, now)) },
    { value: 'm1', label: formatMonthYear(monthAgo(1, now)) },
    { value: 'm2', label: formatMonthYear(monthAgo(2, now)) },
    { value: 'all', label: 'All months' },
  ];
}
const monthParam = (k: DateKey) => (k === 'all' ? undefined : yearMonth(monthAgo(k === 'm0' ? 0 : k === 'm1' ? 1 : 2)));

type Filters = { tab: RegisterTab; status: ReceiptStatus | 'ALL'; priority: ReceiptPriority | 'ALL'; date: DateKey; search: string };
const DEFAULT_FILTERS: Filters = { tab: 'ALL', status: 'ALL', priority: 'ALL', date: 'm0', search: '' };

/** Tab set ∩ Status filter. null = no status filter; [] = nothing can match (no request is sent). */
function effectiveStatuses(f: Filters): ReceiptStatus[] | null {
  const tabSet = TAB_STATUSES[f.tab];
  if (f.status === 'ALL') return tabSet;
  if (!tabSet) return [f.status];
  return tabSet.includes(f.status) ? [f.status] : [];
}

// Column widths from the header row 177:102759 (Customer grows: 508 at 1384).
const W = { jin: 130, received: 150, channel: 100, units: 170, priority: 100, status: 120, menu: 40 };

function HeaderRow() {
  return (
    <THead>
      <TH w={W.jin}>JIN number</TH>
      <TH w={W.received}>Received</TH>
      <TH grow>Customer</TH>
      <TH w={W.channel}>Channel</TH>
      <TH w={W.units}>Units verified</TH>
      <TH w={W.priority}>Priority</TH>
      <TH w={W.status}>Status</TH>
      <TH w={W.menu} />
    </THead>
  );
}

function RegisterRowView({ r, menu }: { r: ReceiptListRow; menu: RowMenuItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Units verified = verified unit rows / units received (Σ group quantity; expanded rows if ever more), so a JIN
  // whose groups are not expanded yet reads 0 / n rather than 0 / 0.
  const total = Math.max(r.units_received, r.units_total);
  return (
    <TR to={`/p/inward/${r.id}`} selected={menuOpen}>
      <TD w={W.jin} kind="id">{r.jin_number}</TD>
      <TD w={W.received} kind="text">{formatDayTime(r.receipt_at)}</TD>
      <TD grow kind="strong"><span title={r.customer_code}>{r.customer_name}</span></TD>
      <TD w={W.channel} kind="small">{enumLabel(r.receipt_channel)}</TD>
      <TD w={W.units}>
        {total > 0
          ? <UnitsProgress done={r.units_verified} total={total} />
          : <span className="text-[14px] leading-[20px] text-fg-2">No units yet</span>}
      </TD>
      <TD w={W.priority}><PriorityChip priority={r.priority} /></TD>
      <TD w={W.status}><StatusPill domain="receipt" value={r.receipt_status} /></TD>
      <TD w={W.menu}><RowMenuTrigger items={menu} label={`Actions for ${r.jin_number}`} onOpenChange={setMenuOpen} /></TD>
    </TR>
  );
}

export function InwardRegisterPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isPurchase = !!me && can.purchaseWork(me.role);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const update = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const search = useDebouncedValue(filters.search.trim());

  const statuses = effectiveStatuses(filters);
  const impossible = statuses !== null && statuses.length === 0;
  const month = monthParam(filters.date);
  const params: ReceiptsListParams = {
    page,
    page_size: PAGE_SIZE,
    ...(statuses ? { status: statuses } : {}),
    ...(filters.priority !== 'ALL' ? { priority: filters.priority } : {}),
    ...(month ? { month } : {}),
    ...(search ? { search } : {}),
  };
  const q = useInwardReceiptsList(params, !impossible);

  const filtersActive = filters.tab !== 'ALL' || filters.status !== 'ALL' || filters.priority !== 'ALL'
    || filters.date !== DEFAULT_FILTERS.date || filters.search.trim() !== '';
  // receipt_status is never advanced by any API — a status set without REGISTERED can only come back empty.
  const statusNeverSet = statuses !== null && !statuses.includes('REGISTERED');

  // Row menu (177:108933). Every item is something PURCHASE can do; the write actions open the JIN detail
  // (the drawers live there) with `?action=` so it can open the right drawer.
  const menuFor = (r: ReceiptListRow): RowMenuItem[] => [
    { label: 'Open receipt', icon: IconEye, onSelect: () => navigate(`/p/inward/${r.id}`) },
    ...(isPurchase ? [
      { label: 'Add equipment group', icon: IconPlus, onSelect: () => navigate(`/p/inward/${r.id}?action=add-group`) },
      { label: 'Verify units', icon: IconCamera, onSelect: () => navigate(`/p/inward/${r.id}?action=verify`) },
    ] : []),
    {
      label: 'Copy JIN number', icon: IconFilePlus, onSelect: () => {
        navigator.clipboard?.writeText(r.jin_number).then(
          () => toast({ tone: 'success', title: 'JIN number copied', body: r.jin_number }),
          () => toast({ tone: 'blocked', title: "Couldn't copy the JIN number", body: r.jin_number }),
        );
      },
    },
  ];

  const createButton = isPurchase
    ? <Button icon={<Ic icon={IconPlus} size={18} />} onClick={() => setCreateOpen(true)}>Create JIN</Button>
    : null;

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let body: ReactNode;
  if (!impossible && q.isPending) {
    body = (
      <TableCard className="min-h-[656px] flex-1">
        <HeaderRow />
        <SkeletonRows rows={8} />
      </TableCard>
    );
  } else if (!impossible && q.isError && !q.data) {
    body = (
      <StateCard>
        <ErrorState
          title="Couldn't load the inward register"
          body={errorBody(q.error)}
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
        />
      </StateCard>
    );
  } else if (impossible || rows.length === 0) {
    body = (
      <StateCard>
        <EmptyState
          icon={IconPackage}
          title={filtersActive ? 'No receipts match these filters' : 'No inward receipts this month'}
          body={filtersActive
            ? 'Clear the search or change the tab and filters.'
            : 'Create a JIN when equipment arrives — walk-in or courier. Each unit gets its own Job ID after verification.'}
          action={!filtersActive ? createButton ?? undefined : statusNeverSet ? (
            <GapNote code="receipt_status" className="text-left">
              No API moves a receipt out of REGISTERED, so every JIN stays Registered — On hold, Closed and the other
              statuses list nothing until the backend advances receipt_status.
            </GapNote>
          ) : undefined}
        />
      </StateCard>
    );
  } else {
    body = (
      <>
        <TableCard className={cx(pages > 1 ? 'min-h-[586px] flex-1' : 'min-h-[656px] flex-1', q.isPlaceholderData && 'opacity-60')}>
          <HeaderRow />
          {rows.map((r) => <RegisterRowView key={r.id} r={r} menu={menuFor(r)} />)}
        </TableCard>
        <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Inward register" meta="Every unit that comes through the door, one Job ID per unit." />
      <PageContent className="flex-1">
        <TabBar shadow label="Receipt views">
          {TABS.map((t) => (
            <Tab key={t.value} active={filters.tab === t.value} onClick={() => update({ tab: t.value })} label={t.label} />
          ))}
        </TabBar>
        <ToolbarCard>
          {createButton}
          <ToolbarSpacer />
          <SearchField value={filters.search} onChange={(v) => update({ search: v })} placeholder="Search JIN, customer, DC no." />
          <FilterMenu label="Status" value={filters.status} options={STATUS_OPTIONS} allValue="ALL" onChange={(v) => update({ status: v })} />
          <FilterMenu label="Priority" value={filters.priority} options={PRIORITY_OPTIONS} allValue="ALL" onChange={(v) => update({ priority: v })} />
          <FilterMenu
            kind="date"
            align="end"
            menuWidth={200}
            value={filters.date}
            options={dateOptions()}
            allValue="m0"
            onChange={(v) => update({ date: v })}
          />
        </ToolbarCard>
        {body}
      </PageContent>
      {isPurchase && <CreateJinDrawer open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
