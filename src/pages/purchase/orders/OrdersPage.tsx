// O0 · Purchase orders (/p/orders) — Figma section 03g "Purchase · Orders · every interaction" 177:125757: list O0
// 177:125758; tabs Draft 177:125933 · Released 177:125989 · Acknowledged 177:126045 · Shipped 177:126101 · Received
// 177:126157 · Closed 177:126230 · Cancelled 177:126286; search "volta" 177:126342; row menus 177:126416 … 177:127739.
// Page header "Purchase orders" + meta; tab bar (shadow) "Label · n"; toolbar (+ New PO · count · search); table card:
// PO 130 (Data/ID) · Supplier flex (14/20 Medium) · Job 110 (Data/ID secondary) · Lines 60 · Value (pre-tax) 140 →
// (mono SemiBold) · Expected 130 (secondary) · Status 150 (badge) · 36 kebab. Row menu: Open PO · Open job · View goods
// receipts · Copy PO number.
//
// DATA: GET /purchase-orders (PURCHASE only) — server pagination, `status` per tab, debounced `search`, tab counts from
// `counts_by_status` (search scope). Deviations from Figma (see the report):
// - Numbers are DB values (PO-BLR-000046, JOB-…). SALES_ORDER POs show their SO number in the Job column (not drawn).
// - Value = Σ qty × unit price: Figma's freight-inclusive value has no source (GapNote GAP-PO-1 on the PO page).
// - Expected: shipment expected arrival, else acknowledged delivery date; "Received dd Mon" = last GRN. Figma's
//   "Closed 28 Oct" has no source (CLOSED is never set, no closed_at) — shown "—" with GapNote GAP-PO-4 on that tab.
// - "+ New PO": a PO is raised from a job's chosen offer lines, so the button picks the job and opens its Purchase order
//   tab (same as "New quote"). SALES_ORDER POs are raised from Sales & Supply → the order's supplier POs.
// - Loading / empty / error states are the kit's (not drawn).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCopy, IconEye, IconPackage, IconPlus, IconReceipt, IconSearch, IconShoppingCart, IconTool } from '@tabler/icons-react';
import {
  Button, Drawer, EmptyState, ErrorState, GapNote, Ic, LookupPicker, PageContent, PageHeader, Pagination, RowMenuTrigger,
  SearchField, SkeletonRows, StatusPill, TD, TH, TR, Tab, TabBar, TableCard, ToolbarCard, ToolbarSpacer, errorBody,
  useToast, type RowMenuItem,
} from '../../../ui/desktop';
import { formatINR } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { jobSource } from '../sourcing/jobSource';
import { usePoList, type PoListRow, type PoStatus } from './api';

