// O1 · Purchase order (/p/orders/:id) — Figma 03g detail frames: DRAFT 177:127928 · RELEASED 177:128106 · SHIPPED
// 177:128466 · RECEIVED 177:128569 / 177:128675 · CLOSED 177:128766 · CANCELLED 177:128857; results "released"
// 177:128018, "acknowledged" 177:128193 / 128374, "shipped" 177:128285 / 128939 / 129028.
// Page header (PO number + "supplier · for JOB") · result banner (success, after an action) · lifecycle card (glass-strong
// radius 24 p-20: PO number 18/24 + status badge; 5-step stepper Draft · Released · Acknowledged · Shipped · Received) ·
// columns gap 16: Lines card (flex; table header bg-subtle radius 18 px-14 py-10; rows px-14 py-12 border-b; "PO value
// (pre-tax) · currency · terms" row; "Goods receipts" + rows / empty state) · right card 400 = the status's card.
//
// DATA: GET /purchase-orders/{id} (PURCHASE) — see ./api.ts. Writes: release / acknowledge / shipment (PURCHASE).
// Deviations (GapNotes, never faked):
// - GAP-PO-1 Disc. / Freight / Landed columns: PO lines store unit_price only; the offer line's discount / freight are
//   for the OFFERED quantity, so they aren't PO values. Columns drawn here: Qty · Received · Unit price · Amount.
// - GAP-PO-2 "Acknowledged on" / "Shipped on" inputs: the server stamps the time of the call; shown read-only after save.
// - GAP-PO-3 Cancel: no endpoint, no cancelled date / reason (CANCELLED card).
// - GAP-PO-4 CLOSED: never set, no closed date (CLOSED card).
// - The item line shows the offered make / part + condition when the PO line came from a repair offer ("(NEW)").
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { IconCheck, IconLock, IconPackage, IconShieldCheck, IconTruck } from '@tabler/icons-react';
import {
  Badge, Button, EmptyState, ErrorState, FormErrors, GapNote, Ic, InlineAlert, PageContent, PageHeader, StateCard,
  StatusPill, cx, errorBody, useToast,
} from '../../../ui/desktop';
import { formatDate, formatDateTime, formatINR, formatQty } from '../../../lib/format';
import { CompactField, H3, TabCard, TabSkeleton } from '../jobtabs/ui';
import {
  useAcknowledgePoDesk, usePoDetail, useRecordShipmentDesk, useReleasePoDesk, type PoDetail, type PoGrnSummary,
} from './api';

