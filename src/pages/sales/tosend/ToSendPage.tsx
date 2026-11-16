// SQ · To send (/s/to-send?q=<quoteId>) — Figma 177:137360 (Q-00087) · 177:137479 (Q-00086) · 177:137586 (Q-00084);
// after send 177:138183 · 177:138285 · 177:138387.
// Page header "Quotes to send" / "Released by Purchase · prices are fixed — check, then send".
// Split (gap 20): left rail "List" 380 wide, glass-strong, radius 24, p-24, gap 10 — title "Released to Sales · n"
// (Desktop/H3 15/20 SemiBold); cards px-14 py-12 radius 16 gap 4: "Q-00087 · r1" Data/ID + badge, customer 14/20
// Medium, amount Data/Number secondary. Selected = brand-subtle fill + 1px brand-border; others bg-subtle.
// Right: the quote pane — <SalesQuotePane> from ../quote (built by the quote agent; it owns the pane frame).
// After a send (177:138183): success alert above the split, the sent quote leaves the rail and the next one is selected.
//
// Data: GET /sales/quotes?stage=TO_SEND (contract: sales-contract.md §A), oldest release first (server order).
// Deviations: rail amount = pre-tax (revised_pre_tax), not the Figma total incl. tax (total composition open, G-D-2);
// badge = API sales_stage "TO SEND" (Figma "RELEASED TO SALES" is the BR-04 quote_status); "r1" shows the API
// revision_no (0-based). Alert: "marked as sent" — POST /quotes/:id/send emails nothing and stores no recipient, so
// Figma's "Emailed to purchase@…" is not shown.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { IconSend } from '@tabler/icons-react';
import { formatINR } from '../../../lib/format';
import { cx, EmptyState, ErrorState, InlineAlert, PageContent, PageHeader, StateCard, errorBody } from '../../../ui/desktop';
import { quoteRef, SALES_QUOTES_KEY, useSalesQuotes, type SalesQuoteRow, type SalesQuotesParams } from '../api';
import { Skel, StageBadge } from '../ui';
import { SalesQuotePane } from '../quote';

const RAIL: SalesQuotesParams = { stage: ['TO_SEND'], page_size: 100 };

export function ToSendPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get('q');
  const railQ = useSalesQuotes(RAIL);
  const rows = railQ.data?.rows ?? [];
  const [sent, setSent] = useState<SalesQuoteRow | null>(null);

  const select = (id: string | null, replace = false) =>
    setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('q', id); else n.delete('q'); return n; }, { replace });

  // No ?q= → open the oldest released quote (Figma always shows one selected).
  const firstId = rows[0]?.quote_id;
  useEffect(() => {
    if (!selected && firstId) select(firstId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- select is a fresh closure each render; only these inputs matter
  }, [selected, firstId]);

  // After a send the quote leaves the TO_SEND list (177:138183): show the alert and select the next one. Detected from
  // the list itself (selected id present in the previous fetch, gone in this one), so it works whichever refetch —
  // ours in onChanged or the pane's own invalidation — lands first.
  const prevRows = useRef<SalesQuoteRow[] | null>(null);
  const data = railQ.data;
  useEffect(() => {
    if (!data || railQ.isPlaceholderData) return;
    const prev = prevRows.current;
    prevRows.current = data.rows;
    if (!prev || !selected) return;
    const idx = prev.findIndex((r) => r.quote_id === selected);
    if (idx < 0 || data.rows.some((r) => r.quote_id === selected)) return;
    setSent(prev[idx]!);
    const next = data.rows[idx] ?? data.rows[idx - 1] ?? null;
    select(next?.quote_id ?? null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new list only
  }, [data]);

  const onChanged = () => { void qc.invalidateQueries({ queryKey: SALES_QUOTES_KEY }); };

  const total = railQ.data?.total ?? 0;
  const showEmpty = railQ.isSuccess && rows.length === 0 && !selected;

  return (
    <>
      <PageHeader title="Quotes to send" meta="Released by Purchase · prices are fixed — check, then send" />
      <PageContent>
        {sent && (
          <InlineAlert tone="success" title={`${sent.quote_number} marked as sent to ${sent.customer_name}`}>
            It moved to Sent — record the customer's response there.
          </InlineAlert>
        )}
        {railQ.isError ? (
          <StateCard>
            <ErrorState title="Couldn't load quotes to send" body={errorBody(railQ.error)} onRetry={() => railQ.refetch()} retrying={railQ.isFetching} />
          </StateCard>
        ) : showEmpty ? (
          <StateCard>
            <EmptyState
              icon={IconSend}
              title={sent ? 'All caught up' : 'Nothing to send'}
              body="Quotes appear here when Purchase releases them to you."
            />
          </StateCard>
        ) : (
          <div className="flex min-h-[656px] w-full flex-1 items-stretch gap-[20px]">
            <div className="glass-strong flex w-[380px] shrink-0 flex-col items-start gap-[10px] overflow-y-auto rounded-[24px] p-[24px]">
              <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">
                Released to Sales{railQ.data ? ` · ${total}` : ''}
              </p>
              {railQ.isPending ? (
                Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex w-full flex-col gap-[8px] rounded-[16px] bg-subtle px-[14px] py-[12px]" aria-hidden>
                    <Skel w={120} /><Skel w={160} /><Skel w={90} />
                  </div>
                ))
              ) : rows.length === 0 ? (
                <p className="text-[14px] leading-[20px] text-fg-2">Nothing else is waiting to be sent.</p>
              ) : (
                rows.map((r) => <RailCard key={r.quote_id} r={r} active={r.quote_id === selected} onSelect={() => { setSent(null); select(r.quote_id); }} />)
              )}
              {total > rows.length && (
                <p className="text-[12px] leading-[16px] text-fg-muted">Showing the {rows.length} oldest of {total}.</p>
              )}
            </div>
            <div className="flex min-w-px flex-1 flex-col self-stretch">
              {selected ? (
                <SalesQuotePane key={selected} quoteId={selected} onChanged={onChanged} />
              ) : (
                <div className="glass-strong flex flex-1 items-center justify-center rounded-[24px] p-[24px]" aria-busy>
                  <Skel w={240} h={12} />
                </div>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}

function RailCard({ r, active, onSelect }: { r: SalesQuoteRow; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex w-full shrink-0 flex-col items-start gap-[4px] overflow-clip rounded-[16px] border px-[14px] py-[12px] text-left',
        active ? 'border-brand-border bg-brand-subtle' : 'border-transparent bg-subtle hover:bg-surface',
      )}
    >
      <span className="flex w-full items-center gap-[8px] overflow-clip">
        <span className="min-w-px flex-1 truncate font-mono text-[13px] font-medium leading-[18px] text-fg">{quoteRef(r)}</span>
        <StageBadge stage={r.sales_stage} />
      </span>
      <span className="w-full truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{r.customer_name}</span>
      <span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg-2" title="Pre-tax">{formatINR(r.revised_pre_tax)}</span>
    </button>
  );
}
