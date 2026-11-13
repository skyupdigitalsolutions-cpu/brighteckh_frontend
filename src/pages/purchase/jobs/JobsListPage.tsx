// Figma "J0 · Jobs list" 177:111151 (+ tabs 177:111370/111435/111589/111655, status menu 177:111721 and its
// filters, priority menu 177:112443 and its filters, engineer menu 177:112980, search 177:113655, pages 177:113765 /
// 177:113985, row menus 177:114205…115836).
// Header: "Jobs" + meta. Tab bar (shadow). Toolbar (glass, radius 30, pl-20 pr-10 py-10, gap 10): count · spacer ·
// search 300 · Status / Priority / Engineer menus (240 wide). Table card: header row + rows with gap-12 between
// cells, rows px-16 py-12 (the kit TR is py-14 without a gap, so rows/header are composed here from TH/TD).
// Columns: Job ID 110 · Equipment flex · Customer 190 · Engineer 150 · Stage 190 · Priority 100 · Updated 100 · 36.
//
// DATA: G15 — no Purchase jobs list endpoint. useJobsList() reports `unavailable`, so the page renders the designed
// empty state with GapNote G15 and an "Open job" input (job UUID or /p/jobs/<id> link). Everything below the
// source (tabs, filters, search, paging, rows, row menu, assign drawer) is wired and runs on real rows once a list
// endpoint exists. No sample rows are rendered.
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconBriefcase, IconEye, IconFilePlus, IconInbox, IconSearch, IconUser,
} from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { ToolbarCard, ToolbarSpacer, TableCard, TH, TD, SkeletonRows } from '../../../ui/desktop/DataTable';
import { SearchField } from '../../../ui/desktop/SearchField';
import { FilterMenu } from '../../../ui/desktop/FilterMenu';
import { MenuSurface, OptionItem } from '../../../ui/desktop/Menu';
import { Popover, useAnchor } from '../../../ui/desktop/Popover';
import { Pagination, paginate } from '../../../ui/desktop/Pagination';
import { RowMenuTrigger, type RowMenuItem } from '../../../ui/desktop/RowMenu';
import { StatusPill, PriorityChip } from '../../../ui/desktop/Badge';
import { EmptyState, ErrorState, StateCard } from '../../../ui/desktop/States';
import { GapNote } from '../../../ui/desktop/Feedback';
import { Button } from '../../../ui/desktop/Button';
import { TextInput } from '../../../ui/desktop/Fields';
import { useToast } from '../../../ui/desktop/Toast';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { IconChevronDown } from '@tabler/icons-react';
import {
  ENGINEER_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS, TABS, UUID_RE, formatUpdated, isOpen, lastActivity, shortId,
  useJobsList, type EngineerFilter, type JobListRow, type JobPriority, type JobStatus, type JobsTab,
} from './jobsData';
import { ReassignDrawer } from './ReassignDrawer';

const PAGE_SIZE = 8; // rows drawn per page in J0
const COLS = { id: 110, customer: 190, engineer: 150, stage: 190, priority: 100, updated: 100, menu: 36 } as const;

