// Sales order detail — one page, two layouts, two roles.
// DRAFT layout (number not yet assigned):
//   Sales  SOS1 244:51773 "Draft order created (from quote)" · Purchase PO1 240:48417 verify BLOCKED, 240:48961 evidence PENDING.
//   Optional success alert, then Split gap 20: Order card (flex, glass-strong r24 p24 gap14: H2 "Draft order" + status badge,
//   lock note, table header r20 px16 py12 — Item flex · Accepted qty 110 → · Unit price 120 → · Line total 130 →, rows px16
//   py10 border-b, summary KV box) + Right 460 gap 20: "Authorisation evidence" card (H2 + Attach secondary/upload; empty
//   text or Evidence · Status table) and "Verify order" card (flex; Sales: text only; Purchase: 12/16 text, spacer, Gated
//   action "Attach authorisation evidence first" / "Evidence attached — verify it against the quote" + Verify order,
//   ghost Cancel draft).
// PIPELINE layout (verified onwards):
//   Sales  SOS1 244:52008 · Purchase PO2 243:46759 (terms BLOCKED), 243:47468 (ready to reserve), 243:49148 (reserved +
//   sourcing), PO3 244:48337 (change request PENDING).
//   Header card (r24 p18; meta gap 32: order id + status · Customer · Value (pre-tax) · Authorisation · Payment terms ·
//   Advance), Body gap 16: Lines card (flex, p20 gap12: H3 "Lines · quantity pipeline", per-line pipeline, G27 note, order
//   facts) + Side 420 gap 16 (cards p18 gap12, H3 15/20) and a bottom action row (secondary, flex-1, gap 10).
//   Sales side: Authorisation evidence + Change requests (read) + "Change request". Never supplier price / sourcing / POs.
//   Purchase side: Payment terms (Record terms) or the blocked "Reserve & source" card, Reservations, Sourcing, Supplier POs
//   (All →), Change requests (Decide), actions Change request · Create outward · Close order.
// Gates: verify needs a PENDING authorisation; reserve / source need recorded terms + Finance-confirmed advance (11B-02,
//   reason shown in the Reservations card); line Reserve / Release buttons are hidden for Sales.
// Data: GET /sales-orders/:id (+ /sales-config; Purchase also /sourcing-authorisations, /purchase-orders); customer name via
//   GET /sales-supply/orders?search=, item codes via GET /masters/items/:id.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  IconCheck, IconFileOff, IconFilePlus, IconReceipt, IconShoppingCart, IconStack2, IconTruck, IconUpload, IconX,
} from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { formatDate, formatDateTime, formatPaise, formatQty } from '../../../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, FormErrors, GatedAction, Ic, InlineAlert, PageContent, PageHeader, StateCard, StatusPill, errorBody,
} from '../../../ui/desktop';
import {
  supplyApi, useOrder, useSalesConfig, useSourcingAuthorisations, useSupplierPos, useSupplyMutation,
  type ChangeRequest, type OrderDetail, type OrderLine, type SourcingAuthorisation,
} from '../api';
import { SupplyTabs } from '../ui';
import {
  advanceState, advanceSummary, closurePreview, isOpenOrder, lineLabel, liveInvoices, num, orderTotalPaise,
  quoteRef, supplyGate, useItemsByIds, useOrderContext, type Item, type Role,
} from './data';
import { AttachAuthorisationDrawer, CancelDraftDrawer, ChangeRequestDrawer } from './SharedDrawers';
import { DecideChangeDrawer, PaymentTermsDrawer, ReleaseDrawer, ReserveDrawer, SourcingDrawer, VerifyDrawer } from './PurchaseDrawers';
import {
  Bar, Card, Dash, H2, H3, KVBox, LockedNote, MetaItem, MiniHead, MiniRow, Muted, OpenQuestion, OrderFacts, PipelineLine,
  ReasonStrip, StateBadge, TId, TNum, TStrong, TText, Td, Th,
} from './ui';