const STAGES = [
  { status: 'DRAFT', label: 'Draft' }, { status: 'RELEASED', label: 'Released' }, { status: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { status: 'SHIPPED', label: 'Shipped' }, { status: 'RECEIVED', label: 'Received' },
] as const;
const h2 = 'min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg';
const dayMonth = (d: string | null | undefined) => (d ? formatDate(d) : '—');

type Banner = { title: string; body: string };

export function OrderDetail() {
  const { id } = useParams();
  const q = usePoDetail(id);
  const [banner, setBanner] = useState<Banner | null>(null);
  const po = q.data;
  const ref = po?.job_number ?? po?.sales_order_number;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{po?.po_number ?? 'Purchase order'}</span>}
        meta={po ? `${po.supplier_name_snapshot}${ref ? ` · for ${ref}` : ''}` : q.isError ? 'Purchase order' : 'Loading…'}
        action={<Link to="/p/orders" className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg-2 hover:text-fg">← All purchase orders</Link>}
      />
      <PageContent className="flex-1">
        {q.isPending ? <TabSkeleton right={400} /> : q.isError || !po ? (
          <StateCard>
            <ErrorState title="Couldn't load this purchase order" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
          </StateCard>
        ) : (
          <div className="flex min-h-[738px] w-full flex-1 flex-col gap-[20px]">
            {banner && <InlineAlert tone="success" title={banner.title}>{banner.body}</InlineAlert>}
            <Lifecycle po={po} />
            <div className="flex min-h-px w-full flex-1 items-stretch gap-[16px]">
              <Lines po={po} />
              <TabCard width={400}><RightCard po={po} onDone={setBanner} /></TabCard>
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}

function Lifecycle({ po }: { po: PoDetail }) {
  // CLOSED = every stage done (Figma 177:128766). CANCELLED has no stepper position.
  const idx = po.po_status === 'CLOSED' ? STAGES.length - 1 : STAGES.findIndex((s) => s.status === po.po_status);
  return (
    <TabCard className="shrink-0">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={cx(h2, 'font-mono')}>{po.po_number}</h2>
        <StatusPill domain="purchaseOrder" value={po.po_status} />
      </div>
      {po.po_status === 'CANCELLED' ? (
        <InlineAlert tone="blocked" title="PO cancelled">This purchase order no longer commits the supplier.</InlineAlert>
      ) : (
        <ol className="flex w-full items-center overflow-clip" aria-label="PO lifecycle">
          {STAGES.map((s, i) => {
            // As drawn: every status reached is ✓ and the next one is current; RECEIVED / CLOSED = all ✓.
            const done = i <= idx;
            const current = i === idx + 1;
            return (
              <li key={s.status} className="contents">
                {i > 0 && <div className={cx('h-[2px] min-w-px flex-1', i <= idx ? 'bg-success' : 'bg-line')} aria-hidden />}
                <div className="flex shrink-0 items-center gap-[8px] overflow-clip" aria-current={current ? 'step' : undefined}>
                  <div className={cx('flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-clip rounded-[13px]', done ? 'bg-success text-fg-on-accent' : current ? 'bg-accent' : 'bg-subtle')}>
                    {done ? <Ic icon={IconCheck} size={14} /> : <span className={cx('text-[12px] leading-[16px]', current ? 'text-fg-on-accent' : 'text-fg-muted')}>{i + 1}</span>}
                  </div>
                  <span className={cx('whitespace-nowrap', current ? 'text-[14px] font-medium leading-[20px] text-fg' : done ? 'text-[12px] leading-[16px] text-fg' : 'text-[12px] leading-[16px] text-fg-muted')}>{s.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </TabCard>
  );
}

const Hd = ({ w, children, right }: { w?: number; children: ReactNode; right?: boolean }) => (
  <div className={cx('flex items-center overflow-clip', w ? 'shrink-0' : 'min-w-px flex-1', right && 'justify-end')} style={w ? { width: w } : undefined}>
    <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
  </div>
);
const Num = ({ w, children, strong }: { w: number; children: ReactNode; strong?: boolean }) => (
  <div className="flex shrink-0 items-center justify-end overflow-clip" style={{ width: w }}>
    <span className={cx('whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg', strong && 'font-semibold')}>{children}</span>
  </div>
);
const amount = (qty: string, price: string) => (Math.round(Number(qty) * Number(price) * 100) / 100).toFixed(2);

function Lines({ po }: { po: PoDetail }) {
  const { hash } = useLocation();
  // Row menu "View goods receipts" lands on #goods-receipts.
  useEffect(() => {
    if (hash === '#goods-receipts') document.getElementById('goods-receipts')?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const value = po.lines.reduce((s, l) => s + Number(amount(l.quantity, l.unit_price)), 0);
  return (
    <TabCard className="min-w-px flex-1">
      <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Lines</h2></div>
      <div role="table" className="flex w-full flex-col gap-[14px]">
        <div role="row" className="flex w-full items-start gap-[14px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
          <Hd>Item</Hd><Hd w={80} right>Qty</Hd><Hd w={90} right>Received</Hd><Hd w={120} right>Unit price</Hd><Hd w={120} right>Amount</Hd>
        </div>
        <div className="flex w-full flex-col">
          {po.lines.map((l) => {
            const offered = [l.offered_make, l.offered_part_number].filter(Boolean).join(' ');
            return (
              <div key={l.id} role="row" className="flex w-full items-center gap-[14px] overflow-clip border-b border-line px-[14px] py-[12px]">
                <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                  <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{l.item_code}</span>
                  <span className="max-w-full truncate text-[14px] font-medium leading-[20px] text-fg">
                    {l.item_name}{l.product_condition ? ` (${l.product_condition})` : ''}
                  </span>
                  {offered && <span className="max-w-full truncate text-[12px] leading-[16px] text-fg-2">Offered: {offered}</span>}
                </div>
                <Num w={80}>{formatQty(l.quantity, l.uom)}</Num>
                <Num w={90}>{formatQty(l.received_quantity)}</Num>
                <Num w={120} strong>{formatINR(l.unit_price)}</Num>
                <Num w={120} strong>{formatINR(amount(l.quantity, l.unit_price))}</Num>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex w-full items-start gap-[10px] overflow-clip text-[14px] leading-[20px]">
        <p className="min-w-px flex-1 text-fg-2">PO value (pre-tax) · {po.currency_code}{po.payment_terms ? ` · ${po.payment_terms}` : ''}</p>
        <p className="shrink-0 whitespace-nowrap font-mono font-semibold text-fg">{formatINR(value.toFixed(2))}</p>
      </div>
      <GapNote code="GAP-PO-1">
        Disc. / Freight / Landed aren&apos;t PO values: a PO line stores only its unit price. The offer&apos;s discount and
        freight were quoted for the offered quantity, and there is no PO-level discount or freight, so the PO value excludes them.
      </GapNote>

      <H3><span id="goods-receipts" className="scroll-mt-[24px]">Goods receipts</span></H3>
      {po.grns.length === 0 ? (
        <div className="flex w-full justify-center">
          <EmptyState icon={IconPackage} title="Nothing received yet" body="Stores records the GRN when the shipment reaches the receiving bay." />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-[8px]">
          {po.grns.map((g) => <GrnRow key={g.grn_id} g={g} />)}
        </div>
      )}
    </TabCard>
  );
}

const grnStatus = (g: PoGrnSummary) => (g.lines_posted === 0 ? 'OPEN' : g.lines_posted < g.lines_total ? 'PARTIAL' : 'POSTED');

function GrnRow({ g }: { g: PoGrnSummary }) {
  const status = grnStatus(g);
  const n = (v: string) => formatQty(v);
  const parts = status === 'OPEN'
    ? [`${n(g.received_quantity)} received`, 'not posted yet']
    : [`${n(g.accepted_quantity)} accepted`, `${n(g.rejected_quantity)} rejected`, ...(Number(g.held_quantity) > 0 ? [`${n(g.held_quantity)} held`] : [])];
  return (
    <div className="flex w-full items-center gap-[16px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
      <span className="shrink-0 font-mono text-[13px] font-medium leading-[18px] text-fg">{g.grn_number}</span>
      <span className="min-w-px flex-1 truncate text-[14px] leading-[20px] text-fg-2">
        {dayMonth(g.received_at)} · {parts.join(' · ')} · by {g.received_by_name}
      </span>
      <StatusPill domain="grn" value={status} />
    </div>
  );
}

/** Label-left / value-right fact row (Figma right cards). */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[12px] text-[14px] leading-[20px]">
      <span className="min-w-px flex-1 text-fg-2">{label}</span>
      <span className="shrink-0 text-right font-medium text-fg">{children}</span>
    </div>
  );
}
const Note = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full items-start gap-[8px] rounded-[14px] bg-subtle px-[12px] py-[10px] text-[12px] leading-[16px] text-fg-2">
    <Ic icon={IconLock} size={14} className="mt-[1px] shrink-0" /><span>{children}</span>
  </div>
);
const Head = ({ children }: { children: ReactNode }) => <div className="flex w-full items-center overflow-clip"><h2 className={h2}>{children}</h2></div>;

function RightCard({ po, onDone }: { po: PoDetail; onDone: (b: Banner) => void }) {
  const toast = useToast();
  const release = useReleasePoDesk(po);
  const ack = useAcknowledgePoDesk(po);
  const ship = useRecordShipmentDesk(po);
  const [f, setF] = useState({ a: '', b: '', c: '', d: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const opt = (k: string, v: string) => (v.trim() ? { [k]: v.trim() } : {});
  const reset = () => setF({ a: '', b: '', c: '', d: '' });
  const value = po.lines.reduce((s, l) => s + Number(amount(l.quantity, l.unit_price)), 0).toFixed(2);
  const sh = po.shipments[0];

  switch (po.po_status) {
    case 'DRAFT':
      return (
        <>
          <Head>Release to supplier</Head>
          <Fact label="Supplier">{po.supplier_name_snapshot}</Fact>
          <Fact label="Payment terms">{po.payment_terms ?? '—'}</Fact>
          <Fact label="Currency">{po.currency_code}</Fact>
          <Fact label="Value (pre-tax)"><span className="font-mono">{formatINR(value)}</span></Fact>
          <Note>Releasing sends the PO to the supplier. Lines and prices lock after release.</Note>
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={release.error} title="The PO wasn't released" />
          <Button kind="primary" block icon={<Ic icon={IconTruck} size={18} />} busy={release.isPending}
            onClick={() => release.mutate(undefined, {
              onSuccess: () => {
                toast({ tone: 'progress', title: 'PO released', body: po.po_number });
                onDone({ title: 'PO released', body: `${po.po_number} is with ${po.supplier_name_snapshot}. Record their acknowledgement when it arrives.` });
              },
            })}>
            Release PO
          </Button>
        </>
      );
    case 'RELEASED':
      return (
        <>
          <Head>Record acknowledgement</Head>
          <CompactField label="Supplier reference" value={f.a} onChange={set('a')} helper="Optional · their order / SO number" />
          <CompactField label="Confirmed delivery" type="date" value={f.b} onChange={set('b')} />
          <CompactField label="Notes" value={f.c} onChange={set('c')} helper="Optional" />
          <GapNote code="GAP-PO-2">&ldquo;Acknowledged on&rdquo; isn&apos;t an input: the server records the time you save it.</GapNote>
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={ack.error} title="The acknowledgement wasn't saved" />
          <Button kind="primary" block icon={<Ic icon={IconShieldCheck} size={18} />} busy={ack.isPending}
            onClick={() => ack.mutate({ ...opt('supplier_reference', f.a), ...opt('expected_delivery_date', f.b), ...opt('notes', f.c) }, {
              onSuccess: () => {
                const when = f.b ? ` confirmed delivery for ${formatDate(f.b)}` : ' acknowledged the PO';
                reset();
                toast({ tone: 'progress', title: 'Acknowledgement recorded', body: po.po_number });
                onDone({ title: 'Acknowledgement recorded', body: `${po.supplier_name_snapshot}${when}. Record the shipment when it leaves.` });
              },
            })}>
            Mark acknowledged
          </Button>
        </>
      );
    case 'ACKNOWLEDGED':
      return (
        <>
          <Head>Record shipment</Head>
          <AckFacts po={po} />
          <CompactField label="Carrier" value={f.a} onChange={set('a')} />
          <CompactField label="Tracking / AWB" value={f.b} onChange={set('b')} />
          <CompactField label="Expected" type="date" value={f.c} onChange={set('c')} />
          <CompactField label="Notes" value={f.d} onChange={set('d')} helper="Optional" />
          <GapNote code="GAP-PO-2">&ldquo;Shipped on&rdquo; isn&apos;t an input: the server records the time you save it.</GapNote>
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={ship.error} title="The shipment wasn't recorded" />
          <Button kind="primary" block icon={<Ic icon={IconTruck} size={18} />} busy={ship.isPending}
            onClick={() => ship.mutate({ ...opt('carrier', f.a), ...opt('awb_or_lr_number', f.b), ...opt('expected_arrival_date', f.c), ...opt('notes', f.d) }, {
              onSuccess: () => {
                const eta = f.c ? ` Expected ${formatDate(f.c)}.` : '';
                reset();
                toast({ tone: 'progress', title: 'Marked as shipped', body: po.po_number });
                onDone({ title: 'Shipment recorded', body: `${po.po_number} is on its way.${eta} Stores records the GRN when it arrives.` });
              },
            })}>
            Mark as shipped
          </Button>
        </>
      );
    case 'SHIPPED':
      return (
        <>
          <Head>Shipment</Head>
          {sh ? (
            <>
              <Fact label="Carrier">{sh.carrier ?? '—'}</Fact>
              <Fact label="Tracking / AWB"><span className="font-mono">{sh.awb_or_lr_number ?? '—'}</span></Fact>
              <Fact label="Shipped on">{formatDateTime(sh.shipped_at)}</Fact>
              <Fact label="Expected">{dayMonth(sh.expected_arrival_date)}</Fact>
              <Fact label="Recorded by">{sh.recorded_by_name}</Fact>
            </>
          ) : <p className="text-[14px] leading-[20px] text-fg-2">No shipment row was recorded.</p>}
          <AckFacts po={po} />
          <Note>Stores receives the goods and posts the GRN line by line. The PO moves to RECEIVED once every line is posted.</Note>
        </>
      );
    case 'RECEIVED':
      return <ReceiptCard po={po} />;
    case 'CLOSED':
      return (
        <>
          <Head>Closed</Head>
          <GapNote code="GAP-PO-4">No rule closes a PO yet: CLOSED is never set and there is no closed date, so &ldquo;PO closed · nothing more expected&rdquo; can&apos;t be backed.</GapNote>
          <ReceiptFacts g={po.grns[0]} />
        </>
      );
    case 'CANCELLED':
      return (
        <>
          <Head>Cancelled</Head>
          <GapNote code="GAP-PO-3">There is no cancel endpoint and no cancelled date or reason, so &ldquo;Cancelled on&rdquo; and &ldquo;Reason&rdquo; can&apos;t be shown.</GapNote>
        </>
      );
    default:
      return null;
  }
}

function AckFacts({ po }: { po: PoDetail }) {
  const a = po.acknowledgement;
  if (!a) return null;
  return (
    <div className="flex w-full flex-col gap-[6px] rounded-[14px] bg-subtle px-[12px] py-[10px]">
      <Fact label="Supplier reference"><span className="font-mono">{a.supplier_reference ?? '—'}</span></Fact>
      <Fact label="Acknowledged on">{formatDateTime(a.acknowledged_at)}</Fact>
      <Fact label="Confirmed delivery">{dayMonth(a.expected_delivery_date)}</Fact>
    </div>
  );
}

function ReceiptFacts({ g }: { g: PoGrnSummary | undefined }) {
  if (!g) return <p className="text-[14px] leading-[20px] text-fg-2">No goods receipt recorded.</p>;
  return (
    <>
      <Fact label="Goods receipt"><span className="font-mono">{g.grn_number}</span></Fact>
      <Fact label="Accepted">{formatQty(g.accepted_quantity)}</Fact>
      <Fact label="Rejected">{formatQty(g.rejected_quantity)}</Fact>
      {Number(g.held_quantity) > 0 && <Fact label="Held">{formatQty(g.held_quantity)}</Fact>}
      <Fact label="Received on">{formatDate(g.received_at)}</Fact>
    </>
  );
}

function ReceiptCard({ po }: { po: PoDetail }) {
  const rejected = po.grns.some((g) => Number(g.rejected_quantity) > 0 || Number(g.held_quantity) > 0);
  return (
    <>
      <Head>Receipt</Head>
      <ReceiptFacts g={po.grns[0]} />
      {po.grns.length > 1 && <Badge tone="neutral" label={`${po.grns.length} GRNs on this PO`} />}
      {rejected && <Note>Rejected stock sits in quarantine and can be returned to the supplier from the GRN line.</Note>}
    </>
  );
}
