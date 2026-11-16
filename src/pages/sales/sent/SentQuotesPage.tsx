// SS0 · Sent quotes (/s/sent) — Figma 177:138501; tabs Awaiting 177:138596 · Accepted 177:138652 · Rejected 177:138695 ·
// Expired 177:138738; search "nandi" 177:138781.
// Page header "Sent quotes" + meta; tab bar (glass-strong, radius 28) "All · n" …; toolbar (count · search 300);
// table card (radius 24): header bg-subtle radius 20 px-16 py-12 gap 12; rows px-16 py-14 gap 12. Cells: Quote 140
// ("Q-00083 · r1" Data/ID) · Customer flex (14/20 Medium) · Sent 150 (14/20 secondary "05 Nov, 15:20") · Total 150 →
// (Data/Number strong) · Waiting 110 (14/20 primary "2 days", muted "—") · Status 150 (badge).
//
// Data: GET /sales/quotes (contract: sales-contract.md §A). Server pagination + debounced search; tab counts =
// counts_by_stage of the same response (under the current search).
// Tab → stage mapping (URL ?stage=):
//   All           → AWAITING,IN_DISCUSSION,ACCEPTED,REJECTED,EXPIRED (every sent stage; TO_SEND lives on "To send")
//   Awaiting      → AWAITING
//   In discussion → IN_DISCUSSION   (not drawn in Figma; the API has the stage — COUNTER_OFFER / TECHNICAL_QUERY /
//                                     PARTIAL_ACCEPTANCE / ON_HOLD responses would otherwise be unreachable)
//   Accepted      → ACCEPTED
//   Rejected      → REJECTED
//   Expired       → EXPIRED
// Deviations: "Total incl. tax" → "Pre-tax total" (revised_pre_tax; total composition is an open client decision,
// CLAUDE.md §5 / G-D-2, same as Purchase Q0). Status badge = API sales_stage text (AWAITING, not Figma's "SENT").
// Waiting = calendar days since sent_at, shown on AWAITING rows only (raw age, no chase threshold).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconSearch, IconSend } from '@tabler/icons-react';
import { formatDayTime, formatINR } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  EmptyState, ErrorState, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, TD, TH, THead, TR, Tab,
  ToolbarSpacer, errorBody,
} from '../../../ui/desktop';
import { ageText, quoteRef, SENT_STAGES, useSalesQuotes, type SalesQuoteRow, type SalesStage } from '../api';
import { SalesTabBar, SalesTableCard, SalesToolbar, StageBadge } from '../ui';

type TabKey = 'ALL' | Exclude<SalesStage, 'TO_SEND'>;
const TABS: { key: TabKey; label: string; stages: SalesStage[] }[] = [
  { key: 'ALL', label: 'All', stages: SENT_STAGES },
  { key: 'AWAITING', label: 'Awaiting', stages: ['AWAITING'] },
  { key: 'IN_DISCUSSION', label: 'In discussion', stages: ['IN_DISCUSSION'] },
  { key: 'ACCEPTED', label: 'Accepted', stages: ['ACCEPTED'] },
  { key: 'REJECTED', label: 'Rejected', stages: ['REJECTED'] },
  { key: 'EXPIRED', label: 'Expired', stages: ['EXPIRED'] },
];
const PAGE_SIZE = 25;
const COLS = { quote: 140, sent: 150, total: 150, waiting: 110, status: 150 };
const GAP = 12;

export function SentQuotesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('stage')) ?? TABS[0]!;
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);

  const q = useSalesQuotes({ stage: tab.stages, page, page_size: PAGE_SIZE, ...(search ? { search } : {}) });
  const data = q.data;
  const counts = data?.counts_by_stage;
  const countOf = (t: (typeof TABS)[number]) => (counts ? t.stages.reduce((s, st) => s + (counts[st] ?? 0), 0) : null);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const countLabel = !data ? '…' : search ? `${total} result${total === 1 ? '' : 's'}` : `${total} quote${total === 1 ? '' : 's'}`;

  const selectTab = (k: TabKey) => {
    setPage(1);
    setParams((p) => { const n = new URLSearchParams(p); if (k === 'ALL') n.delete('stage'); else n.set('stage', k); return n; }, { replace: true });
  };

  return (
    <>
      <PageHeader title="Sent quotes" meta="Track customer replies · record their response" />
      <PageContent>
        <SalesTabBar label="Sales stage">
          {TABS.map((t) => (
            <Tab key={t.key} active={tab.key === t.key} onClick={() => selectTab(t.key)} label={t.label} count={countOf(t)} />
          ))}
        </SalesTabBar>

        <SalesToolbar>
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search quote or customer" label="Search sent quotes" />
        </SalesToolbar>

        <SalesTableCard>
          <THead gap={GAP}>
            <TH w={COLS.quote}>Quote</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.sent}>Sent</TH>
            <TH w={COLS.total} align="right">Pre-tax total</TH>
            <TH w={COLS.waiting}>Waiting</TH>
            <TH w={COLS.status}>Status</TH>
          </THead>
          {q.isPending ? <SkeletonRows rows={8} widths={[110, 260, 110, 110, 60, 90]} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load sent quotes" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconSend}
                title={search ? `No quotes match “${search}”` : tab.key === 'ALL' ? 'No sent quotes yet' : 'No quotes in this stage'}
                body={search
                  ? 'Search covers quote number, job number, customer name or code, serial, make and model.'
                  : tab.key === 'ALL' ? 'Quotes you send from “To send” appear here.' : undefined}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <SentRow key={r.quote_id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </SalesTableCard>
      </PageContent>
    </>
  );
}

function SentRow({ r }: { r: SalesQuoteRow }) {
  const waiting = r.sales_stage === 'AWAITING' && r.sent_at ? ageText(r.sent_at) : null;
  return (
    <TR to={`/s/quotes/${r.quote_id}`} gap={GAP}>
      <TD w={COLS.quote} kind="id">{quoteRef(r)}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.sent} kind="text">{formatDayTime(r.sent_at)}</TD>
      <TD w={COLS.total} align="right">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatINR(r.revised_pre_tax)}</span>
      </TD>
      <TD w={COLS.waiting}>
        {waiting
          ? <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">{waiting}</span>
          : <span className="text-[14px] leading-[20px] text-fg-muted">—</span>}
      </TD>
      <TD w={COLS.status}><StageBadge stage={r.sales_stage} /></TD>
    </TR>
  );
}