export function JobsListPage() {
  const source = useJobsList();
  const [tab, setTab] = useState<JobsTab>('all');
  const [status, setStatus] = useState<JobStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<JobPriority | 'ALL'>('ALL');
  const [engineer, setEngineer] = useState<EngineerFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assignFor, setAssignFor] = useState<JobListRow | null>(null);

  const rows = source.state === 'ready' ? source.rows : null;

  const filtered = useMemo(() => {
    if (!rows) return [];
    const tabStatuses = TABS.find((t) => t.key === tab)?.statuses;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tabStatuses && !tabStatuses.includes(r.status)) return false;
      if (status !== 'ALL' && r.status !== status) return false;
      if (priority !== 'ALL' && r.priority !== priority) return false;
      if (engineer === 'UNASSIGNED' && r.current_assignment) return false;
      if (q) {
        // Customer name isn't on any row (G16) — search covers job, JIN, equipment, make/model, serial.
        const hay = [r.job_number, r.jin_number, r.assembly_name, r.assembly_code, r.observed_make, r.observed_model, r.serial_number]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, status, priority, engineer, search]);

  const paged = paginate(filtered, page, PAGE_SIZE);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const openCount = rows ? rows.filter((r) => isOpen(r.status)).length : null;
  const meta = openCount == null ? 'One job per physical unit' : `One job per physical unit · ${openCount} open`;
  const countText = !rows ? '—'
    : search.trim() ? `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`
      : `${paged.rows.length} of ${filtered.length} jobs`;

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

        {source.state === 'unavailable' && <UnavailableState />}
        {source.state === 'loading' && (
          <TableCard fill>
            <HeadRow />
            <SkeletonRows rows={PAGE_SIZE} widths={[70, 260, 150, 110, 140, 64, 50]} />
          </TableCard>
        )}
        {source.state === 'error' && (
          <StateCard>
            <ErrorState title="Couldn't load jobs" onRetry={source.retry} retrying={source.retrying} />
          </StateCard>
        )}
        {source.state === 'ready' && (filtered.length === 0 ? (
          <StateCard>
            <EmptyState
              icon={IconSearch}
              title={rows!.length === 0 ? 'No jobs yet' : 'No jobs match these filters'}
              body={rows!.length === 0 ? 'Jobs are created when Purchase verifies a unit on an inward receipt.' : 'Try another tab, status, priority or search.'}
              action={rows!.length === 0 ? undefined : <Button kind="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          </StateCard>
        ) : (
          <>
            <TableCard fill>
              <HeadRow />
              {paged.rows.map((r) => <JobRow key={r.id} row={r} onAssign={() => setAssignFor(r)} />)}
            </TableCard>
            <Pagination page={paged.page} pages={paged.pages} onChange={setPage} />
          </>
        ))}
      </PageContent>

      {assignFor && (
        <ReassignDrawer
          open
          onClose={() => setAssignFor(null)}
          jobId={assignFor.id}
          jobNumber={assignFor.job_number}
          current={assignFor.current_assignment}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ table
function HeadRow() {
  return (
    <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
      <TH w={COLS.id}>Job ID</TH>
      <TH grow>Equipment</TH>
      <TH w={COLS.customer}>Customer</TH>
      <TH w={COLS.engineer}>Engineer</TH>
      <TH w={COLS.stage}>Stage</TH>
      <TH w={COLS.priority}>Priority</TH>
      <TH w={COLS.updated}>Updated</TH>
      <TH w={COLS.menu} />
    </div>
  );
}

function JobRow({ row, onAssign }: { row: JobListRow; onAssign: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const me = useMe();
  const a = row.current_assignment;
  const items: RowMenuItem[] = [
    { label: 'Open job', icon: IconEye, onSelect: () => navigate(`/p/jobs/${row.id}/overview`) },
    ...(can.purchaseWork(me.role) && isOpen(row.status)
      ? [{ label: a ? 'Reassign engineer' : 'Assign engineer', icon: IconUser, onSelect: onAssign }] : []),
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
    <div
      role="row"
      onClick={() => navigate(`/p/jobs/${row.id}/overview`)}
      className="flex w-full shrink-0 cursor-pointer items-center gap-[12px] overflow-clip border-b border-line px-[16px] py-[12px] transition-colors hover:bg-surface"
    >
      <TD w={COLS.id} kind="id">{row.job_number}</TD>
      <TD grow>
        <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <p className="truncate text-[14px] font-medium leading-[20px] text-fg">
            {[row.assembly_name, row.observed_model].filter(Boolean).join(' · ')}
          </p>
          <p className="text-[12px] leading-[16px] text-fg-muted">{row.jin_number} · unit {row.unit_number} of {row.units_in_group}</p>
        </div>
      </TD>
      {/* G16: no customer name on the row / no customers lookup. */}
      <TD w={COLS.customer} kind="text">—</TD>
      <TD w={COLS.engineer}>
        <div className="flex items-center gap-[8px] overflow-clip">
          <Ic icon={IconUser} size={18} className="text-fg-muted" />
          {a
            ? <span className="truncate font-mono text-[13px] font-medium leading-[20px] text-fg" title={a.engineer_id}>{shortId(a.engineer_id)}</span>
            : <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-muted">Unassigned</span>}
        </div>
      </TD>
      <TD w={COLS.stage}><StatusPill domain="job" value={row.status} /></TD>
      <TD w={COLS.priority}><PriorityChip priority={row.priority} /></TD>
      <TD w={COLS.updated} kind="small">{formatUpdated(lastActivity(row))}</TD>
      <TD w={COLS.menu}><RowMenuTrigger items={items} label={`Actions for ${row.job_number}`} /></TD>
    </div>
  );
}

// ------------------------------------------------------------------ engineer menu (177:112980 / menu 177:113200)
// Same trigger + menu as the kit FilterMenu, but the menu is right-aligned to the toolbar's outer edge (11px past
// the trigger: 10px toolbar padding + 1px border) and carries the G17 note. Options: All engineers / Unassigned only.
function EngineerMenu({ value, onChange }: { value: EngineerFilter; onChange: (v: EngineerFilter) => void }) {
  const a = useAnchor<HTMLButtonElement>();
  const applied = value !== 'ALL';
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
        <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">Engineer: {applied ? 'Unassigned' : 'All'}</span>
        <Ic icon={IconChevronDown} size={16} className="text-fg-2" />
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align="end" scrim={0.25} width={240} label="Engineer" className="translate-x-[11px]">
        <MenuSurface variant="filter">
          {ENGINEER_OPTIONS.map((o) => (
            <OptionItem key={o.value} selected={o.value === value} onSelect={() => { onChange(o.value); a.close(); }}>{o.label}</OptionItem>
          ))}
          <GapNote code="G17" className="mt-[6px]">No engineer lookup — engineers can't be listed by name.</GapNote>
        </MenuSurface>
      </Popover>
    </>
  );
}

// ------------------------------------------------------------------ G15 empty state + "Open job"
function UnavailableState() {
  return (
    <StateCard>
      <EmptyState
        icon={IconBriefcase}
        title="The jobs list isn't available yet"
        body={(
          <div className="flex w-full flex-col items-stretch gap-[12px] text-left">
            <p className="text-center">Open a job directly with its ID or link while the list is missing.</p>
            <GapNote code="G15">
              The API has no Purchase jobs list (only GET /jobs/{'{id}'}; GET /my-jobs is Engineer-only). Tabs, filters,
              search and paging are wired and will fill once a list endpoint exists.
            </GapNote>
            <OpenJobForm />
          </div>
        )}
      />
    </StateCard>
  );
}

function OpenJobForm() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = text.trim().match(UUID_RE);
    if (!m) {
      setError(/^JOB-/i.test(text.trim())
        ? 'Job numbers can\'t be looked up (no jobs list). Paste the job\'s UUID or its /p/jobs/… link.'
        : 'Paste a job UUID or a /p/jobs/<id> link.');
      return;
    }
    navigate(`/p/jobs/${m[0].toLowerCase()}/overview`);
  };
  return (
    <form onSubmit={submit} noValidate className="flex w-full items-end gap-[12px]">
      <TextInput
        label="Open job"
        mono
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        placeholder="Job UUID or /p/jobs/… link"
        error={error}
        className="min-w-0 flex-1"
      />
      <Button kind="primary" type="submit" className={error ? 'mb-[22px]' : 'mb-[4px]'}>Open job</Button>
    </form>
  );
}
