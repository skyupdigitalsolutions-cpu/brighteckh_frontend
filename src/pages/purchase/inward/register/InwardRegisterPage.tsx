// D·P1 · Inward register — success 177:102734 · loading 177:102937 · empty 177:103043 · error 177:103069.
// 03b interactions: tabs 177:105577 / 105680 / 105743; status menu 177:105806 + applied 106026…106382; priority
// menu 177:106445 + applied 106659 / 106802 / 106885; date menu 177:106948 + Oct 177:107164 / Sep 177:107367;
// search "bharat" 177:107570; pages 2/3/4 177:107634 / 107837 / 108040; row menus 177:108729…110276.
//
// Layout: PageHeader (title + meta, no action) → Tab bar (shadow) → Toolbar (Create JIN · spacer · search 300 ·
// Status · Priority · date) → Table card (header row + rows, 8 per page) → Pagination. With one page the card
// fills to the bottom (656 tall, as in the loading / search frames); with pagination it is 586.
//
// G14: no list endpoint → `useInwardRegister` resolves to an unavailable, empty result and the designed empty state
// shows GapNote G14 + "Open a JIN" by receipt ID/link (closest real path: GET /inward-receipts/{id}).
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCamera, IconEye, IconFilePlus, IconPackage, IconPlus } from '@tabler/icons-react';
import { useAuth } from '../../../../auth/AuthProvider';
import { can } from '../../../../auth/access';
import { enumLabel, formatDayTime } from '../../../../lib/format';
import {
  Button, EmptyState, ErrorState, FilterMenu, GapNote, Ic, PageContent, PageHeader, Pagination, PriorityChip,
  RowMenuTrigger, SearchField, SkeletonRows, StateCard, StatusPill, Tab, TabBar, TableCard, TD, TH, THead, TR,
  ToolbarCard, ToolbarSpacer, UnitsProgress, errorBody, paginate, useToast, type RowMenuItem,
} from '../../../../ui/desktop';
import { CreateJinDrawer } from '../detail/CreateJinDrawer';
import { DateMenu } from './DateMenu';
import { OpenJinField } from './OpenJinField';
import {
  applyFilters, useInwardRegister, type ReceiptPriority, type ReceiptStatus, type RegisterFilters, type RegisterRow,
  type RegisterTab,
} from './useInwardRegister';

const PAGE_SIZE = 8; // rows per page in 177:102734

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

// Column widths from the header row 177:102759 (Customer grows: 508 at 1384).
const W = { jin: 130, received: 150, channel: 100, units: 170, priority: 100, status: 120, menu: 40 };

const DEFAULT_FILTERS: RegisterFilters = { tab: 'ALL', status: 'ALL', priority: 'ALL', date: 'm0', search: '' };

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

function RegisterRowView({ r, menu }: { r: RegisterRow; menu: RowMenuItem[] }) {
  return (
    <TR to={`/p/inward/${r.id}`}>
      <TD w={W.jin} kind="id">{r.jin_number}</TD>
      <TD w={W.received} kind="text">{formatDayTime(r.receipt_at)}</TD>
      <TD grow kind="strong">{r.customer_name ?? '—'}</TD>
      <TD w={W.channel} kind="small">{enumLabel(r.receipt_channel)}</TD>
      <TD w={W.units}>
        {r.units_total != null && r.units_verified != null
          ? <UnitsProgress done={r.units_verified} total={r.units_total} />
          : <span className="text-[14px] leading-[20px] text-fg-2">—</span>}
      </TD>
      <TD w={W.priority}><PriorityChip priority={r.priority} /></TD>
      <TD w={W.status}><StatusPill domain="receipt" value={r.receipt_status} /></TD>
      <TD w={W.menu}><RowMenuTrigger items={menu} label={`Actions for ${r.jin_number}`} /></TD>
    </TR>
  );
}

export function InwardRegisterPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isPurchase = !!me && can.purchaseWork(me.role);
  const q = useInwardRegister();

  const [filters, setFilters] = useState<RegisterFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const update = (patch: Partial<RegisterFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };

  const filtered = useMemo(() => (q.data ? applyFilters(q.data.rows, filters) : []), [q.data, filters]);
  const paged = paginate(filtered, page, PAGE_SIZE);
  const filtersActive = filters.tab !== 'ALL' || filters.status !== 'ALL' || filters.priority !== 'ALL'
    || filters.date !== DEFAULT_FILTERS.date || filters.search.trim() !== '';

  const openCreate = () => setCreateOpen(true);

  // Row menu (177:108933). Every item is something PURCHASE can do; the write actions open the JIN detail
  // (the drawers live there) with `?action=` so it can open the right drawer.
  const menuFor = (r: RegisterRow): RowMenuItem[] => [
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
    ? <Button icon={<Ic icon={IconPlus} size={18} />} onClick={openCreate}>Create JIN</Button>
    : null;

  let body: ReactNode;
  if (q.isPending) {
    body = (
      <TableCard className="min-h-[656px] flex-1">
        <HeaderRow />
        <SkeletonRows rows={8} />
      </TableCard>
    );
  } else if (q.isError) {
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
  } else if (filtered.length === 0) {
    const unavailable = !q.data.available;
    body = (
      <StateCard>
        <EmptyState
          icon={IconPackage}
          title={unavailable
            ? "The register can't list receipts yet"
            : filtersActive ? 'No receipts match these filters' : 'No inward receipts this month'}
          body={unavailable || !filtersActive
            ? 'Create a JIN when equipment arrives — walk-in or courier. Each unit gets its own Job ID after verification.'
            : 'Clear the search or change the tab and filters.'}
          action={(
            <div className="flex w-full flex-col items-center gap-[12px]">
              {(unavailable || !filtersActive) && createButton}
              {unavailable && (
                <>
                  <OpenJinField className="w-full" />
                  <GapNote code="G14" className="text-left">
                    There is no inward-receipt list endpoint, so receipts can't be listed, filtered or searched here.
                    Open one by its receipt ID (UUID) or a pasted /p/inward/… link — a JIN number can't be resolved
                    without a list.
                  </GapNote>
                </>
              )}
            </div>
          )}
        />
      </StateCard>
    );
  } else {
    body = (
      <>
        <TableCard className={paged.pages > 1 ? 'min-h-[586px] flex-1' : 'min-h-[656px] flex-1'}>
          <HeaderRow />
          {paged.rows.map((r) => <RegisterRowView key={r.id} r={r} menu={menuFor(r)} />)}
        </TableCard>
        <Pagination page={paged.page} pages={paged.pages} onChange={setPage} />
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
          <DateMenu value={filters.date} onChange={(v) => update({ date: v })} />
        </ToolbarCard>
        {body}
      </PageContent>
      {isPurchase && <CreateJinDrawer open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
