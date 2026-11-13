// Figma "S0 · RFQ list" 177:120022 (+ tab frames Draft 177:120192 · Sent 177:120248 · Offers received 177:120304 ·
// Compared 177:120379 · Expired 177:120454, search "igbt" 177:120510, row menus 177:120567 … 177:121671).
// Page header: "Sourcing" / "RFQs raised from job shortages · supplier offers · landed-cost comparison".
// Tab bar (shadow) → Toolbar 177:120033 (glass, radius 30, pl-20 pr-10 py-10, gap 10: "New RFQ" primary · count ·
// spacer · 300px search) → Table card 177:120040 (kit TableCard, rows = RfqTable).
//
// G20: there is NO cross-job RFQ list endpoint (only GET /jobs/{id}/rfqs). The list is built as drawn, but it has no
// rows to show: the table card renders its empty state with the G20 note, an "Open RFQ" field (RFQ UUID or link) and
// the real path — a job's Sourcing tab. Tabs use the API enum (incl. CANCELLED, which Figma does not draw) and carry
// no counts (nothing to count). "New RFQ" needs the job (RFQs are per job): it asks for the Job ID/link (G15: no
// Purchase jobs list) and opens that job's Sourcing tab, where the shortages are picked.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconPlus, IconSearch } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { SearchField } from '../../../ui/desktop/SearchField';
import { TableCard } from '../../../ui/desktop/DataTable';
import { Button } from '../../../ui/desktop/Button';
import { Ic } from '../../../ui/desktop/Icon';
import { EmptyState } from '../../../ui/desktop/States';
import { GapNote } from '../../../ui/desktop/Feedback';
import { Drawer } from '../../../ui/desktop/Drawer';
import { TextInput } from '../../../ui/desktop/Fields';
import type { RfqRow } from '../api';
import { RfqTableHead } from './RfqTable';

type Status = RfqRow['rfq_status'];
const TABS: { value: Status | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'OFFERS_RECEIVED', label: 'Offers received' },
  { value: 'COMPARED', label: 'Compared' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** Pull a UUID out of a pasted id or link (e.g. …/p/rfqs/<uuid>?job=…). The first UUID in the text wins. */
export const parseUuid = (text: string) => UUID.exec(text.trim())?.[0]?.toLowerCase() ?? null;

export function OpenByIdForm({ label, placeholder, buttonLabel, onOpen }: {
  label: string; placeholder: string; buttonLabel: string; onOpen: (id: string) => void;
}) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="flex w-full items-end gap-[10px] text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const id = parseUuid(v);
        if (!id) { setErr('Paste the UUID or a link that contains it.'); return; }
        onOpen(id);
      }}
    >
      <TextInput label={label} mono placeholder={placeholder} value={v} error={err} onChange={(e) => { setV(e.target.value); setErr(null); }} />
      <Button kind="secondary" type="submit" icon={<Ic icon={IconArrowRight} size={18} />} className={err ? 'mb-[22px]' : undefined}>{buttonLabel}</Button>
    </form>
  );
}

export function RfqListPage() {
  const nav = useNavigate();
  const { me } = useAuth();
  const role = me?.role;
  const canSeeCost = !!role && can.seeSupplierCost(role);
  const canAct = !!role && can.purchaseWork(role);
  const [tab, setTab] = useState<Status | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [jobText, setJobText] = useState('');
  const [jobErr, setJobErr] = useState<string | null>(null);

  // No rows can be loaded (G20); `rows` stays empty and tab/search filter nothing.
  const rows: RfqRow[] = [];
  const shown = rows.filter((r) => tab === 'ALL' || r.rfq_status === tab);
  const filtered = q.trim() ? [] : shown;

  return (
    <>
      <PageHeader title="Sourcing" meta="RFQs raised from job shortages · supplier offers · landed-cost comparison" />
      <PageContent>
        <TabBar shadow label="RFQ status">
          {TABS.map((t) => <Tab key={t.value} active={tab === t.value} onClick={() => setTab(t.value)} label={t.label} />)}
        </TabBar>

        <div className="glass flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[20px] pr-[10px] shadow-glass">
          {canAct && (
            <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => { setJobText(''); setJobErr(null); setNewOpen(true); }}>New RFQ</Button>
          )}
          <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{filtered.length === 1 ? '1 RFQ' : `${filtered.length} RFQs`}</span>
          <div className="h-px min-w-px flex-1" />
          <SearchField value={q} onChange={setQ} placeholder="Search RFQ, job, item, supplier" width={300} />
        </div>

        <TableCard fill>
          <RfqTableHead canSeeCost={canSeeCost} />
          <div className="flex flex-1 flex-col items-center justify-center py-[24px]">
            <EmptyState
              icon={IconSearch}
              title={q.trim() ? `No RFQs match "${q.trim()}"` : 'No RFQs to list here'}
              body={(
                <div className="flex w-full flex-col items-stretch gap-[14px]">
                  <p>RFQs are raised per job. Open a job's Sourcing tab to see its RFQs, or open one directly.</p>
                  <GapNote code="G20">There is no cross-job RFQ list in the API (only GET /jobs/{'{id}'}/rfqs), so this register cannot list or count RFQs.</GapNote>
                  <OpenByIdForm label="Open RFQ" placeholder="RFQ UUID or link" buttonLabel="Open" onOpen={(id) => nav(`/p/rfqs/${id}`)} />
                </div>
              )}
            />
          </div>
        </TableCard>
      </PageContent>

      {canAct && (
        <Drawer
          open={newOpen}
          onClose={() => setNewOpen(false)}
          title="New RFQ"
          subtitle="An RFQ is raised from one job's shortages"
          onSubmit={() => {
            const id = parseUuid(jobText);
            if (!id) { setJobErr('Paste the Job UUID or a job link.'); return; }
            nav(`/p/jobs/${id}/sourcing`);
          }}
          footer={(
            <>
              <Button kind="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button kind="primary" type="submit">Open job sourcing</Button>
            </>
          )}
        >
          <TextInput
            label="Job *"
            mono
            placeholder="Job UUID or link"
            value={jobText}
            error={jobErr}
            helper="Pick the shortages on the job's Sourcing tab."
            onChange={(e) => { setJobText(e.target.value); setJobErr(null); }}
          />
          <GapNote code="G15">No Purchase jobs list/lookup exists, so the job is entered by its id or link.</GapNote>
        </Drawer>
      )}
    </>
  );
}
