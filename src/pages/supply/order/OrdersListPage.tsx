// SOS0 · Sales orders (Sales /s/orders) — list 244:50659, loading 244:50982, empty 244:51267, error 244:51520.
// PO0 · Sales orders (Purchase /p/supply/orders) — list 240:45427, loading 240:45801, empty 240:46119, error 240:46405,
//   status filters DRAFT 240:46691 · VERIFIED 240:46983 · PART DELIVERED 240:47275 · DELIVERED 240:47567 · CLOSED 240:47859 ·
//   CANCELLED 240:48127.
// Data: GET /sales-supply/orders (status csv, search, paging; counts_by_status under the search).
// Sales: page header "Sales orders", Content gap 16, toolbar (count · search 300), table card r24 p16; header row bg-subtle
//   r18 px-14 py-10 gap 10; rows px-14 py-13 gap 10. Columns Order 180 · Customer flex · From quote 170 · Value 150 → ·
//   Authorisation 140 · Status 160.
// Purchase: SupplyTabs, toolbar (status chips px-12 py-7 r16 · count · search 260), header row r20 px-16 py-12 gap 10; rows
//   px-16 py-14 gap 10. Columns Order 170 · Customer flex · From quote 170 · Lines 60 → · Value 150 → · Authorisation 140 ·
//   Status 160 · Updated 110.
// Order cell: SO number, or "Draft · not numbered" while DRAFT (number assigned at verify). From quote: "SQ-… · r<n>".
// Authorisation (derived, supplyAuthorisation tones): VERIFIED once the order is verified (verify picks a verified event),
//   PENDING while evidence awaits verification, "—" otherwise. Updated = latest of created / verified / closed (the row has
//   no updated_at).
import { useState, type ReactNode } from 'react';
import { Link as TRLink, useSearchParams } from 'react-router-dom';
import { IconPackage, IconSearch } from '@tabler/icons-react';
import { formatDayTime, formatPaise } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  EmptyState, ErrorState, GlassCard, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, ToolbarSpacer, cx, errorBody,
} from '../../../ui/desktop';
import { ORDER_STATUSES, useOrders, type OrderRow, type OrderStatus } from '../api';
import { SupplyTabs } from '../ui';
import type { Role } from './data';

const PAGE_SIZE = 25;
const SALES_COLS = { order: 180, quote: 170, value: 150, auth: 140, status: 160 };
const PUR_COLS = { order: 170, quote: 170, lines: 60, value: 150, auth: 140, status: 160, updated: 110 };
// Figma chip order (240:45655).
const CHIP_ORDER: OrderStatus[] = ['DRAFT', 'VERIFIED', 'PART_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED'];

export function OrdersListPage({ role }: { role: Role }) {
  const purchase = role === 'PURCHASE';
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status = (ORDER_STATUSES as readonly string[]).includes(statusParam ?? '') ? (statusParam as OrderStatus) : null;
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);

  const q = useOrders({ status: status ? [status] : undefined, search: search || undefined, page, page_size: PAGE_SIZE });
  const data = q.data;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = purchase ? '/p/supply/orders' : '/s/orders';

  const pick = (s: OrderStatus | null) => {
    setPage(1);
    setParams((p) => { const n = new URLSearchParams(p); if (s) n.set('status', s); else n.delete('status'); return n; }, { replace: true });
  };

  const head = purchase ? (
    <Head pad="purchase">
      <Th w={PUR_COLS.order}>Order</Th><Th grow>Customer</Th><Th w={PUR_COLS.quote}>From quote</Th>
      <Th w={PUR_COLS.lines} right>Lines</Th><Th w={PUR_COLS.value} right>Value (pre-tax)</Th>
      <Th w={PUR_COLS.auth}>Authorisation</Th><Th w={PUR_COLS.status}>Status</Th><Th w={PUR_COLS.updated}>Updated</Th>
    </Head>
  ) : (
    <Head pad="sales">
      <Th w={SALES_COLS.order}>Order</Th><Th grow>Customer</Th><Th w={SALES_COLS.quote}>From quote</Th>
      <Th w={SALES_COLS.value} right>Value (pre-tax)</Th><Th w={SALES_COLS.auth}>Authorisation</Th><Th w={SALES_COLS.status}>Status</Th>
    </Head>
  );

  const body = q.isPending ? (
    <SkeletonRows rows={8} widths={purchase ? [130, 260, 130, 30, 100, 80, 90, 80] : [130, 300, 130, 100, 80, 90]} />
  ) : q.isError ? (
    <div className="flex flex-1 items-center justify-center py-[40px]">
      <ErrorState title="Couldn't load sales orders" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
    </div>
  ) : rows.length === 0 ? (
    <EmptyState
      className="w-full"
      icon={search ? IconSearch : IconPackage}
      title={search ? `No orders match “${search}”` : status ? `No ${status.replace(/_/g, ' ')} orders` : 'No orders yet'}
      body={search
        ? 'Search covers SO number, customer name or code, quote number and customer order reference.'
        : 'Draft one from an ACCEPTED or PART ACCEPTED product quote.'}
    />
  ) : (
    <div className={cx('flex w-full flex-col', q.isPlaceholderData && 'opacity-60')}>
      {rows.map((r) => (purchase ? <PurchaseRow key={r.id} r={r} to={`${base}/${r.id}`} /> : <SalesRow key={r.id} r={r} to={`${base}/${r.id}`} />))}
    </div>
  );

  const card = (
    <GlassCard strong radius="rounded-[24px]" className="flex min-h-[586px] w-full flex-1 flex-col items-stretch p-[16px]">
      {head}
      {body}
      {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
    </GlassCard>
  );

  if (!purchase) {
    return (
      <>
        <PageHeader title="Sales orders" meta="Your product orders · track delivery · attach customer authorisation" />
        <div className="flex w-full min-w-0 flex-col gap-[16px]">
          <div className="glass-strong flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[20px] pr-[10px]">
            {data && total > 0 && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{search ? `${total} result${total === 1 ? '' : 's'}` : `${total} order${total === 1 ? '' : 's'}`}</p>}
            <ToolbarSpacer />
            <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search order / customer" label="Search sales orders" className="!bg-subtle" />
          </div>
          {card}
        </div>
      </>
    );
  }

  const counts = data?.counts_by_status;
  return (
    <>
      <PageHeader title="Sales & Supply" meta="Direct product sales · price quotes, verify orders, dispatch" />
      <PageContent>
        <SupplyTabs />
        <div className="glass-strong flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[16px] pr-[10px]">
          <div role="radiogroup" aria-label="Order status" className="flex shrink-0 items-center gap-[6px] overflow-clip">
            <StatusChip on={!status} label="All" onClick={() => pick(null)} />
            {CHIP_ORDER.map((s) => (
              <StatusChip key={s} on={status === s} label={s.replace(/_/g, ' ')} title={counts ? `${counts[s]} orders` : undefined} onClick={() => pick(s)} />
            ))}
          </div>
          {data && <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{total}</p>}
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search order / customer" label="Search sales orders" width={260} className="!bg-subtle" />
        </div>
        {card}
      </PageContent>
    </>
  );
}

