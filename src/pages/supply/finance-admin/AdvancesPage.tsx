// FA0 · Advances (/f/advances) — Figma list 247:53867 · loading 247:54125 · empty 247:54400 · error 247:54641.
// Header "Advances" + meta; content gap 16; toolbar (count "n to confirm" · search 300 "Search order / customer"); table card
// (radius 24): Order 150 (Data/ID) · Customer flex (Body strong) · Advance 170 (Body secondary, "FIXED AMOUNT" /
// "PERCENTAGE · 20 %") · Amount 140 → (Data/Number strong) · Recorded by 170 ("Ravi Kumar · 05 Nov") · Status 140 (badge).
// Loading = header row + 8 skeleton rows, no count. Empty = header row + Empty state (package icon), no count. Error =
// header row + blocked Inline alert "Couldn't load advances" + centred primary "Try again" (pt-24).
// Row click opens FA1 (ConfirmAdvanceDrawer).
//
// Data: GET /sales-supply/orders?advance_pending=true (orders whose recorded terms need an advance Finance hasn't confirmed),
// server pagination (25) + debounced search (SO no., customer name / code, quote no., customer order ref).
// Deviations: the "PENDING" status is UI wording for "not yet confirmed" (no API enum: the row is in the queue because
// advance_confirmed_at is null), shown as a neutral Badge. The toolbar count is hidden in the loading / empty states as drawn.
import { useState } from 'react';
import { IconPackage, IconRefresh, IconSearch } from '@tabler/icons-react';
import { formatPaise } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  Badge, Button, EmptyState, Ic, InlineAlert, PageHeader, Pagination, SearchField, TD, TH, ToolbarSpacer, errorBody,
} from '../../../ui/desktop';
import { useOrders, type OrderRow } from '../api';
import { ConfirmAdvanceDrawer } from './ConfirmAdvanceDrawer';
import { advanceText } from './text';
import { FinHead, FinRow, FinSkeleton, FinTableCard, FinToolbar } from './local';

const PAGE_SIZE = 25;
const COLS = { order: 150, advance: 170, amount: 140, recorded: 170, status: 140 };

const dm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** ISO → "05 Nov" (IST). */
const dayMonth = (iso: string | null | undefined) => (iso ? dm.format(new Date(iso)) : '—');

export function AdvancesPage() {
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<OrderRow | null>(null);

  const q = useOrders({ advance_pending: true, page, page_size: PAGE_SIZE, ...(search ? { search } : {}) });
  const data = q.data;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showCount = !q.isPending && !q.isError && total > 0;
  const countLabel = search ? `${total} result${total === 1 ? '' : 's'}` : `${total} to confirm`;

  return (
    <>
      <PageHeader title="Advances" meta="Confirm required advances against a customer payment receipt" />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-[16px]">
        <FinToolbar>
          {showCount && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>}
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search order / customer" label="Search advances" />
        </FinToolbar>

        <FinTableCard>
          <FinHead>
            <TH w={COLS.order}>Order</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.advance}>Advance</TH>
            <TH w={COLS.amount} align="right">Amount</TH>
            <TH w={COLS.recorded}>Recorded by</TH>
            <TH w={COLS.status}>Status</TH>
          </FinHead>
          {q.isPending ? <FinSkeleton /> : q.isError ? (
            <>
              <InlineAlert tone="blocked" title="Couldn't load advances">{errorBody(q.error)}</InlineAlert>
              <div className="flex w-full items-start justify-center pt-[24px]">
                <Button busy={q.isFetching} icon={<Ic icon={IconRefresh} size={18} />} onClick={() => q.refetch()}>Try again</Button>
              </div>
            </>
          ) : rows.length === 0 ? (
            <EmptyState
              className="mx-auto"
              icon={search ? IconSearch : IconPackage}
              title={search ? `No advances match “${search}”` : 'No advances to confirm'}
              body={search
                ? 'Search covers order number, customer name or code, quote number and customer order reference.'
                : 'When Purchase records payment terms with an advance, it appears here.'}
            />
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <AdvanceRow key={r.id} r={r} onOpen={() => setOpen(r)} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </FinTableCard>
      </div>

      {open && <ConfirmAdvanceDrawer order={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AdvanceRow({ r, onOpen }: { r: OrderRow; onOpen: () => void }) {
  const so = r.sales_order_number ?? r.quote_number;
  return (
    <FinRow onOpen={onOpen} label={`Confirm advance for ${so}`}>
      <TD w={COLS.order} kind="id">{so}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.advance} kind="text">{advanceText(r)}</TD>
      <TD w={COLS.amount} align="right">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatPaise(r.advance_required_amount_paise)}</span>
      </TD>
      <TD w={COLS.recorded} kind="text">{`${r.payment_terms_recorded_by_name ?? '—'} · ${dayMonth(r.payment_terms_recorded_at)}`}</TD>
      <TD w={COLS.status}><Badge tone="neutral" label="PENDING" /></TD>
    </FinRow>
  );
}
