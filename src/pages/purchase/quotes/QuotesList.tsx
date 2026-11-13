// Q0 · Quotes list (/p/quotes) — Figma 177:122894; tabs Draft 177:123083 · Released to Sales 177:123158 · Sent 177:123233 ·
// Accepted 177:123308 · Rejected 177:123364; search "nandi" 177:123420; row menus 177:123496 … 177:124917.
// Page header "Quotes" + meta; tab bar (shadow) "All · n" …; toolbar (New quote · count · search 300); table card:
// header bg-subtle radius 20 px-16 py-12 gap 12; rows px-16 py-14 gap 12; cells Quote 140 (Data/ID + "rN" 12/16 muted) ·
// Job 100 (Data/ID secondary) · Customer flex (14/20 Medium) · Type 110 (badge) · Total 150 → (mono 14/20 SemiBold) ·
// Valid until 110 (14/20 secondary, "21 Nov") · Status 180 (badge) · 36 kebab. Row menu: Open quote · Open job ·
// Create revision · Copy quote number. Menu open → row tinted (RowMenuTrigger onOpenChange → TR selected).
//
// Data: GET /quotes (PURCHASE, MANAGEMENT) — server pagination, status tab (matched on the LATEST revision) and
// debounced search (quote number, job number, customer name/code). Tab counts (drawn by Figma) = `total` of the same
// endpoint with page_size=1 per status, under the current search.
// Deviation: "Total incl. tax" → "Pre-tax total" (latest_revised_pre_tax). The list returns pre-tax, tax and freight
// separately but no total, and the quote total composition is an open client decision (CLAUDE.md §5, G-D-2), so no
// total is computed here. Tabs follow the API quote_status enum (Figma's five + EXPIRED; SUPERSEDED never heads a quote).
// "New quote" picks the job by number / customer (LookupPicker over GET /jobs) and opens its Quote tab.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCopy, IconEye, IconFileInvoice, IconFilePlus, IconPlus, IconSearch, IconTool } from '@tabler/icons-react';
import { useQuotesList, type QuoteListRow, type QuotesListParams } from '../api';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import {
  Badge, Button, Drawer, EmptyState, ErrorState, Ic, LookupPicker, PageContent, PageHeader, Pagination, RowMenuTrigger,
  SearchField, SkeletonRows, StatusPill, TD, TH, TR, Tab, TabBar, TableCard, ToolbarCard, ToolbarSpacer, errorBody,
  useToast, type RowMenuItem,
} from '../../../ui/desktop';
import { enumLabel, formatINR } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { jobSource } from '../sourcing/jobSource';
import type { QuoteStatus } from './api';

