// Q0 · Quotes list (/p/quotes) — Figma 177:122894; tabs Draft 177:123083 · Released to Sales 177:123158 · Sent 177:123233 ·
// Accepted 177:123308 · Rejected 177:123364; search "nandi" 177:123420; row menus 177:123496 … 177:124917.
// Page header "Quotes" + meta; tab bar (shadow) "All · n" …; toolbar (New quote · count · search 300); table card:
// header bg-subtle radius 20 px-16 py-12 gap 12; rows px-16 py-14 gap 12; cells Quote 140 (Data/ID + "rN" 12/16 muted) ·
// Job 100 (Data/ID secondary) · Customer flex (14/20 Medium) · Type 110 (badge) · Total 150 → (mono 14/20 SemiBold) ·
// Valid until 110 (14/20 secondary, "21 Nov") · Status 180 (badge) · 36 kebab. Row menu: Open quote · Open job ·
// Create revision · Copy quote number.
//
// G21: the API has NO cross-job quote list (only GET /jobs/{id}/quotes). This page lists the quotes opened on this
// device (re-read live from GET /quotes/{id} + GET /jobs/{id}); quotes are found through the job's Quote tab, or by
// pasting a quote ID / link into the search box or the empty state. Customer names are not readable (G16) → "—".
// "Total incl. tax" → "Pre-tax total" (revised_pre_tax): the API returns no total and its composition is pending.
// Tabs follow the API quote_status enum (Figma's five + EXPIRED; SUPERSEDED never heads a quote).
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { IconCopy, IconEye, IconFileInvoice, IconFilePlus, IconPlus, IconSearch, IconTool } from '@tabler/icons-react';
import { pk, purchaseApi, type Quote } from '../api';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import {
  Badge, Button, Drawer, EmptyState, ErrorState, GapNote, Ic, PageContent, PageHeader, Pagination, RowMenuTrigger,
  SearchField, SkeletonRows, StatusPill, TD, TH, TR, Tab, TabBar, TableCard, TextInput, ToolbarCard, ToolbarSpacer,
  paginate, useToast, type RowMenuItem,
} from '../../../ui/desktop';
import { apiStatus } from '../../../api/http';
import { enumLabel, formatINR } from '../../../lib/format';
import { forgetQuote, isUuid, parseQuoteRef, readRecentQuotes, type QuoteStatus } from './api';

