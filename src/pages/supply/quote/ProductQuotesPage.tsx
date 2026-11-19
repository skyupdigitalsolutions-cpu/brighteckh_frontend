// SQS0 · Product quotes, Sales list (/s/product-quotes) — Figma 239:43715 list · 44071 loading · 44379 empty ·
// 44655 error · 44931 ISSUED · 45211 WITH CUSTOMER · 45491 ACCEPTED · 45771 PART ACCEPTED · 46051 REJECTED · 46331 search.
// Tab bar: All · ISSUED · WITH CUSTOMER · ACCEPTED · PART ACCEPTED · REJECTED (counts = counts_by_stage under the
// current search; All = the sum of those five). Toolbar: count · search 300. Table (gap 10): Quote 150 (Data/ID) ·
// Rev 50 (Data/Number) · Customer flex · Lines 60 → · Value (pre-tax) 150 → (Data/Number strong) · Valid until 110
// ("18 Nov") · Last sent 160 ("EMAIL · 02 Nov", "—") · Stage 170 (badge).
// Empty (44379): "No issued quotes yet" — "Purchase is pricing n enquiries…" (n = counts_by_stage.TO_PRICE).
// Data: GET /sales-supply/quotes (stage csv, search, page, page_size). Sales never sees cost / margin.
// Note: TO_PRICE and CANCELLED quotes are not tabs in SQS0 (as drawn); they stay reachable from the enquiry detail.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconPackage, IconSearch } from '@tabler/icons-react';
import { enumLabel, formatDayMonth, formatPaise } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  EmptyState, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, TD, TH, THead, TR, Tab, ToolbarSpacer,
} from '../../../ui/desktop';
import { SalesTabBar, SalesTableCard } from '../../sales/ui';
import { useQuotes, type QuoteRow, type QuoteStage } from '../api';
import { ListToolbar, TableError } from './local';
import { istDayMonth } from './data';

const SALES_STAGES = ['ISSUED', 'WITH_CUSTOMER', 'ACCEPTED', 'PART_ACCEPTED', 'REJECTED'] as const satisfies readonly QuoteStage[];
type TabKey = 'ALL' | (typeof SALES_STAGES)[number];
const PAGE_SIZE = 25;
const COLS = { quote: 150, rev: 50, lines: 60, value: 150, valid: 110, sent: 160, stage: 170 };
const GAP = 10;

export function ProductQuotesPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('stage');
  const tab: TabKey = (SALES_STAGES as readonly string[]).includes(raw ?? '') ? (raw as TabKey) : 'ALL';
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);

  const q = useQuotes({ stage: tab === 'ALL' ? [...SALES_STAGES] : [tab], page, page_size: PAGE_SIZE, ...(search ? { search } : {}) });
  const data = q.data;
  const counts = data?.counts_by_stage;
  const all = counts ? SALES_STAGES.reduce((s, st) => s + (counts[st] ?? 0), 0) : null;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const countLabel = !data ? '…' : search ? `${total} result${total === 1 ? '' : 's'}` : `${total} quote${total === 1 ? '' : 's'}`;
  const pricing = counts?.TO_PRICE ?? 0;

  const selectTab = (k: TabKey) => {
    setPage(1);
    setParams((p) => { const n = new URLSearchParams(p); if (k === 'ALL') n.delete('stage'); else n.set('stage', k); return n; }, { replace: true });
  };

  return (
    <>
      <PageHeader title="Product quotes" meta="Issued by Purchase · send to the customer and record the reply" />
      <PageContent className="flex-1">
        <SalesTabBar label="Quote stage">
          <Tab active={tab === 'ALL'} onClick={() => selectTab('ALL')} label="All" count={all} />
          {SALES_STAGES.map((s) => (
            <Tab key={s} active={tab === s} onClick={() => selectTab(s)} label={enumLabel(s)} count={counts ? counts[s] ?? 0 : null} />
          ))}
        </SalesTabBar>

        <ListToolbar>
          {!q.isError && rows.length > 0 && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>}
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} width={300} placeholder="Search quote / customer" label="Search product quotes" />
        </ListToolbar>

        <SalesTableCard>
          <THead gap={GAP}>
            <TH w={COLS.quote}>Quote</TH>
            <TH w={COLS.rev}>Rev</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.lines} align="right">Lines</TH>
            <TH w={COLS.value} align="right">Value (pre-tax)</TH>
            <TH w={COLS.valid}>Valid until</TH>
            <TH w={COLS.sent}>Last sent</TH>
            <TH w={COLS.stage}>Stage</TH>
          </THead>
          {q.isPending ? <SkeletonRows rows={8} widths={[110, 20, 240, 20, 100, 60, 110, 100]} /> : q.isError ? (
            <TableError title="Couldn't load quotes" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : rows.length === 0 ? (
            <div className="flex w-full justify-center">
              <EmptyState
                icon={search ? IconSearch : IconPackage}
                title={search ? `No quotes match “${search}”` : tab === 'ALL' ? 'No issued quotes yet' : `No ${enumLabel(tab)} quotes`}
                body={search
                  ? 'Search covers quote number, customer name or code, and enquiry number.'
                  : tab === 'ALL'
                    ? `${pricing > 0 ? `Purchase is pricing ${pricing} ${pricing === 1 ? 'enquiry' : 'enquiries'}. ` : ''}Issued quotes appear here for you to send.`
                    : undefined}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <QuoteListRow key={r.quote_id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </SalesTableCard>
      </PageContent>
    </>
  );
}

function QuoteListRow({ r }: { r: QuoteRow }) {
  return (
    <TR to={`/s/product-quotes/${r.quote_id}`} gap={GAP}>
      <TD w={COLS.quote} kind="id">{r.quote_number}</TD>
      <TD w={COLS.rev} kind="number">{r.revision_no}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.lines} align="right" kind="number">{r.line_count}</TD>
      <TD w={COLS.value} align="right">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{r.line_count > 0 ? formatPaise(r.total_paise) : '—'}</span>
      </TD>
      <TD w={COLS.valid} kind="text">{formatDayMonth(r.validity_until)}</TD>
      <TD w={COLS.sent} kind="text">{r.last_sent_at ? `${enumLabel(r.last_sent_channel ?? '')} · ${istDayMonth(r.last_sent_at)}` : '—'}</TD>
      <TD w={COLS.stage}><StatusPill domain="supplyQuoteStage" value={r.stage} /></TD>
    </TR>
  );
}
