// FI0 · Product invoices (F-D 247:51039): BLOCKED not configured 247:51040 · queue 51290 · loading 51571 · empty 51854 ·
// error 52103. Data: GET /sales-supply/invoice-queue (FINANCE) — rows READY first, `config` echoes the gate.
// config.blocked → 51040: blocked alert + "What's missing" (invoice trigger 11C-07 / product GST rate P-12, both
// CLIENT-UNCONFIRMED) + empty card. Otherwise the queue: toolbar "n ready · n waiting" + search; columns Order 150 ·
// Customer grow · Trigger event 220 · Tax regime 140 · Taxable value 140 (right, Data/Number strong) · Status 150.
// The queue frame's "Example configuration shown" alert is design-only: the REAL config from the API is rendered.
// API over Figma: the customer city ("· Chennai") isn't on the row (state code only) → name only. Taxable value =
// invoiceable_taxable_paise for READY rows, else the order's uninvoiced_taxable_paise.
import { useState } from 'react';
import { IconAlertTriangle, IconFileInvoice, IconSearch } from '@tabler/icons-react';
import { enumLabel, formatDayMonth, formatPaise } from '../../../../lib/format';
import {
  Badge, EmptyState, ErrorState, InlineAlert, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, errorBody,
} from '../../../../ui/desktop';
import { useAuth } from '../../../../auth/AuthProvider';
import { useInvoiceQueue, type InvoiceQueuePage, type InvoiceQueueRow } from '../../api';
import { T } from '../text';
import { HeadRow, ListCard, ListRow, ListToolbar, OpenQuestion, PanelHead, SplitCard, Td, Th } from '../ui';

const W = { order: 150, trigger: 220, regime: 140, value: 140, status: 150 };
const PAGE_SIZE = 25;
const META = 'PRODUCT_SALES tax invoices · same INV series as repair invoices, no job number';