const TABS: { value: QuoteStatus | 'ALL'; label: string }[] = [
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
const PAGE = 10;
const COLS = { quote: 140, job: 100, type: 110, total: 150, valid: 110, status: 180, menu: 36 };

export function QuotesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const role = useAuth().me?.role;
  const canWork = !!role && can.purchaseWork(role);
  const [ids, setIds] = useState(readRecentQuotes);
  const [tab, setTab] = useState<QuoteStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const quoteQs = useQueries({ queries: ids.map((id) => ({ queryKey: pk.quote(id), queryFn: () => purchaseApi.quote(id), retry: 1 })) });
  const jobIds = [...new Set(quoteQs.map((q) => q.data?.job_id).filter((x): x is string => !!x))];
  const jobQs = useQueries({ queries: jobIds.map((id) => ({ queryKey: pk.job(id), queryFn: () => purchaseApi.job(id) })) });
  const jobNo = (id: string) => jobQs[jobIds.indexOf(id)]?.data?.job_number;

  // Drop quotes that no longer resolve (404 / other company) from this device's list.
  const gone = ids.filter((_, i) => quoteQs[i]?.isError && [403, 404].includes(apiStatus(quoteQs[i].error) ?? 0));
  const goneKey = gone.join(',');
  useEffect(() => {
    if (!goneKey) return;
    const g = goneKey.split(',');
    g.forEach(forgetQuote);
    setIds((cur) => cur.filter((x) => !g.includes(x)));
  }, [goneKey]);

  const loaded = quoteQs.map((q) => q.data).filter((q): q is Quote => !!q);
  const latestOf = (q: Quote) => q.revisions[q.revisions.length - 1];
  const pending = quoteQs.some((q) => q.isPending);
  const failed = quoteQs.filter((q) => q.isError);
  const term = search.trim().toLowerCase();
  const matchesSearch = (q: Quote) =>
    !term || q.quote_number.toLowerCase().includes(term) || (jobNo(q.job_id) ?? '').toLowerCase().includes(term);
  const searched = loaded.filter(matchesSearch);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: searched.length };
    for (const q of searched) { const s = latestOf(q)?.quote_status; if (s) c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [searched]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = searched.filter((q) => tab === 'ALL' || latestOf(q)?.quote_status === tab);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = paginate(rows, Math.min(page, pages), PAGE).rows;

  const open = (q: Quote) => navigate(`/p/jobs/${q.job_id}/quote?q=${q.id}`);
  const openRef = (v: string) => { const id = parseQuoteRef(v); if (id) navigate(`/p/quotes/${id}`); return !!id; };

  const menu = (q: Quote): RowMenuItem[] => {
    const s = latestOf(q)?.quote_status;
    return [
      { label: 'Open quote', icon: IconEye, onSelect: () => open(q) },
      { label: 'Open job', icon: IconTool, onSelect: () => navigate(`/p/jobs/${q.job_id}/overview`) },
      ...(canWork && s && REVISABLE.has(s)
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
  };

  const countLabel = term ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : `${rows.length} quote${rows.length === 1 ? '' : 's'}`;

  return (
    <>
      <PageHeader title="Quotes" meta="Customer quotations · prices set manually by Purchase · Sales sends them" />
      <PageContent>
        <TabBar shadow label="Quote status">
          {TABS.map((t) => (
            <Tab key={t.value} active={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }} label={t.label} count={ids.length ? counts[t.value] ?? 0 : null} />
          ))}
        </TabBar>

        <ToolbarCard className="pl-[20px]">
          {canWork && <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setNewOpen(true)}>New quote</Button>}
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>
          <ToolbarSpacer />
          <form onSubmit={(e) => { e.preventDefault(); if (parseQuoteRef(search)) openRef(search); }}>
            <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search quote, job, customer" />
          </form>
        </ToolbarCard>

        <GapNote code="G21">
          There is no cross-job quote list in the API. This table shows the quotes opened on this device; open any other quote from its
          job's Quote tab, or paste a quote ID / link into the search box and press Enter. Customer names aren't readable (G16).
        </GapNote>

        <TableCard fill>
          {ids.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={IconFileInvoice}
                title="No quotes opened yet"
                body="Quotes live on their job: open a job and use its Quote tab. Or paste a quote ID or link to open it."
                action={<OpenQuoteForm onOpen={openRef} />}
              />
            </div>
          ) : !pending && failed.length === ids.length ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load quotes" onRetry={() => failed.forEach((f) => f.refetch())} retrying={failed.some((f) => f.isFetching)} />
            </div>
          ) : (
            <>
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
              {pending && loaded.length === 0 ? <SkeletonRows rows={Math.min(ids.length, 8)} /> : rows.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState
                    icon={IconSearch}
                    title={term ? `No quotes match “${search.trim()}”` : 'No quotes in this status'}
                    body={term ? 'Search covers quote and job numbers of the quotes listed here. Paste a quote ID to open any other quote.' : undefined}
                  />
                </div>
              ) : (
                shown.map((q) => {
                  const r = latestOf(q);
                  return (
                    <TR key={q.id} onClick={() => open(q)} className="gap-[12px]">
                      <TD w={COLS.quote}>
                        <span className="flex items-center gap-[8px] whitespace-nowrap">
                          <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{q.quote_number}</span>
                          {r && <span className="text-[12px] leading-[16px] text-fg-muted">r{r.revision_no}</span>}
                        </span>
                      </TD>
                      <TD w={COLS.job}><span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg-2">{jobNo(q.job_id) ?? '…'}</span></TD>
                      <TD grow kind="strong">—</TD>
                      <TD w={COLS.type}><Badge tone="neutral" label={enumLabel(q.quote_type)} /></TD>
                      <TD w={COLS.total} align="right"><span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatINR(r?.revised_pre_tax)}</span></TD>
                      <TD w={COLS.valid} kind="text">{dayMonth(r?.valid_until)}</TD>
                      <TD w={COLS.status}>{r && <StatusPill domain="quote" value={r.quote_status} />}</TD>
                      <TD w={COLS.menu}><RowMenuTrigger items={menu(q)} label={`Actions for ${q.quote_number}`} /></TD>
                    </TR>
                  );
                })
              )}
              {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
            </>
          )}
        </TableCard>
      </PageContent>

      <NewQuoteDrawer open={newOpen} onClose={() => setNewOpen(false)} onGo={(jobId) => navigate(`/p/jobs/${jobId}/quote`)} />
    </>
  );
}

function OpenQuoteForm({ onOpen }: { onOpen: (v: string) => boolean }) {
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const submit = (e: FormEvent) => { e.preventDefault(); setBad(!onOpen(v)); };
  return (
    <form onSubmit={submit} className="flex w-full items-end gap-[10px] text-left">
      <TextInput label="Open quote" mono placeholder="Quote ID or link" value={v} onChange={(e) => { setV(e.target.value); setBad(false); }} error={bad ? 'Paste a quote ID (UUID) or a /p/quotes/… link.' : null} />
      <Button kind="secondary" type="submit" className="mb-[4px]">Open</Button>
    </form>
  );
}

/** Quotes belong to a job (POST /jobs/{id}/quotes). No Purchase jobs list exists (G15), so the job is chosen by ID. */
function NewQuoteDrawer({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (jobId: string) => void }) {
  const [jobId, setJobId] = useState('');
  const [tried, setTried] = useState(false);
  const bad = !isUuid(jobId);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New quote"
      subtitle="A quote is priced inside its job"
      onSubmit={() => { setTried(true); if (!bad) onGo(jobId.trim().toLowerCase()); }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" type="submit">Open job quote</Button>
        </>
      )}
    >
      <TextInput label="Job *" mono placeholder="Job ID (UUID)" value={jobId} onChange={(e) => setJobId(e.target.value)} error={tried && bad ? 'Paste the job ID.' : null} />
      <GapNote code="G15">No Purchase jobs list exists — paste the job's ID (from its /p/jobs/… link). The quote is built on that job's Quote tab.</GapNote>
    </Drawer>
  );
}
