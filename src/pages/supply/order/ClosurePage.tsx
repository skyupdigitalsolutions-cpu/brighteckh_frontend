// PO4 · Closure review (Purchase, /p/supply/orders/:id/close) — policy unset BLOCKED 244:49443, checks FAILED 244:49754,
// passed (example policy) 244:50057, CLOSED result 244:50364.
// Split gap 20: "Closure review" card (flex; H3 + order status badge; check rows bg-subtle r12 px-14 py-10 gap 10: 16px
// check / x / alert · title 14/20 Medium over detail 12/16 secondary · PASS / FAIL / BLOCKED badge) + "Close order" card (420;
// KV box, spacer, gate strip + full-width primary Close order; CLOSED: lock note "Closed orders are read-only.").
// The checks are a PREVIEW computed from GET /sales-orders/:id (POD-delivered = invoiced = ordered per line, a live invoice,
// payment when policy requires it). The server decides at POST /sales-orders/:id/close {closure_reason} and its refusal is
// shown verbatim. requires_full_payment_for_closure null (GET /sales-config) = 11C-09 CLIENT-UNCONFIRMED → payment check
// BLOCKED and Close disabled (never faked). A CLOSED order shows the server's closure review flags instead of the preview.
// API over Figma: closure_reason is required by the API (not drawn) → a Reason field above the button.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconAlertTriangle, IconCheck, IconFileOff, IconX } from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { enumLabel, formatDateTime, formatPaise, formatQty } from '../../../lib/format';
import type { Tone } from '../../../lib/tones';
import {
  Button, EmptyState, ErrorState, FormErrors, Ic, InlineAlert, PageContent, PageHeader, StateCard, StatusPill, cx, errorBody,
} from '../../../ui/desktop';
import { supplyApi, useOrder, useSalesConfig, useSupplyMutation, type OrderDetail } from '../api';
import { SupplyTabs } from '../ui';
import { closurePreview, commonUom, isOpenOrder, liveInvoices, sumQty, useOrderContext, type CheckState, type ClosureCheck } from './data';
import { Bar, Card, CompactInput, H3, KVBox, LockedNote, Muted, OpenQuestion, ReasonStrip, StateBadge } from './ui';

const STATE_TONE: Record<CheckState, Tone> = { PASS: 'success', FAIL: 'blocked', BLOCKED: 'neutral' };