export function InvoiceQueuePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useInvoiceQueue({ search: search.trim() || undefined, page, page_size: PAGE_SIZE });
  const cfg = q.data?.config;

  return (
    <>
      <PageHeader title="Product invoices" meta={META} />
      <PageContent className="flex-1 gap-[16px]">
        {cfg?.blocked ? <BlockedConfig data={q.data!} /> : (
          <>
            {cfg && (
              <InlineAlert tone="neutral" title="Invoicing configuration">
                Trigger {cfg.invoice_trigger ?? 'not set'} · product GST rate {cfg.product_gst_rate_configured ? 'configured' : 'not configured'} (set by System admin under Sales policy).
              </InlineAlert>
            )}
            <ListToolbar>
              {q.data && (
                <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">
                  {[`${q.data.counts_by_readiness.READY} ready`, `${q.data.counts_by_readiness.WAITING} waiting`,
                    q.data.counts_by_readiness.BLOCKED ? `${q.data.counts_by_readiness.BLOCKED} blocked` : null].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="h-px min-w-px flex-1" aria-hidden />
              <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search order / customer" label="Search invoice queue" />
            </ListToolbar>
            <ListCard center={q.isError}>
              {q.isError ? (
                <ErrorState title="Couldn't load the invoice queue" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
              ) : (
                <>
                  <HeadRow>
                    <Th w={W.order}>Order</Th><Th grow>Customer</Th><Th w={W.trigger}>Trigger event</Th><Th w={W.regime}>Tax regime</Th>
                    <Th w={W.value} right>Taxable value</Th><Th w={W.status}>Status</Th>
                  </HeadRow>
                  {q.isPending ? <SkeletonRows rows={6} widths={[120, 280, 180, 100, 110, 80]} />
                    : q.data.rows.length === 0 ? (
                      <div className="flex w-full flex-1 justify-center">
                        {search.trim()
                          ? <EmptyState icon={IconSearch} title="No orders match" body={`Nothing matches "${search.trim()}". Search by SO number or customer.`} />
                          : <EmptyState icon={IconFileInvoice} title="Nothing to invoice" body="Orders with un-invoiced value appear here once the invoice trigger event happens." />}
                      </div>
                    ) : q.data.rows.map((r) => <Row key={r.sales_order_id} r={r} trigger={cfg?.invoice_trigger ?? null} />)}
                  {q.data && q.data.total > PAGE_SIZE && (
                    <Pagination className="mt-[16px]" page={page} pages={Math.ceil(q.data.total / PAGE_SIZE)} onChange={setPage} />
                  )}
                </>
              )}
            </ListCard>
          </>
        )}
      </PageContent>
    </>
  );
}

function triggerText(r: InvoiceQueueRow, trigger: string | null) {
  if (r.readiness === 'BLOCKED' && r.blocked_reason) return r.blocked_reason;
  const at = r.trigger_event_at ? formatDayMonth(r.trigger_event_at.slice(0, 10)) : '';
  switch (r.trigger_event_kind) {
    case 'DISPATCHED': return `${r.trigger_event_ref ?? 'Outward'} dispatched ${at}`.trim();
    case 'DELIVERED': return `${r.trigger_event_ref ?? 'Outward'} delivered ${at}`.trim();
    case 'ADVANCE_CONFIRMED': return `Advance confirmed ${at}`.trim();
    default:
      return trigger === 'DELIVERY' ? 'Not delivered yet' : trigger === 'ADVANCE' ? 'Advance not confirmed yet' : 'Not dispatched yet';
  }
}

function Row({ r, trigger }: { r: InvoiceQueueRow; trigger: string | null }) {
  const text = triggerText(r, trigger);
  return (
    <ListRow to={`/f/invoices/preview/${r.sales_order_id}`} state={{ row: r }}>
      <Td w={W.order}><span className={T.id}>{r.sales_order_number}</span></Td>
      <Td grow><span className={T.strong}>{r.customer_name}</span></Td>
      <Td w={W.trigger}><span className={r.readiness === 'BLOCKED' ? 'truncate whitespace-nowrap text-[14px] leading-[20px] text-st-blocked-fg' : T.text} title={text}>{text}</span></Td>
      <Td w={W.regime}><span className={T.text}>{r.tax_regime ? enumLabel(r.tax_regime) : '—'}</span></Td>
      <Td w={W.value} right><span className={T.numStrong}>{formatPaise(r.readiness === 'READY' ? r.invoiceable_taxable_paise : r.uninvoiced_taxable_paise)}</span></Td>
      <Td w={W.status}><StatusPill domain="invoiceReadiness" value={r.readiness} /></Td>
    </ListRow>
  );
}

function BlockedConfig({ data }: { data: InvoiceQueuePage }) {
  const { companyCode } = useAuth();
  const c = data.config;
  const triggerOk = !!c.invoice_trigger && c.invoice_trigger !== 'MILESTONE';
  const missing = [!triggerOk && 'an invoice trigger (ADVANCE / DISPATCH / DELIVERY)', !c.product_gst_rate_configured && 'a product GST rate'].filter(Boolean);
  const why = c.invoice_trigger === 'MILESTONE'
    ? 'The invoice trigger is MILESTONE, which has no milestone schedule (not modelled).'
    : `${missing.length === 2 ? 'Neither is set.' : `Missing: ${missing.join(' and ')}.`}`;
  return (
    <>
      <InlineAlert tone="blocked" icon={IconAlertTriangle} title={`Product invoicing is blocked${companyCode ? ` for ${companyCode}` : ''}`}>
        Both are needed: an invoice trigger (ADVANCE / DISPATCH / DELIVERY) and a product GST rate. {why} System admin sets them under Sales policy.
      </InlineAlert>
      <SplitCard className="w-full">
        <PanelHead>What's missing</PanelHead>
        <Missing label="Invoice trigger" ok={triggerOk} value={c.invoice_trigger} />
        <Missing label="Product GST rate" ok={c.product_gst_rate_configured} value={c.product_gst_rate_configured ? 'CONFIGURED' : null} />
        <OpenQuestion code="G12">invoice trigger (11C-07) and product GST rate (P-12) are CLIENT-UNCONFIRMED.</OpenQuestion>
      </SplitCard>
      <ListCard center>
        <EmptyState icon={IconFileInvoice} title="Nothing can be invoiced yet" body="Orders appear here once the company invoice trigger and product GST rate are configured." />
      </ListCard>
    </>
  );
}

function Missing({ label, ok, value }: { label: string; ok: boolean; value: string | null }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[12px] bg-subtle px-[14px] py-[10px]">
      <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      {ok ? <Badge tone="success" label={value ?? 'SET'} /> : <Badge tone="blocked" label={value ? `${value} · BLOCKED` : 'BLOCKED'} />}
    </div>
  );
}
