// Figma "J0 · Jobs list" 177:111151 (+ tabs 177:111370/111435/111589/111655, status menu 177:111721 and its
// filters, priority menu 177:112443 and its filters, engineer menu 177:112980 and its filters 177:113281…, search
// 177:113655, pages 177:113765 / 177:113985, row menus 177:114205…115836).
// Header: "Jobs" + meta. Tab bar (shadow, no counts drawn). Toolbar (glass, radius 30, pl-20 pr-10 py-10, gap 10):
// count · spacer · search 300 · Status / Priority / Engineer menus (240 wide). Table card: kit THead/TR with a 12px
// column gap; rows px-16 py-12 (kit TR is py-14 → overridden). Row tint while its kebab menu is open (TR `selected`).
// Columns: Job ID 110 · Equipment flex · Customer 190 · Engineer 150 · Stage 190 · Priority 100 · Updated 100 · 36.
//
// DATA: GET /jobs (useJobsList) — server pagination (8 per page as drawn), status (tab group ∩ status menu), priority,
// engineer_id (uuid | 'unassigned'), search (job, JIN, serial, make, model, assembly, customer; debounced).
// Engineer menu options = GET /lookups/engineers. Header "n open" = GET /jobs?status=<open set>&page_size=1 → total.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconEye, IconFilePlus, IconInbox, IconSearch, IconUser } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useEngineerLookup, useJobsList, type JobListRow, type JobsListParams } from '../api';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { ToolbarCard, ToolbarSpacer, TableCard, THead, TH, TR, TD, SkeletonRows } from '../../../ui/desktop/DataTable';
import { SearchField } from '../../../ui/desktop/SearchField';
import { FilterMenu } from '../../../ui/desktop/FilterMenu';
import { MenuSurface, OptionItem } from '../../../ui/desktop/Menu';
import { Popover, useAnchor } from '../../../ui/desktop/Popover';
import { Pagination } from '../../../ui/desktop/Pagination';
import { RowMenuTrigger, type RowMenuItem } from '../../../ui/desktop/RowMenu';
import { StatusPill, PriorityChip } from '../../../ui/desktop/Badge';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { Button } from '../../../ui/desktop/Button';
import { Avatar } from '../../../ui/desktop/Avatar';
import { useToast } from '../../../ui/desktop/Toast';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  OPEN_STATUSES, PRIORITY_OPTIONS, STATUS_OPTIONS, TABS, formatUpdated, isOpen,
  type JobPriority, type JobStatus, type JobsTab,
} from './jobsData';
import { ReassignDrawer } from './ReassignDrawer';

const PAGE_SIZE = 8; // rows drawn per page in J0
const GAP = 12;
const COLS = { id: 110, customer: 190, engineer: 150, stage: 190, priority: 100, updated: 100, menu: 36 } as const;

/** Engineer filter value: 'ALL' | 'unassigned' | engineer (employees.id). */
type EngineerFilter = string;