type TabValue = QuoteStatus | 'ALL';
const TABS: { value: TabValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RELEASED_TO_SALES', label: 'Released to Sales' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];
const REVISABLE = new Set<QuoteStatus>(['DRAFT', 'RELEASED_TO_SALES', 'SENT', 'REJECTED', 'EXPIRED']);
const dm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
const dayMonth = (iso: string | null | undefined) => (iso ? dm.format(new Date(iso)) : '—');
const PAGE_SIZE = 25;
const COLS = { quote: 140, job: 100, type: 110, total: 150, valid: 110, status: 180, menu: 36 };

const statusParam = (t: TabValue): Pick<QuotesListParams, 'status'> => (t === 'ALL' ? {} : { status: t });

/** Count for one tab: same endpoint, page_size=1, current search. */
function useTabCount(t: TabValue, search: string) {
  const q = useQuotesList({ page_size: 1, ...statusParam(t), ...(search ? { search } : {}) });
  return q.data?.total ?? null;
}

export function QuotesList() {
  const navigate = useNavigate();
  const role = useAuth().me?.role;
  const canWork = !!role && can.purchaseWork(role);
  const [tab, setTab] = useState<TabValue>('ALL');
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const listQ = useQuotesList({ page, page_size: PAGE_SIZE, ...statusParam(tab), ...(search ? { search } : {}) });
  const counts: Record<TabValue, number | null> = {
    ALL: useTabCount('ALL', search),
    DRAFT: useTabCount('DRAFT', search),
    RELEASED_TO_SALES: useTabCount('RELEASED_TO_SALES', search),
    SENT: useTabCount('SENT', search),
    ACCEPTED: useTabCount('ACCEPTED', search),
    REJECTED: useTabCount('REJECTED', search),
    EXPIRED: useTabCount('EXPIRED', search),
    SUPERSEDED: null,
  };

  const data = listQ.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const countLabel = !data ? '…' : search ? `${total} result${total === 1 ? '' : 's'}` : `${total} quote${total === 1 ? '' : 's'}`;

  return (
    <>
      <PageHeader title="Quotes" meta="Customer quotations · prices set manually by Purchase · Sales sends them" />
      <PageContent>
        <TabBar shadow label="Quote status">
          {TABS.map((t) => (
            <Tab key={t.value} active={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }} label={t.label} count={counts[t.value]} />
          ))}
        </TabBar>

        <ToolbarCard className="pl-[20px]">
          {canWork && <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setNewOpen(true)}>New quote</Button>}
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search quote, job, customer" />
        </ToolbarCard>

        <TableCard fill>
          <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
            <TH w={COLS.quote}>Quote</TH>
            <TH w={COLS.job}>Job</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.type}>Type</TH>
            <TH w={COLS.total} align="right">Pre-tax total</TH>
            <TH w={COLS.valid}>Valid until</TH>
            <TH w={COLS.status}>Status</TH>
            <TH w={COLS.menu}>{''}</TH>
          </div>
          {listQ.isPending ? <SkeletonRows rows={8} /> : listQ.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load quotes" body={errorBody(listQ.error)} onRetry={() => listQ.refetch()} retrying={listQ.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconFileInvoice}
                title={search ? `No quotes match “${search}”` : tab === 'ALL' ? 'No quotes yet' : 'No quotes in this status'}
                body={search ? 'Search covers quote number, job number and customer name or code.' : tab === 'ALL' ? 'Quotes are priced on a job’s Quote tab.' : undefined}
              />
            </div>
          ) : (
            <div className={listQ.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((q) => <QuoteRow key={q.id} q={q} canWork={canWork} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </TableCard>
      </PageContent>

      {canWork && <NewQuoteDrawer open={newOpen} onClose={() => setNewOpen(false)} onGo={(jobId) => navigate(`/p/jobs/${jobId}/quote`)} />}
    </>
  );
}

function QuoteRow({ q, canWork }: { q: QuoteListRow; canWork: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const s = q.latest_quote_status;
  const open = () => navigate(`/p/jobs/${q.job_id}/quote?q=${q.id}`);
  const menu: RowMenuItem[] = [
    { label: 'Open quote', icon: IconEye, onSelect: open },
    { label: 'Open job', icon: IconTool, onSelect: () => navigate(`/p/jobs/${q.job_id}/overview`) },
    ...(canWork && REVISABLE.has(s)
      ? [{ label: 'Create revision', icon: IconFilePlus, onSelect: () => navigate(`/p/jobs/${q.job_id}/quote?q=${q.id}${s === 'DRAFT' ? '' : '&revise=1'}`) }]
      : []),
    {
      label: 'Copy quote number', icon: IconCopy, onSelect: () => {
        navigator.clipboard?.writeText(q.quote_number).then(
          () => toast({ tone: 'success', title: 'Copied', body: q.quote_number }),
          () => toast({ tone: 'blocked', title: "Couldn't copy", body: q.quote_number }),
        );
      },
    },
  ];
  return (
    <TR onClick={open} selected={menuOpen} className="gap-[12px]">
      <TD w={COLS.quote}>
        <span className="flex items-center gap-[8px] whitespace-nowrap">
          <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{q.quote_number}</span>
          <span className="text-[12px] leading-[16px] text-fg-muted">r{q.latest_revision_no}</span>
        </span>
      </TD>
      <TD w={COLS.job}><span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg-2">{q.job_number}</span></TD>
      <TD grow kind="strong">{q.customer_name}</TD>
      <TD w={COLS.type}><Badge tone="neutral" label={enumLabel(q.quote_type)} /></TD>
      <TD w={COLS.total} align="right"><span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatINR(q.latest_revised_pre_tax)}</span></TD>
      <TD w={COLS.valid} kind="text">{dayMonth(q.latest_valid_until)}</TD>
      <TD w={COLS.status}><StatusPill domain="quote" value={s} /></TD>
      <TD w={COLS.menu}><RowMenuTrigger items={menu} label={`Actions for ${q.quote_number}`} onOpenChange={setMenuOpen} /></TD>
    </TR>
  );
}

/** Quotes belong to a job (POST /jobs/{id}/quotes): pick the job, then price it on its Quote tab. */
function NewQuoteDrawer({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (jobId: string) => void }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New quote"
      subtitle="A quote is priced inside its job"
      onSubmit={() => { setTried(true); if (jobId) onGo(jobId); }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" type="submit">Open job quote</Button>
        </>
      )}
    >
      <LookupPicker
        label="Job *"
        placeholder="Search job, JIN, customer, serial…"
        helper="The quote is built on that job's Quote tab."
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
