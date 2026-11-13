// Figma "S0 · RFQ list" 177:120022 (+ tab frames Draft 177:120192 · Sent 177:120248 · Offers received 177:120304 ·
// Compared 177:120379 · Expired 177:120454, search "igbt" 177:120510, row menus 177:120567 … 177:121671).
// Page header: "Sourcing" / "RFQs raised from job shortages · supplier offers · landed-cost comparison".
// Tab bar (shadow) → Toolbar 177:120033 (glass, radius 30, pl-20 pr-10 py-10, gap 10: "New RFQ" primary · count ·
// spacer · 300px search) → Table card 177:120040 (kit TableCard, rows = RfqListRowView) → Pagination.
//
// Data: GET /rfqs (PURCHASE) with server pagination, status tab and debounced search. Tabs follow the API enum plus
// CANCELLED (not drawn). Figma's tabs carry no counts, so none are fetched. Search placeholder: Figma "item" →
// "customer" (the API searches RFQ number, job number, customer name and invited supplier name, not items). "New RFQ" picks the job by name/number
// (LookupPicker over GET /jobs) and opens that job's Sourcing tab, where the shortages are picked (RFQs are per job).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFileSearch, IconPlus, IconSearch } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { SearchField } from '../../../ui/desktop/SearchField';
import { SkeletonRows, TableCard } from '../../../ui/desktop/DataTable';
import { Button } from '../../../ui/desktop/Button';
import { Ic } from '../../../ui/desktop/Icon';
import { EmptyState, ErrorState, errorBody } from '../../../ui/desktop/States';
import { GapNote } from '../../../ui/desktop/Feedback';
import { Drawer } from '../../../ui/desktop/Drawer';
import { Pagination } from '../../../ui/desktop/Pagination';
import { LookupPicker } from '../../../ui/desktop/LookupPicker';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { useRfqsList, type RfqListRow } from '../api';
import { RfqListHead, RfqListRowView } from './RfqTable';
import { jobSource } from './jobSource';

type Status = RfqListRow['rfq_status'];
const TABS: { value: Status | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'OFFERS_RECEIVED', label: 'Offers received' },
  { value: 'COMPARED', label: 'Compared' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const PAGE_SIZE = 25;

export function RfqListPage() {
  const nav = useNavigate();
  const { me } = useAuth();
  const role = me?.role;
  const canAct = !!role && can.purchaseWork(role);
  const [tab, setTab] = useState<Status | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(q.trim());
  const [newOpen, setNewOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobErr, setJobErr] = useState<string | null>(null);

  const listQ = useRfqsList({
    page,
    page_size: PAGE_SIZE,
    ...(tab !== 'ALL' ? { status: tab } : {}),
    ...(search ? { search } : {}),
  });
  const data = listQ.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const tabNote = tab === 'COMPARED'
    ? <GapNote code="C2-5">Nothing in the API moves an RFQ to COMPARED, so this tab stays empty.</GapNote>
    : tab === 'CANCELLED'
      ? <GapNote code="C2-4">There is no endpoint to cancel an RFQ, so Cancel RFQ is hidden and this tab stays empty.</GapNote>
      : null;

  return (
    <>
      <PageHeader title="Sourcing" meta="RFQs raised from job shortages · supplier offers · landed-cost comparison" />
      <PageContent>
        <TabBar shadow label="RFQ status">
          {TABS.map((t) => <Tab key={t.value} active={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }} label={t.label} />)}
        </TabBar>

        <div className="glass flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[20px] pr-[10px] shadow-glass">
          {canAct && (
            <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => { setJobId(null); setJobErr(null); setNewOpen(true); }}>New RFQ</Button>
          )}
          <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">
            {data ? (total === 1 ? '1 RFQ' : `${total} RFQs`) : '…'}
          </span>
          <div className="h-px min-w-px flex-1" />
          <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search RFQ, job, customer, supplier" width={300} />
        </div>

        {tabNote}

        <TableCard fill>
          <RfqListHead />
          {listQ.isPending ? (
            <SkeletonRows rows={8} widths={[120, 100, 260, 160, 110, 170]} />
          ) : listQ.isError ? (
            <div className="flex flex-1 items-center justify-center py-[24px]">
              <ErrorState title="Couldn't load RFQs" body={errorBody(listQ.error)} onRetry={() => listQ.refetch()} retrying={listQ.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-[24px]">
              <EmptyState
                icon={search ? IconSearch : IconFileSearch}
                title={search ? `No RFQs match "${search}"` : tab === 'ALL' ? 'No RFQs yet' : 'No RFQs in this status'}
                body={search ? 'Search covers RFQ number, job number, customer and invited supplier.' : 'RFQs are raised from a job\'s shortages on its Sourcing tab.'}
              />
            </div>
          ) : (
            <div className={listQ.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <RfqListRowView key={r.id} row={r} canAct={canAct} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </TableCard>
      </PageContent>

      {canAct && (
        <Drawer
          open={newOpen}
          onClose={() => setNewOpen(false)}
          title="New RFQ"
          subtitle="An RFQ is raised from one job's shortages"
          onSubmit={() => {
            if (!jobId) { setJobErr('Choose the job.'); return; }
            nav(`/p/jobs/${jobId}/sourcing`);
          }}
          footer={(
            <>
              <Button kind="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button kind="primary" type="submit">Open job sourcing</Button>
            </>
          )}
        >
          <LookupPicker
            label="Job *"
            placeholder="Search job, JIN, customer, serial…"
            helper="Pick the shortages on the job's Sourcing tab."
            value={jobId}
            onChange={(id) => { setJobId(id); setJobErr(null); }}
            source={jobSource}
            error={jobErr}
            clearable
            autoFocus
          />
        </Drawer>
      )}
    </>
  );
}