const PAGE_SIZE = 25;
const COLS = { po: 130, job: 110, lines: 60, value: 140, expected: 130, status: 150, menu: 36 } as const;
type TabValue = PoStatus | 'ALL';
const TABS: { value: TabValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const dm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
const dayMonthTs = (iso: string | null | undefined) => (iso ? dm.format(new Date(iso)) : '—');
const dayMonthDate = (d: string | null | undefined) => {
  const m = d ? /^(\d{4})-(\d{2})-(\d{2})/.exec(d) : null;
  return m ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : '—';
};

/** Expected column: what the PO is waiting for, or when it arrived. */
function expectedText(r: PoListRow): string {
  switch (r.po_status) {
    case 'DRAFT': case 'CANCELLED': case 'CLOSED': return '—';
    case 'RECEIVED': return r.last_received_at ? `Received ${dayMonthTs(r.last_received_at)}` : '—';
    default: return dayMonthDate(r.expected_date);
  }
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabValue>('ALL');
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const listQ = usePoList({ page, page_size: PAGE_SIZE, ...(tab === 'ALL' ? {} : { status: tab }), ...(search ? { search } : {}) });
  const data = listQ.data;
  const counts = data?.counts_by_status;
  const countOf = (t: TabValue) => (!counts ? null : t === 'ALL' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const countLabel = !data ? '…' : search ? `${total} result${total === 1 ? '' : 's'}` : `${total} purchase order${total === 1 ? '' : 's'}`;

  return (
    <>
      <PageHeader title="Purchase orders" meta="Supplier POs raised from chosen offers · release → acknowledge → ship → receive" />
      <PageContent>
        <TabBar shadow label="PO status">
          {TABS.map((t) => (
            <Tab key={t.value} active={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }} label={t.label} count={countOf(t.value)} />
          ))}
        </TabBar>

        <ToolbarCard className="pl-[20px]">
          <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setNewOpen(true)}>New PO</Button>
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search PO, supplier, job" />
        </ToolbarCard>

        {tab === 'CLOSED' && (
          <GapNote code="GAP-PO-4">No rule closes a PO yet: nothing sets CLOSED and there is no closed date, so this tab stays empty. A fully posted PO stops at RECEIVED.</GapNote>
        )}
        {tab === 'CANCELLED' && (
          <GapNote code="GAP-PO-3">There is no cancel endpoint (and no cancelled date or reason), so no PO can reach CANCELLED yet.</GapNote>
        )}

        <TableCard fill>
          <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
            <TH w={COLS.po}>PO</TH>
            <TH grow>Supplier</TH>
            <TH w={COLS.job}>Job</TH>
            <TH w={COLS.lines}>Lines</TH>
            <TH w={COLS.value} align="right">Value (pre-tax)</TH>
            <TH w={COLS.expected}>Expected</TH>
            <TH w={COLS.status}>Status</TH>
            <TH w={COLS.menu}>{''}</TH>
          </div>
          {listQ.isPending ? <SkeletonRows rows={8} /> : listQ.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load purchase orders" body={errorBody(listQ.error)} onRetry={() => listQ.refetch()} retrying={listQ.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconShoppingCart}
                title={search ? `No purchase orders match “${search}”` : tab === 'ALL' ? 'No purchase orders yet' : 'No purchase orders in this status'}
                body={search
                  ? 'Search covers PO number, supplier, job or sales order number, supplier reference and AWB / LR.'
                  : tab === 'ALL' ? 'POs are raised from a job’s chosen supplier offers (Purchase order tab).' : undefined}
              />
            </div>
          ) : (
            <div className={listQ.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <PoRowView key={r.id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </TableCard>
      </PageContent>

      <NewPoDrawer open={newOpen} onClose={() => setNewOpen(false)} onGo={(jobId) => navigate(`/p/jobs/${jobId}/purchase-order`)} />
    </>
  );
}

function PoRowView({ r }: { r: PoListRow }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const open = () => navigate(`/p/orders/${r.id}`);
  const menu: RowMenuItem[] = [
    { label: 'Open PO', icon: IconEye, onSelect: open },
    ...(r.job_id ? [{ label: 'Open job', icon: IconTool, onSelect: () => navigate(`/p/jobs/${r.job_id}/overview`) }] : []),
    ...(r.sales_order_id ? [{ label: 'Open sales order', icon: IconReceipt, onSelect: () => navigate(`/p/supply/orders/${r.sales_order_id}`) }] : []),
    { label: 'View goods receipts', icon: IconPackage, onSelect: () => navigate(`/p/orders/${r.id}#goods-receipts`) },
    {
      label: 'Copy PO number', icon: IconCopy, onSelect: () => {
        navigator.clipboard?.writeText(r.po_number).then(
          () => toast({ tone: 'success', title: 'Copied', body: r.po_number }),
          () => toast({ tone: 'blocked', title: "Couldn't copy", body: r.po_number }),
        );
      },
    },
  ];
  const ref = r.job_number ?? r.sales_order_number ?? '—';
  return (
    <TR onClick={open} selected={menuOpen} className="gap-[12px]">
      <TD w={COLS.po}><span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg">{r.po_number}</span></TD>
      <TD grow kind="strong">{r.supplier_name}</TD>
      <TD w={COLS.job}>
        <span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg-2" title={r.sales_order_number ? 'Sales order' : undefined}>{ref}</span>
      </TD>
      <TD w={COLS.lines} kind="text">{r.lines_count}</TD>
      <TD w={COLS.value} align="right">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatINR(r.value_pre_tax)}</span>
      </TD>
      <TD w={COLS.expected} kind="text">{expectedText(r)}</TD>
      <TD w={COLS.status}><StatusPill domain="purchaseOrder" value={r.po_status} /></TD>
      <TD w={COLS.menu}><RowMenuTrigger items={menu} label={`Actions for ${r.po_number}`} onOpenChange={setMenuOpen} /></TD>
    </TR>
  );
}

/** A repair PO is raised from the job's chosen offer lines (POST /jobs/{id}/purchase-orders): pick the job, then raise it
 *  on its Purchase order tab. */
function NewPoDrawer({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (jobId: string) => void }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New PO"
      subtitle="A supplier PO is raised from a job's chosen offers"
      onSubmit={() => { setTried(true); if (jobId) onGo(jobId); }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" type="submit">Open job PO tab</Button>
        </>
      )}
    >
      <LookupPicker
        label="Job *"
        placeholder="Search job, JIN, customer, serial…"
        helper="Pick compliant offer lines on that job's Purchase order tab. Product-sale POs are raised from Sales & Supply → the order's supplier POs."
        value={jobId}
        onChange={(id) => setJobId(id)}
        source={jobSource}
        error={tried && !jobId ? 'Choose the job.' : null}
        clearable
        autoFocus
      />
    </Drawer>
  );
}