export function JobsListPage() {
  const [tab, setTab] = useState<JobsTab>('all');
  const [status, setStatus] = useState<JobStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<JobPriority | 'ALL'>('ALL');
  const [engineer, setEngineer] = useState<EngineerFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assignFor, setAssignFor] = useState<JobListRow | null>(null);
  const q = useDebouncedValue(search.trim());

  // Status sent = tab group ∩ status menu. A status outside the tab's group can't match → no request, empty state.
  const tabStatuses = TABS.find((t) => t.key === tab)?.statuses ?? null;
  const statusSet: JobStatus[] | null = status === 'ALL' ? tabStatuses : tabStatuses && !tabStatuses.includes(status) ? [] : [status];
  const impossible = statusSet !== null && statusSet.length === 0;
  const params: JobsListParams = {
    page,
    page_size: PAGE_SIZE,
    ...(statusSet ? { status: statusSet } : {}),
    ...(priority !== 'ALL' ? { priority } : {}),
    ...(engineer !== 'ALL' ? { engineer_id: engineer } : {}),
    ...(q ? { search: q } : {}),
  };
  const listQ = useJobsList(params, !impossible);
  const openQ = useJobsList({ status: OPEN_STATUSES, page: 1, page_size: 1 });

  const data = impossible ? { rows: [] as JobListRow[], total: 0, page: 1, page_size: PAGE_SIZE } : listQ.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = tab !== 'all' || status !== 'ALL' || priority !== 'ALL' || engineer !== 'ALL' || !!q;

  const meta = openQ.data ? `One job per physical unit · ${openQ.data.total} open` : 'One job per physical unit';
  const countText = !data ? '—'
    : q ? `${total} ${total === 1 ? 'result' : 'results'}`
      : `${data.rows.length} of ${total} jobs`;

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const clearFilters = () => { setTab('all'); setStatus('ALL'); setPriority('ALL'); setEngineer('ALL'); setSearch(''); setPage(1); };

  return (
    <>
      <PageHeader title="Jobs" meta={meta} />
      <PageContent>
        <TabBar shadow label="Job views">
          {TABS.map((t) => <Tab key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }} label={t.label} />)}
        </TabBar>

        <ToolbarCard className="pl-[20px]">
          <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countText}</p>
          <ToolbarSpacer />
          <SearchField value={search} onChange={resetPage(setSearch)} placeholder="Search job ID, equipment, customer" />
          <FilterMenu label="Status" value={status} options={STATUS_OPTIONS} onChange={resetPage(setStatus)} allValue="ALL" menuWidth={240} />
          <FilterMenu label="Priority" value={priority} options={PRIORITY_OPTIONS} onChange={resetPage(setPriority)} allValue="ALL" menuWidth={240} />
          <EngineerMenu value={engineer} onChange={resetPage(setEngineer)} />
        </ToolbarCard>

        {!data && listQ.isError ? (
          <StateCard>
            <ErrorState title="Couldn't load jobs" body={errorBody(listQ.error)} onRetry={() => listQ.refetch()} retrying={listQ.isFetching} />
          </StateCard>
        ) : !data ? (
          <TableCard fill>
            <HeadRow />
            <SkeletonRows rows={PAGE_SIZE} widths={[70, 260, 150, 110, 140, 64, 50]} />
          </TableCard>
        ) : data.rows.length === 0 ? (
          <StateCard>
            <EmptyState
              icon={IconSearch}
              title={filtered ? 'No jobs match these filters' : 'No jobs yet'}
              body={filtered ? 'Try another tab, status, priority, engineer or search.' : 'Jobs are created when Purchase verifies a unit on an inward receipt.'}
              action={filtered ? <Button kind="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          </StateCard>
        ) : (
          <>
            <TableCard fill>
              <HeadRow />
              <div className={cx('flex w-full flex-col transition-opacity', listQ.isPlaceholderData && 'opacity-60')} aria-busy={listQ.isPlaceholderData || undefined}>
                {data.rows.map((r) => <JobRow key={r.id} row={r} onAssign={() => setAssignFor(r)} />)}
              </div>
            </TableCard>
            {listQ.isError && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Couldn't refresh: {errorBody(listQ.error)}</p>}
            <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />
          </>
        )}
      </PageContent>

      {assignFor && (
        <ReassignDrawer
          open
          onClose={() => setAssignFor(null)}
          jobId={assignFor.id}
          jobNumber={assignFor.job_number}
          current={assignFor.current_engineer_id && assignFor.assignment_response && assignFor.assigned_at
            ? { engineer_id: assignFor.current_engineer_id, response: assignFor.assignment_response, assigned_at: assignFor.assigned_at }
            : null}
          currentName={assignFor.current_engineer_name}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ table
function HeadRow() {
  return (
    <THead gap={GAP}>
      <TH w={COLS.id}>Job ID</TH>
      <TH grow>Equipment</TH>
      <TH w={COLS.customer}>Customer</TH>
      <TH w={COLS.engineer}>Engineer</TH>
      <TH w={COLS.stage}>Stage</TH>
      <TH w={COLS.priority}>Priority</TH>
      <TH w={COLS.updated}>Updated</TH>
      <TH w={COLS.menu} />
    </THead>
  );
}

function JobRow({ row, onAssign }: { row: JobListRow; onAssign: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const assigned = !!row.current_engineer_id;
  const items: RowMenuItem[] = [
    { label: 'Open job', icon: IconEye, onSelect: () => navigate(`/p/jobs/${row.id}/overview`) },
    ...(can.purchaseWork(me.role) && isOpen(row.status)
      ? [{ label: assigned ? 'Reassign engineer' : 'Assign engineer', icon: IconUser, onSelect: onAssign }] : []),
    { label: 'View inward receipt', icon: IconInbox, onSelect: () => navigate(`/p/inward/${row.inward_id}`) },
    {
      label: 'Copy job ID', icon: IconFilePlus, onSelect: () => {
        navigator.clipboard?.writeText(row.job_number).then(
          () => toast({ tone: 'success', title: `Copied ${row.job_number}` }),
          () => toast({ tone: 'blocked', title: 'Copy failed', body: row.job_number }),
        );
      },
    },
  ];
  return (
    <TR gap={GAP} selected={menuOpen} onClick={() => navigate(`/p/jobs/${row.id}/overview`)} className="!py-[12px]">
      <TD w={COLS.id} kind="id">{row.job_number}</TD>
      <TD grow>
        <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <p className="truncate text-[14px] font-medium leading-[20px] text-fg">
            {[row.assembly_name, row.observed_model].filter(Boolean).join(' · ')}
          </p>
          <p className="text-[12px] leading-[16px] text-fg-muted">{row.jin_number} · unit {row.unit_number} of {row.units_in_group}</p>
        </div>
      </TD>
      <TD w={COLS.customer} kind="text"><span title={row.customer_code}>{row.customer_name}</span></TD>
      <TD w={COLS.engineer}>
        {row.current_engineer_id ? (
          // Figma 177:111225: 26px avatar (11/14 SemiBold, primary text) + 14/20 name; kit Avatar has no 26 size → overridden.
          <div className="flex min-w-0 items-center gap-[8px] overflow-clip">
            <Avatar
              name={row.current_engineer_name ?? '?'}
              seed={row.current_engineer_id}
              size={28}
              className="!h-[26px] !w-[26px] !text-fg"
            />
            <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg">{row.current_engineer_name ?? '—'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-[8px] overflow-clip">
            <Ic icon={IconUser} size={18} className="text-fg-muted" />
            <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-muted">Unassigned</span>
          </div>
        )}
      </TD>
      <TD w={COLS.stage}><StatusPill domain="job" value={row.status} /></TD>
      <TD w={COLS.priority}><PriorityChip priority={row.priority} /></TD>
      <TD w={COLS.updated} kind="small">{formatUpdated(row.last_activity_at)}</TD>
      <TD w={COLS.menu}><RowMenuTrigger items={items} label={`Actions for ${row.job_number}`} onOpenChange={setMenuOpen} /></TD>
    </TR>
  );
}

// ------------------------------------------------------------------ engineer menu (177:112980 / menu 177:113200)
// Same trigger + menu as the kit FilterMenu, but the menu is right-aligned to the toolbar's outer edge (11px past
// the trigger: 10px toolbar padding + 1px border) — the kit `align="end"` aligns to the trigger edge, 11px short.
// Options: All engineers · Unassigned · every active engineer by name (GET /lookups/engineers, up to 100).
function EngineerMenu({ value, onChange }: { value: EngineerFilter; onChange: (v: EngineerFilter) => void }) {
  const a = useAnchor<HTMLButtonElement>();
  const engQ = useEngineerLookup({ page_size: 100 });
  const options = useMemo(() => [
    { value: 'ALL', label: 'All engineers' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(engQ.data?.rows ?? []).map((r) => ({ value: r.id, label: r.full_name })),
  ], [engQ.data]);
  const applied = value !== 'ALL';
  const current = options.find((o) => o.value === value)?.label ?? '…';
  return (
    <>
      <button
        ref={a.ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={a.open}
        onClick={a.toggle}
        className={cx(
          'flex h-[40px] shrink-0 items-center gap-[8px] overflow-clip rounded-t-popover border border-line bg-surface pl-[14px] pr-[12px]',
          applied && 'ring-inside-brand',
        )}
      >
        <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">Engineer: {applied ? current : 'All'}</span>
        <Ic icon={IconChevronDown} size={16} className="text-fg-2" />
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align="end" scrim={0.25} width={240} label="Engineer" className="translate-x-[11px]">
        <MenuSurface variant="filter">
          <div className="flex max-h-[420px] w-full flex-col items-stretch gap-[2px] overflow-y-auto">
            {options.map((o) => (
              <OptionItem key={o.value} selected={o.value === value} onSelect={() => { onChange(o.value); a.close(); }}>{o.label}</OptionItem>
            ))}
            {engQ.isPending && <p className="px-[12px] py-[10px] text-[14px] leading-[20px] text-fg-muted">Loading engineers…</p>}
            {engQ.isError && (
              <button type="button" onClick={() => engQ.refetch()} className="px-[12px] py-[10px] text-left text-[14px] leading-[20px] text-st-blocked-fg">
                Couldn't load engineers — retry
              </button>
            )}
          </div>
        </MenuSurface>
      </Popover>
    </>
  );
}
