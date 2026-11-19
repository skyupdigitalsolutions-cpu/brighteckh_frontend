// PQ0 · Quotes to price (/p/supply/quotes) — Figma 238:41630 list · 42073 loading · 42395 empty · 42685 error ·
// 42975 TO PRICE · 43292 ISSUED · 43588 WITH CUSTOMER · 43884 ACCEPTED · 44180 PART ACCEPTED · 44476 REJECTED ·
// 44772 CANCELLED · 45068 search.
// Header "Sales & Supply" + meta; <SupplyTabs/> (238:41847); toolbar (pl-16): stage filter chips (All + every stage;
// px-12 py-7, radius 16, 11/14 SemiBold; selected brand-subtle + brand border) · count · search 260; table card
// (gap 12): Quote 150 · Rev 50 · Enquiry 140 (Data/ID) · Customer flex · Lines 60 → · Value (pre-tax) 150 → ·
// Stage 170 · Updated 120 ("05 Nov, 09:10"). Value "—" while a quote has no lines.
// Data: GET /sales-supply/quotes (stage csv, search, page, page_size). Stage chips have no counts (as drawn).
// Deviations: the Margin column (90) has no API source — BR-11 quote lines carry no supplier cost → omitted with one
// GapNote. "Start quote" (header action + drawer) is not drawn but is the only way Purchase can create a quote from a
// RECEIVED enquiry (POST /sales-quotes).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconPackage, IconPlus, IconSearch } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDayTime, formatPaise } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  Button, EmptyState, GapNote, Ic, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, TD, TH, THead, TR,
  ToolbarSpacer, cx,
} from '../../../ui/desktop';
import { SalesTableCard } from '../../sales/ui';
import { SupplyTabs } from '../ui';
import { QUOTE_STAGES, useQuotes, type QuoteRow, type QuoteStage } from '../api';
import { ListToolbar, TableError } from './local';
import { StartQuoteDrawer } from './StartQuoteDrawer';

const PAGE_SIZE = 25;
const COLS = { quote: 150, rev: 50, enquiry: 140, lines: 60, value: 150, stage: 170, updated: 120 };
const GAP = 12;

export function PurchaseQuotesPage() {
  const me = useMe();
  const isPurchase = me.role === 'PURCHASE';
  const [params, setParams] = useSearchParams();
  const raw = params.get('stage');
  const stage: QuoteStage | null = (QUOTE_STAGES as readonly string[]).includes(raw ?? '') ? (raw as QuoteStage) : null;
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);

  const q = useQuotes({ ...(stage ? { stage: [stage] } : {}), page, page_size: PAGE_SIZE, ...(search ? { search } : {}) });
  const data = q.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const pick = (s: QuoteStage | null) => {
    setPage(1);
    setParams((p) => { const n = new URLSearchParams(p); if (!s) n.delete('stage'); else n.set('stage', s); return n; }, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Sales & Supply"
        meta="Direct product sales · price quotes, verify orders, dispatch"
        action={isPurchase ? <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setStarting(true)}>Start quote</Button> : undefined}
      />
      <PageContent className="flex-1">
        <SupplyTabs />

        <ListToolbar pl={16}>
          <div role="radiogroup" aria-label="Stage" className="flex items-center gap-[6px] overflow-x-auto">
            <StageChip label="All" on={!stage} onClick={() => pick(null)} />
            {QUOTE_STAGES.map((s) => <StageChip key={s} label={enumLabel(s)} on={stage === s} onClick={() => pick(s)} />)}
          </div>
          {!q.isError && data && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{total}</p>}
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} width={260} placeholder="Search quote / customer" label="Search quotes" />
        </ListToolbar>

        <SalesTableCard>
          <THead gap={GAP}>
            <TH w={COLS.quote}>Quote</TH>
            <TH w={COLS.rev}>Rev</TH>
            <TH w={COLS.enquiry}>Enquiry</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.lines} align="right">Lines</TH>
            <TH w={COLS.value} align="right">Value (pre-tax)</TH>
            <TH w={COLS.stage}>Stage</TH>
            <TH w={COLS.updated}>Updated</TH>
          </THead>
          {q.isPending ? <SkeletonRows rows={8} widths={[110, 20, 110, 220, 20, 100, 90, 90]} /> : q.isError ? (
            <TableError title="Couldn't load quotes" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : rows.length === 0 ? (
            <div className="flex w-full justify-center">
              <EmptyState
                icon={search ? IconSearch : IconPackage}
                title={search ? `No quotes match “${search}”` : 'Nothing to price'}
                body={search
                  ? 'Search covers quote number, customer name or code, and enquiry number.'
                  : 'New enquiries from Sales become quotes to price here. Check Enquiries in the Sales panel, or clear the stage filter.'}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <PurchaseQuoteRow key={r.quote_id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
          <GapNote code="GAP" className="mt-[16px]">
            Margin isn’t shown: BR-11 quote lines carry no supplier cost and no cost source is defined for product quotes.
          </GapNote>
        </SalesTableCard>
      </PageContent>
      {isPurchase && <StartQuoteDrawer open={starting} onClose={() => setStarting(false)} />}
    </>
  );
}

function StageChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        'flex shrink-0 items-start overflow-clip whitespace-nowrap rounded-[16px] border px-[12px] py-[7px] text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
        on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
      )}
    >
      {label}
    </button>
  );
}

function PurchaseQuoteRow({ r }: { r: QuoteRow }) {
  return (
    <TR to={`/p/supply/quotes/${r.quote_id}`} gap={GAP}>
      <TD w={COLS.quote} kind="id">{r.quote_number}</TD>
      <TD w={COLS.rev} kind="number">{r.revision_no}</TD>
      <TD w={COLS.enquiry} kind="id">{r.enquiry_number}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.lines} align="right" kind="number">{r.line_count}</TD>
      <TD w={COLS.value} align="right">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{r.line_count > 0 ? formatPaise(r.total_paise) : '—'}</span>
      </TD>
      <TD w={COLS.stage}><StatusPill domain="supplyQuoteStage" value={r.stage} /></TD>
      <TD w={COLS.updated} kind="text">{formatDayTime(r.last_activity_at)}</TD>
    </TR>
  );
}