type Banner = { tone: 'success' | 'progress'; title: string; body: string } | null;
type DrawerState =
  | { kind: 'attach' } | { kind: 'cancel' } | { kind: 'change' } | { kind: 'verify' } | { kind: 'terms' }
  | { kind: 'reserve'; line: OrderLine } | { kind: 'release'; line: OrderLine } | { kind: 'source'; line: OrderLine; qty: number }
  | { kind: 'decide'; request: ChangeRequest } | null;

export function OrderDetailPage({ role }: { role: Role }) {
  const { id = '' } = useParams();
  const q = useOrder(id);
  const list = role === 'PURCHASE' ? '/p/supply/orders' : '/s/orders';

  if (q.isPending) return <DetailSkeleton role={role} />;
  if (q.isError) {
    const notFound = apiStatus(q.error) === 404;
    return (
      <>
        <PageHeader title="Sales order" />
        <PageContent>
          {role === 'PURCHASE' && <SupplyTabs />}
          <StateCard>
            {notFound
              ? <EmptyState icon={IconFileOff} title="Order not found" body={<>It may belong to another company. <Link className="underline" to={list}>Back to orders</Link></>} />
              : <ErrorState title="Couldn't load the order" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <OrderView order={q.data} role={role} />;
}

function OrderView({ order, role }: { order: OrderDetail; role: Role }) {
  const purchase = role === 'PURCHASE';
  const loc = useLocation();
  const nav = useNavigate();
  const ctx = useOrderContext(order);
  const items = useItemsByIds(order.lines.map((l) => l.item_id));
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [banner, setBanner] = useState<Banner>(() => {
    if (!(loc.state as { created?: boolean } | null)?.created) return null;
    return { tone: 'success', title: 'Draft order created', body: 'Accepted lines and prices copied from the quote. Attach the customer PO next.' };
  });
  useEffect(() => {
    if ((loc.state as { created?: boolean } | null)?.created) nav(loc.pathname, { replace: true, state: null });
  }, [loc.pathname, loc.state, nav]);

  const done = (title: string, body: string) => { setDrawer(null); setBanner({ tone: 'success', title, body }); };
  const draftLike = !order.sales_order_number;
  const customer = ctx.customerName ?? '…';
  const quote = quoteRef(ctx.quoteNumber, ctx.revisionNo);
  const subtitle = `${order.sales_order_number ?? 'Draft order'} · ${customer}`;
  const title = draftLike ? `Draft order · ${customer}` : order.sales_order_number!;
  const meta = draftLike
    ? `From ${ctx.quoteNumber ?? '…'}${ctx.revisionNo != null ? ` revision ${ctx.revisionNo}` : ''} · ${order.status === 'CANCELLED' ? `cancelled ${formatDateTime(order.cancelled_at)}` : 'number assigned at verify'}`
    : `${customer} · from ${quote} · verified ${formatDateTime(order.verified_at)}`;

  return (
    <>
      <PageHeader title={title} meta={meta} />
      <PageContent className="min-h-[808px]">
        {purchase && <SupplyTabs />}
        {banner && <InlineAlert tone={banner.tone} title={banner.title}>{banner.body}</InlineAlert>}
        {draftLike
          ? <DraftLayout order={order} role={role} items={items} customer={customer} quote={quote} open={setDrawer} />
          : <PipelineLayout order={order} role={role} items={items} customer={customer} open={setDrawer} onBanner={setBanner} />}
      </PageContent>

      <AttachAuthorisationDrawer open={drawer?.kind === 'attach'} onClose={() => setDrawer(null)} order={order} subtitle={subtitle} onDone={done} />
      <CancelDraftDrawer open={drawer?.kind === 'cancel'} onClose={() => setDrawer(null)} order={order} subtitle={subtitle} onDone={done} />
      <ChangeRequestDrawer open={drawer?.kind === 'change'} onClose={() => setDrawer(null)} order={order} items={items} subtitle={subtitle} role={role} onDone={(t, b) => { setDrawer(null); setBanner({ tone: 'progress', title: t, body: b }); }} />
      {purchase && (
        <>
          <VerifyDrawer
            open={drawer?.kind === 'verify'} onClose={() => setDrawer(null)} order={order} customer={ctx.customerName} revisionNo={ctx.revisionNo}
            subtitle={`Draft order · ${customer} · ${formatPaise(orderTotalPaise(order.lines))}`} onDone={done}
          />
          <PaymentTermsDrawer open={drawer?.kind === 'terms'} onClose={() => setDrawer(null)} order={order} subtitle={`${order.sales_order_number ?? ''} · ${formatPaise(orderTotalPaise(order.lines))} pre-tax`} onDone={done} />
          <ReserveDrawer
            open={drawer?.kind === 'reserve'} onClose={() => setDrawer(null)} order={order} items={items}
            line={drawer?.kind === 'reserve' ? drawer.line : null} onDone={done}
            onSource={(line, qty) => setDrawer({ kind: 'source', line, qty })}
          />
          <ReleaseDrawer
            open={drawer?.kind === 'release'} onClose={() => setDrawer(null)} order={order} items={items}
            line={drawer?.kind === 'release' ? drawer.line : null}
            reservations={drawer?.kind === 'release' ? confirmedFor(order, drawer.line) : []}
            onDone={done}
          />
          <SourcingDrawer
            open={drawer?.kind === 'source'} onClose={() => setDrawer(null)} order={order} items={items}
            line={drawer?.kind === 'source' ? drawer.line : null} initialQty={drawer?.kind === 'source' ? drawer.qty : 0} onDone={done}
          />
          <DecideChangeDrawer
            open={drawer?.kind === 'decide'} onClose={() => setDrawer(null)} order={order} items={items}
            request={drawer?.kind === 'decide' ? drawer.request : null} onDone={done}
          />
        </>
      )}
    </>
  );
}

const confirmedFor = (o: OrderDetail, l: OrderLine) =>
  o.reservations.filter((r) => r.sales_order_line_id === l.sales_order_line_id && r.state === 'CONFIRMED');

// ================================================================== DRAFT layout
const DCOL = { qty: 110, price: 120, total: 130 };

function DraftLayout({ order, role, items, customer, quote, open }: {
  order: OrderDetail; role: Role; items: Record<string, Item>; customer: string; quote: string; open: (d: DrawerState) => void;
}) {
  const purchase = role === 'PURCHASE';
  const isDraft = order.status === 'DRAFT';
  const pending = order.authorisations.filter((a) => a.verified_status === 'PENDING');
  return (
    <div className="flex min-h-[720px] w-full flex-1 items-stretch gap-[20px]">
      <Card pad={24} className="min-w-px flex-1">
        <H2 right={<StatusPill domain="supplyOrder" value={order.status} />}>Draft order</H2>
        <LockedNote>Lines and prices are snapshotted from the accepted revision ({quote.replace(' · ', ' ')}). Changes go through a change request.</LockedNote>
        <div className="flex w-full flex-col">
          <MiniHead size="draft">
            <Th grow>Item</Th><Th w={DCOL.qty} right>Accepted qty</Th><Th w={DCOL.price} right>Unit price</Th><Th w={DCOL.total} right>Line total</Th>
          </MiniHead>
          {order.lines.map((l) => (
            <MiniRow key={l.sales_order_line_id ?? l.line_no} size="draft">
              <Td grow><TStrong>{lineLabel(l, items)}</TStrong></Td>
              <Td w={DCOL.qty} right><TNum>{formatQty(l.accepted_qty, l.uom)}</TNum></Td>
              <Td w={DCOL.price} right><TNum strong>{formatPaise(l.unit_price_paise)}</TNum></Td>
              <Td w={DCOL.total} right><TNum strong>{formatPaise(lineTotalOf(l))}</TNum></Td>
            </MiniRow>
          ))}
        </div>
        <KVBox rows={[
          { label: 'Value (pre-tax)', value: formatPaise(orderTotalPaise(order.lines)), mono: true },
          { label: 'Customer', value: customer },
          ...(order.customer_order_reference ? [{ label: 'Customer order reference', value: order.customer_order_reference }] : []),
          ...(order.delivery_terms_snapshot ? [{ label: 'Delivery', value: order.delivery_terms_snapshot }] : []),
          ...(order.payment_terms_snapshot ? [{ label: 'Payment terms (quote)', value: order.payment_terms_snapshot }] : []),
        ]} />
      </Card>

      <div className="flex w-[460px] shrink-0 flex-col gap-[20px]">
        <Card pad={24} className="w-full">
          <H2 right={isDraft ? <Button kind="secondary" icon={<Ic icon={IconUpload} size={18} />} onClick={() => open({ kind: 'attach' })}>Attach</Button> : undefined}>
            Authorisation evidence
          </H2>
          {order.authorisations.length === 0
            ? <Muted>Nothing attached. Attach the customer PO, order confirmation or authorising email.</Muted>
            : <AuthTable order={order} size="draft" />}
        </Card>
        <Card pad={24} className="w-full flex-1">
          <H2>{isDraft ? 'Verify order' : 'Cancelled'}</H2>
          {!isDraft ? (
            <Muted>This draft was cancelled on {formatDateTime(order.cancelled_at)}. Draft a new order from the quote if the customer still wants it.</Muted>
          ) : purchase ? (
            <>
              <Muted small>Purchase checks the evidence against the quote and customer. The order number is assigned at verify.</Muted>
              <div className="min-h-px w-px flex-1" />
              <GatedAction
                ready={pending.length > 0}
                reason="Attach authorisation evidence first"
                readyNote="Evidence attached — verify it against the quote"
                primaryLabel="Verify order"
                onPrimary={() => open({ kind: 'verify' })}
              />
              <Button kind="ghost" block icon={<Ic icon={IconX} size={18} />} onClick={() => open({ kind: 'cancel' })}>Cancel draft</Button>
            </>
          ) : (
            <>
              <Muted>Purchase verifies the evidence and numbers the order. You’ll see the SO number here after verify.</Muted>
              <div className="min-h-px w-px flex-1" />
              <Button kind="ghost" block icon={<Ic icon={IconX} size={18} />} onClick={() => open({ kind: 'cancel' })}>Cancel draft</Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
const lineTotalOf = (l: OrderLine) => orderTotalPaise([l]);

function AuthTable({ order, size }: { order: OrderDetail; size: 'side' | 'draft' }) {
  const statusW = size === 'side' ? 110 : 120;
  return (
    <div className="flex w-full flex-col">
      <MiniHead size={size}><Th grow>Evidence</Th><Th w={statusW}>Status</Th></MiniHead>
      {order.authorisations.map((a) => (
        <MiniRow key={a.id} size={size}>
          <Td grow>
            <TStrong>
              {a.source_kind.replace(/_/g, ' ')}
              {a.source_reference ? ` · ${a.source_reference}` : a.customer_email_sender ? ` · ${a.customer_email_sender}` : ''}
              {size === 'draft' ? ` · ${formatDate(a.received_at).slice(0, 6)}` : ''}
            </TStrong>
          </Td>
          <Td w={statusW}><StatusPill domain="supplyAuthorisation" value={a.verified_status} /></Td>
        </MiniRow>
      ))}
    </div>
  );
}

// ================================================================== PIPELINE layout
function PipelineLayout({ order, role, items, customer, open, onBanner }: {
  order: OrderDetail; role: Role; items: Record<string, Item>; customer: string; open: (d: DrawerState) => void; onBanner: (b: Banner) => void;
}) {
  const purchase = role === 'PURCHASE';
  const nav = useNavigate();
  const config = useSalesConfig();
  const live = isOpenOrder(order);
  const gate = supplyGate(order);
  const adv = advanceState(order.payment_terms);
  const verifiedAuth = order.authorisations.some((a) => a.verified_status === 'VERIFIED');
  const pendingAuth = order.authorisations.some((a) => a.verified_status === 'PENDING');
  const preview = closurePreview(order, config.data);
  const outwards = order.outward_batches.filter((b) => b.status !== 'CANCELLED');
  const openCr = order.change_requests.filter((c) => c.decision === 'PENDING');
  const invoices = liveInvoices(order);
  const hasConfirmed = order.reservations.some((r) => r.state === 'CONFIRMED');

  const lineAction = (l: OrderLine): ReactNode => {
    if (!purchase || !live || !gate.ok) return undefined;
    const pending = num(l.reservation_pending_qty);
    const confirmed = confirmedFor(order, l);
    return (
      <>
        {confirmed.length > 0 && <Button kind="ghost" icon={<Ic icon={IconX} size={18} />} onClick={() => open({ kind: 'release', line: l })}>Release</Button>}
        {pending > 0 && <Button kind="ghost" icon={<Ic icon={IconStack2} size={18} />} onClick={() => open({ kind: 'reserve', line: l })}>Reserve</Button>}
      </>
    );
  };

  return (
    <>
      <div className="glass-strong flex w-full flex-col items-start overflow-clip rounded-[24px] p-[18px]">
        <div className="flex w-full flex-wrap items-center gap-x-[32px] gap-y-[12px] overflow-clip">
          <div className="flex shrink-0 flex-col items-start gap-[4px] overflow-clip">
            <TId>{order.sales_order_number}</TId>
            <StatusPill domain="supplyOrder" value={order.status} />
          </div>
          <MetaItem label="Customer"><TStrong>{customer}</TStrong></MetaItem>
          <MetaItem label="Value (pre-tax)"><TNum strong>{formatPaise(orderTotalPaise(order.lines))}</TNum></MetaItem>
          <MetaItem label="Authorisation">
            {verifiedAuth ? <StatusPill domain="supplyAuthorisation" value="VERIFIED" /> : pendingAuth ? <StatusPill domain="supplyAuthorisation" value="PENDING" /> : <Dash />}
          </MetaItem>
          <MetaItem label="Payment terms">
            {order.payment_terms ? <TStrong>{advanceSummary(order.payment_terms)}</TStrong> : <StateBadge tone="blocked" label="NOT RECORDED" />}
          </MetaItem>
          <MetaItem label="Advance">
            {adv ? <StateBadge tone={adv === 'CONFIRMED' ? 'success' : 'neutral'} label={adv} /> : <Dash />}
          </MetaItem>
        </div>
      </div>

      <div className="flex min-h-[710px] w-full flex-1 items-stretch gap-[16px]">
        <Card pad={20} className="min-w-px flex-1">
          <H3>Lines · quantity pipeline</H3>
          {order.lines.map((l) => (
            <PipelineLine
              key={l.sales_order_line_id ?? l.line_no}
              line={l}
              label={lineLabel(l, items)}
              price={formatPaise(l.unit_price_paise)}
              total={formatPaise(lineTotalOf(l))}
              action={lineAction(l)}
            />
          ))}
          <OpenQuestion>G27 · CLIENT-UNCONFIRMED — SO line status enum is not in the API contract — lines show the quantity pipeline only, no line-status badge.</OpenQuestion>
          <OrderFacts facts={[
            { label: 'Outwards', value: outwards.length ? outwards.map((b) => b.outward_number ?? 'DRAFT').join(', ') : 'None yet' },
            { label: 'Change requests', value: order.change_requests.length ? `${openCr.length} open · ${order.change_requests.length} total` : 'None' },
            { label: 'Invoices', value: invoices.length ? invoices.map((i) => i.invoice_number).join(', ') : 'None' },
            { label: 'Closure', value: order.status === 'CLOSED' ? `Closed ${formatDate(order.closed_at)}` : preview.every((c) => c.state === 'PASS') ? 'Ready (preview)' : 'Not ready' },
          ]} />
        </Card>

        <div className="flex w-[420px] shrink-0 flex-col gap-[16px]">
          {!purchase ? (
            <>
              <Card className="w-full">
                <H3 right={live ? <Button kind="secondary" icon={<Ic icon={IconUpload} size={18} />} onClick={() => open({ kind: 'attach' })}>Attach</Button> : undefined}>
                  Authorisation evidence
                </H3>
                {order.authorisations.length === 0 ? <Muted small>Nothing attached.</Muted> : <AuthTable order={order} size="side" />}
              </Card>
              {order.change_requests.length > 0 && <ChangeRequestsCard order={order} items={items} />}
            </>
          ) : (
            <PurchaseSide order={order} items={items} open={open} onBanner={onBanner} />
          )}
          <div className="min-h-px w-full flex-1" />
          {live && (
            <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
              <Button kind="secondary" icon={<Ic icon={IconFilePlus} size={18} />} onClick={() => open({ kind: 'change' })}>Change request</Button>
              {purchase && hasConfirmed && (
                <Button kind="secondary" icon={<Ic icon={IconTruck} size={18} />} onClick={() => nav(`/p/supply/outwards?create=${order.id}`)}>Create outward</Button>
              )}
              {purchase && (
                <Button kind="secondary" icon={<Ic icon={IconCheck} size={18} />} onClick={() => nav(`/p/supply/orders/${order.id}/close`)}>Close order</Button>
              )}
            </div>
          )}
          {purchase && order.status === 'CLOSED' && (
            <Button kind="secondary" block icon={<Ic icon={IconCheck} size={18} />} onClick={() => nav(`/p/supply/orders/${order.id}/close`)}>Closure review</Button>
          )}
        </div>
      </div>
    </>
  );
}

function ChangeRequestsCard({ order, items, onDecide }: { order: OrderDetail; items: Record<string, Item>; onDecide?: (c: ChangeRequest) => void }) {
  const firstPending = order.change_requests.find((c) => c.decision === 'PENDING');
  return (
    <Card className="w-full">
      <H3 right={onDecide && firstPending ? <Button kind="primary" icon={<Ic icon={IconCheck} size={18} />} onClick={() => onDecide(firstPending)}>Decide</Button> : undefined}>
        Change requests
      </H3>
      <div className="flex w-full flex-col">
        <MiniHead><Th w={120}>Kind</Th><Th grow>Change</Th><Th w={100}>Decision</Th></MiniHead>
        {order.change_requests.map((c) => {
          const line = order.lines.find((l) => l.sales_order_line_id === c.sales_order_line_id);
          return (
            <MiniRow key={c.id} onClick={onDecide && c.decision === 'PENDING' ? () => onDecide(c) : undefined}>
              <Td w={120}><Badge tone="neutral" label={c.change_kind.replace(/_/g, ' ')} /></Td>
              <Td grow><span title={c.reason} className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{line ? lineLabel(line, items) : 'Whole order'}</span></Td>
              <Td w={100}><StatusPill domain="supplyChange" value={c.decision} /></Td>
            </MiniRow>
          );
        })}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Purchase side column
function PurchaseSide({ order, items, open, onBanner }: { order: OrderDetail; items: Record<string, Item>; open: (d: DrawerState) => void; onBanner: (b: Banner) => void }) {
  const nav = useNavigate();
  const live = isOpenOrder(order);
  const gate = supplyGate(order);
  const terms = order.payment_terms;
  const adv = advanceState(terms);
  const sourcingQ = useSourcingAuthorisations(order.id);
  const posQ = useSupplierPos(order.id);
  const lineOf = (lineId: string) => order.lines.find((l) => l.sales_order_line_id === lineId);
  const shortName = (lineId: string) => { const l = lineOf(lineId); return l ? (l.description_snapshot ?? lineLabel(l, items)) : '—'; };

  if (!terms) {
    return (
      <>
        <Card className="w-full">
          <H3 right={live ? <Button kind="primary" icon={<Ic icon={IconReceipt} size={18} />} onClick={() => open({ kind: 'terms' })}>Record terms</Button> : undefined}>Payment terms</H3>
          <Muted small>Required before any reservation or sourcing.</Muted>
        </Card>
        <Card className="w-full flex-1">
          <H3>Reserve &amp; source</H3>
          <div className="min-h-px w-px flex-1" />
          <ReasonStrip>Record payment terms first</ReasonStrip>
          <Button kind="primary" block disabled>Reserve stock</Button>
        </Card>
      </>
    );
  }

  return (
    <>
      {adv === 'PENDING' && (
        <Card className="w-full">
          <H3>Payment terms</H3>
          <p className="w-full text-[14px] leading-[20px] text-fg">
            {terms.advance_kind.replace(/_/g, ' ')} · {terms.required_amount_paise ? formatPaise(terms.required_amount_paise) : '—'}
            {terms.required_percent ? ` · ${formatQty(terms.required_percent)}%` : ''}
          </p>
          <StateBadge tone="neutral" label="ADVANCE PENDING · FINANCE" />
        </Card>
      )}

      <Card className="w-full">
        <H3>Reservations</H3>
        {!gate.ok && live && <ReasonStrip>{gate.reason}</ReasonStrip>}
        {order.reservations.length === 0 ? (
          <Muted small>None yet. Reserve from MAIN STORE allocatable stock per line.</Muted>
        ) : (
          <div className="flex w-full flex-col">
            <MiniHead><Th grow>Item</Th><Th w={60} right>Qty</Th><Th w={110}>State</Th></MiniHead>
            {order.reservations.map((r) => {
              const l = lineOf(r.sales_order_line_id);
              return (
                <MiniRow key={r.id}>
                  <Td grow><span title={r.error_message ?? undefined} className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{shortName(r.sales_order_line_id)}</span></Td>
                  <Td w={60} right><TNum>{formatQty(r.requested_qty, l?.uom)}</TNum></Td>
                  <Td w={110}><StatusPill domain="supplyReservation" value={r.state} /></Td>
                </MiniRow>
              );
            })}
          </div>
        )}
        {live && gate.ok && order.lines.some((l) => num(l.reservation_pending_qty) > 0) && (
          <Muted small>Short on stock? Use Reserve on a line, then authorise sourcing for the shortfall.</Muted>
        )}
      </Card>

      {sourcingQ.isError ? (
        <Card className="w-full"><H3>Sourcing</H3><FormErrors error={sourcingQ.error} title="Couldn't load sourcing" /></Card>
      ) : (sourcingQ.data?.length ?? 0) > 0 && (
        <SourcingCard order={order} rows={sourcingQ.data!} shortName={shortName} uomOf={(id) => lineOf(id)?.uom ?? null} onBanner={onBanner} />
      )}

      <Card className="w-full">
        <H3 right={<Button kind="ghost" icon={<Ic icon={IconStack2} size={18} />} onClick={() => nav(`/p/supply/orders/${order.id}/supplier-pos`)}>All</Button>}>Supplier POs</H3>
        {posQ.isPending ? <Bar w={200} /> : posQ.isError ? <FormErrors error={posQ.error} title="Couldn't load supplier POs" /> : posQ.data.length === 0 ? (
          <Muted small>No supplier POs yet. Authorise sourcing for a shortfall to raise one.</Muted>
        ) : (
          <div className="flex w-full flex-col">
            <MiniHead><Th w={100}>PO</Th><Th grow>Supplier</Th><Th w={110}>Status</Th></MiniHead>
            {posQ.data.slice(0, 4).map((p) => (
              <MiniRow key={p.id}>
                <Td w={100}><TId>{p.po_number}</TId></Td>
                <Td grow><TStrong>{p.supplier_name_snapshot} · {p.purchase_purpose.replace(/_/g, ' ')}</TStrong></Td>
                <Td w={110}><StatusPill domain="purchaseOrder" value={p.po_status} /></Td>
              </MiniRow>
            ))}
          </div>
        )}
      </Card>

      {order.change_requests.length > 0 && (
        <ChangeRequestsCard order={order} items={items} onDecide={live ? (c) => open({ kind: 'decide', request: c }) : undefined} />
      )}
    </>
  );
}

/** Purchase-only: supplier name + unit price (never on a Sales view). Cancel / raise PO per APPROVED authorisation. */
function SourcingCard({ order, rows, shortName, uomOf, onBanner }: {
  order: OrderDetail; rows: SourcingAuthorisation[]; shortName: (id: string) => string; uomOf: (id: string) => string | null; onBanner: (b: Banner) => void;
}) {
  const cancel = useSupplyMutation((id: string) => supplyApi.cancelSourcing(id));
  const raise = useSupplyMutation((id: string) => supplyApi.raiseSalesOrderPo(order.id, { sourcing_authorisation_ids: [id] }));
  return (
    <Card className="w-full">
      <H3>Sourcing</H3>
      <div className="flex w-full flex-col">
        {rows.map((s) => (
          <div key={s.id} className="flex w-full flex-col gap-[6px] border-b border-line px-[14px] py-[9px]">
            <div className="flex w-full items-center gap-[10px]">
              <div className="flex min-w-px flex-1 flex-col">
                <TStrong>{shortName(s.sales_order_line_id)} · L{s.selected_rank} · {s.supplier_name_snapshot}</TStrong>
                <TText>{formatQty(s.quantity, uomOf(s.sales_order_line_id))} × ₹{s.supplier_unit_price}</TText>
              </div>
              <Badge tone={s.authorisation_status === 'APPROVED' ? 'success' : 'blocked'} label={s.authorisation_status} />
            </div>
            {s.authorisation_status === 'APPROVED' && isOpenOrder(order) && (
              <div className="flex items-center gap-[8px]">
                <Button kind="ghost" icon={<Ic icon={IconShoppingCart} size={18} />} busy={raise.isPending && raise.variables === s.id}
                  onClick={() => raise.mutate(s.id, { onSuccess: (po) => onBanner({ tone: 'success', title: `${po.po_number} raised`, body: `SALES ORDER supplier PO for ${s.supplier_name_snapshot}.` }) })}>
                  Raise PO
                </Button>
                <Button kind="ghost" icon={<Ic icon={IconX} size={18} />} busy={cancel.isPending && cancel.variables === s.id}
                  onClick={() => cancel.mutate(s.id, { onSuccess: () => onBanner({ tone: 'success', title: 'Sourcing cancelled', body: `${s.supplier_name_snapshot} · ${formatQty(s.quantity)} returned to reservation pending.` }) })}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <FormErrors error={raise.error} title="The supplier PO wasn't raised" />
      <FormErrors error={cancel.error} title="The sourcing authorisation wasn't cancelled" />
    </Card>
  );
}

// ------------------------------------------------------------------ loading
function DetailSkeleton({ role }: { role: Role }) {
  return (
    <>
      <PageHeader title="Sales order" meta=" " />
      <PageContent className="min-h-[808px]">
        {role === 'PURCHASE' && <SupplyTabs />}
        <div role="status" aria-label="Loading" className="flex min-h-[720px] w-full flex-1 items-stretch gap-[20px]">
          <Card pad={24} className="min-w-px flex-1"><Bar w={160} /><Bar w="80%" /><Bar w="70%" /><Bar w="75%" /><Bar w="60%" /></Card>
          <div className="flex w-[460px] shrink-0 flex-col gap-[20px]">
            <Card pad={24} className="w-full"><Bar w={200} /><Bar w={320} /></Card>
            <Card pad={24} className="w-full flex-1"><Bar w={140} /><Bar w={300} /></Card>
          </div>
        </div>
      </PageContent>
    </>
  );
}