function StatusChip({ on, label, onClick, title }: { on: boolean; label: string; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={title}
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

// ------------------------------------------------------------------ table pieces
function Head({ children, pad }: { children: ReactNode; pad: 'sales' | 'purchase' }) {
  return (
    <div role="row" className={cx('flex w-full shrink-0 items-start gap-[10px] overflow-clip bg-subtle', pad === 'sales' ? 'rounded-[18px] px-[14px] py-[10px]' : 'rounded-[20px] px-[16px] py-[12px]')}>
      {children}
    </div>
  );
}
function Th({ w, grow, right, children }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end')} style={grow ? undefined : { width: w }}>
      <span className="truncate whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}
function Td({ w, grow, right, children }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <div role="cell" className={cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end')} style={grow ? undefined : { width: w }}>
      {children}
    </div>
  );
}
const Id = ({ children }: { children: ReactNode }) => <span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{children}</span>;
const Dash = () => <span className="text-[14px] leading-[20px] text-fg-2">—</span>;

function AuthCell({ r }: { r: OrderRow }) {
  if (r.verified_at) return <StatusPill domain="supplyAuthorisation" value="VERIFIED" />;
  if (r.pending_authorisations > 0) return <StatusPill domain="supplyAuthorisation" value="PENDING" />;
  return <Dash />;
}
const orderRef = (r: OrderRow) => r.sales_order_number ?? 'Draft · not numbered';
const quoteRef = (r: OrderRow) => `${r.quote_number} · r${r.quote_revision_no}`;
const updated = (r: OrderRow) => [r.created_at, r.verified_at, r.closed_at].filter((x): x is string => !!x).sort().pop() ?? null;

function SalesRow({ r, to }: { r: OrderRow; to: string }) {
  return (
    <RowLink to={to} cls="px-[14px] py-[13px]">
      <Td w={SALES_COLS.order}><Id>{orderRef(r)}</Id></Td>
      <Td grow><span className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{r.customer_name}</span></Td>
      <Td w={SALES_COLS.quote}><Id>{quoteRef(r)}</Id></Td>
      <Td w={SALES_COLS.value} right><span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatPaise(r.order_total_paise)}</span></Td>
      <Td w={SALES_COLS.auth}><AuthCell r={r} /></Td>
      <Td w={SALES_COLS.status}><StatusPill domain="supplyOrder" value={r.status} /></Td>
    </RowLink>
  );
}

function PurchaseRow({ r, to }: { r: OrderRow; to: string }) {
  return (
    <RowLink to={to} cls="px-[16px] py-[14px]">
      <Td w={PUR_COLS.order}><Id>{orderRef(r)}</Id></Td>
      <Td grow><span className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{r.customer_name}</span></Td>
      <Td w={PUR_COLS.quote}><Id>{quoteRef(r)}</Id></Td>
      <Td w={PUR_COLS.lines} right><span className="font-mono text-[14px] leading-[20px] text-fg">{r.lines_total}</span></Td>
      <Td w={PUR_COLS.value} right><span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatPaise(r.order_total_paise)}</span></Td>
      <Td w={PUR_COLS.auth}><AuthCell r={r} /></Td>
      <Td w={PUR_COLS.status}><StatusPill domain="supplyOrder" value={r.status} /></Td>
      <Td w={PUR_COLS.updated}><span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{formatDayTime(updated(r))}</span></Td>
    </RowLink>
  );
}

function RowLink({ to, cls, children }: { to: string; cls: string; children: ReactNode }) {
  return (
    <TRLink to={to} className={cx('flex w-full shrink-0 items-center gap-[10px] overflow-clip border-b border-line transition-colors hover:bg-surface', cls)}>
      {children}
    </TRLink>
  );
}