export function ClosurePage() {
  const { id = '' } = useParams();
  const q = useOrder(id);
  if (q.isPending) {
    return (
      <>
        <PageHeader title="Closure review" meta=" " />
        <PageContent className="min-h-[808px]">
          <SupplyTabs />
          <div role="status" aria-label="Loading" className="flex min-h-[640px] w-full flex-1 gap-[20px]">
            <Card pad={20} className="min-w-px flex-1"><Bar w={160} /><Bar w="70%" /><Bar w="65%" /><Bar w="60%" /></Card>
            <Card pad={20} className="w-[420px] shrink-0"><Bar w={120} /><Bar w={300} /></Card>
          </div>
        </PageContent>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        <PageHeader title="Closure review" />
        <PageContent>
          <SupplyTabs />
          <StateCard>
            {apiStatus(q.error) === 404
              ? <EmptyState icon={IconFileOff} title="Order not found" body={<Link className="underline" to="/p/supply/orders">Back to orders</Link>} />
              : <ErrorState title="Couldn't load the order" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <Closure order={q.data} />;
}

function Closure({ order }: { order: OrderDetail }) {
  const ctx = useOrderContext(order);
  const config = useSalesConfig();
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [closedNow, setClosedNow] = useState(false);
  const close = useSupplyMutation((r: string) => supplyApi.closeOrder(order.id, r));

  const closed = order.status === 'CLOSED';
  const policy = config.data?.policy?.requires_full_payment_for_closure ?? null;
  const policyBlocked = !config.data || config.data.blocked.order_closure || policy === null;
  const checks: ClosureCheck[] = closed ? serverChecks(order) : closurePreview(order, config.data);
  const failed = checks.filter((c) => c.state === 'FAIL').length;
  const ready = !closed && isOpenOrder(order) && !policyBlocked && failed === 0 && checks.every((c) => c.state === 'PASS');

  const lines = order.lines;
  const uom = commonUom(lines);
  const q = (n: number) => formatQty(String(n), uom);
  const live = liveInvoices(order);
  const total = live.reduce((t, i) => t + BigInt(i.total_paise), 0n);
  const paid = live.reduce((t, i) => t + BigInt(i.amount_paid_paise), 0n);

  const blockReason = !isOpenOrder(order) && !closed
    ? `A ${enumLabel(order.status)} order can't be closed`
    : config.isPending ? 'Loading the closure policy…'
      : policyBlocked ? 'Closure blocked — payment-before-closure policy not set (11C-09)'
        : failed > 0 ? `${failed} ${failed === 1 ? 'check' : 'checks'} failed — fix them, then review again` : null;

  const submit = () => {
    setTried(true);
    if (!reason.trim() || !ready) return;
    close.mutate(reason.trim(), { onSuccess: () => { setClosedNow(true); setReason(''); setTried(false); } });
  };

  return (
    <>
      <PageHeader
        title={order.sales_order_number ?? 'Draft order'}
        meta={`${ctx.customerName ?? '…'} · ${enumLabel(order.status)} · closure review`}
        action={<Link to={`/p/supply/orders/${order.id}`} className="text-[14px] font-medium leading-[20px] text-fg underline">Back to order</Link>}
      />
      <PageContent className="min-h-[808px]">
        <SupplyTabs />
        {closedNow && closed && <InlineAlert tone="success" title="Order closed">{order.sales_order_number} is closed and read-only.</InlineAlert>}
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <Card pad={20} className="min-w-px flex-1">
            <H3 right={<StatusPill domain="supplyOrder" value={order.status} />}>Closure review</H3>
            {!closed && <Muted small>Preview from this order’s quantities and invoices. The server re-checks everything when you close.</Muted>}
            {checks.map((c) => <CheckRow key={c.key} c={c} />)}
            {!closed && policy === null && config.data && (
              <OpenQuestion>G15 · CLIENT-UNCONFIRMED — payment-before-closure policy is unset, so closure is blocked for every order until System admin sets it (11C-09).</OpenQuestion>
            )}
            {config.isError && <FormErrors error={config.error} title="Couldn't load the closure policy" />}
          </Card>

          <Card pad={20} className="w-[420px] shrink-0">
            <H3>Close order</H3>
            <KVBox rows={[
              { label: 'Ordered', value: `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}${uom ? ` · ${q(sumQty(lines, 'accepted_qty'))}` : ''}` },
              { label: 'Delivered (POD)', value: uom ? q(sumQty(lines, 'delivered_qty')) : `${lines.filter((l) => Number(l.delivered_qty) >= Number(l.accepted_qty)).length} of ${lines.length} lines` },
              { label: 'Invoiced', value: uom ? q(sumQty(lines, 'invoiced_qty')) : `${lines.filter((l) => Number(l.invoiced_qty) >= Number(l.accepted_qty)).length} of ${lines.length} lines` },
              { label: 'Live invoice', value: live.length ? live.map((i) => i.invoice_number).join(', ') : 'None' },
              ...(live.length ? [{ label: 'Payment received', value: `${formatPaise(paid.toString())} of ${formatPaise(total.toString())}` }] : []),
              ...(closed ? [{ label: 'Closed', value: formatDateTime(order.closed_at) }] : []),
              ...(closed && order.closure_review ? [{ label: 'Closure reason', value: order.closure_review.closure_reason }] : []),
            ]} />
            <div className="min-h-px w-px flex-1" />
            {closed ? (
              <LockedNote>Closed orders are read-only.</LockedNote>
            ) : (
              <>
                {ready && <CompactInput label="Closure reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Delivered, invoiced and paid in full" error={tried && !reason.trim() ? 'Give the closure reason.' : null} />}
                <FormErrors error={close.error} title="The server refused to close the order" />
                {blockReason ? <ReasonStrip>{blockReason}</ReasonStrip> : <ReasonStrip tone="success">All checks passed (preview)</ReasonStrip>}
                <Button kind="primary" block disabled={!ready} busy={close.isPending} onClick={submit}>Close order</Button>
              </>
            )}
          </Card>
        </div>
      </PageContent>
    </>
  );
}

/** A CLOSED order: the server's closure review flags (no preview). */
function serverChecks(o: OrderDetail): ClosureCheck[] {
  const r = o.closure_review;
  const live = liveInvoices(o);
  const yes = (b: boolean | undefined): CheckState => (b ? 'PASS' : 'FAIL');
  return [
    { key: 'pod', title: 'POD-delivered = ordered', state: yes(r?.delivery_verified), detail: r ? 'Verified at close' : 'No closure review on record' },
    { key: 'inv', title: 'Invoiced = ordered', state: yes(r?.billing_verified), detail: r ? 'Verified at close' : '—' },
    { key: 'live', title: 'Live invoice exists', state: live.length ? 'PASS' : 'FAIL', detail: live.map((i) => i.invoice_number).join(', ') || 'None' },
    {
      key: 'pay', title: r?.payment_required ? 'Payment complete' : 'Payment complete (not required)',
      state: r?.payment_required ? yes(r.payment_verified) : 'PASS', detail: r?.payment_required ? (r.payment_verified ? 'Paid in full' : 'Not verified') : 'Policy did not require it',
    },
  ];
}

function CheckRow({ c }: { c: ClosureCheck }) {
  const icon = c.state === 'PASS' ? IconCheck : c.state === 'FAIL' ? IconX : IconAlertTriangle;
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[12px] bg-subtle px-[14px] py-[10px]">
      <Ic icon={icon} size={16} className={cx('shrink-0', c.state === 'PASS' ? 'text-fg' : c.state === 'FAIL' ? 'text-danger' : 'text-warn-fg')} />
      <div className="flex min-w-px flex-1 flex-col">
        <p className="text-[14px] font-medium leading-[20px] text-fg">{c.title}</p>
        <p className="text-[12px] leading-[16px] text-fg-2">{c.detail}</p>
      </div>
      <StateBadge tone={STATE_TONE[c.state]} label={c.state} />
    </div>
  );
}
