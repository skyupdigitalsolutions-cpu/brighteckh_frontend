// Job workspace · Purchase order tab — Figma "D·P9 · Supplier PO lifecycle" 177:104329 (Content 177:104332), drawn as a
// stand-alone PO page; here it is the job's PO inside the workspace (tab bar above, same content).
// Content gap 20: Lifecycle card (177:104333: glass-strong p-20 gap-14 radius 24; head 18/24 PO number + status badge;
// horizontal 5-step stepper Draft · Released · Acknowledged · Shipped · Received — 26px dots radius 13, done = success
// + 14px white check + 12/16 primary label, current = accent + 12/16 number + 14/20 Medium label, pending = bg-subtle +
// muted 12/16; 2px lines, success after a done step) · Columns gap 16: Lines (flex: "Lines" 18/24, table header bg-subtle
// radius 18 px-14 py-10 gap 14 — Item flex · Qty 70 → · Unit price 110 → · Disc. 60 → · Freight 90 → · Landed 110 →;
// rows px-14 py-12 border-b; "PO value (pre-tax) · currency · terms" row; "Goods receipts" H3 + list / empty state) ·
// right 400 = the status's next action (D·P9 draws ACKNOWLEDGED → "Record shipment": Carrier · Tracking / AWB ·
// Shipped on · Expected, spacer, full-width primary "Mark as shipped" with truck).
//
// API: GET /jobs/{id}/purchase-orders (headers) → GET /purchase-orders/{id} (lines) → GET /purchase-orders/{id}/grns;
// writes POST /jobs/{id}/purchase-orders {offer_line_ids} · /purchase-orders/{id}/release · /acknowledge · /shipment
// (all PURCHASE). GRNs are created/posted by Stores (STORES_QUALITY) — read-only here.
// Deviations: PO lines carry unit_price only — Disc. / Freight / Landed come from the source RFQ offer line
// (source_br04_offer_line_id) and show "—" when it can't be resolved; Disc. is the ₹ amount (Figma "%"). PO value =
// Σ qty × unit price (what the PO commits). RecordShipmentDto has no shipped-on date (G-B6-1) → that field isn't drawn.
import { useState, type ReactNode } from 'react';
import { IconCheck, IconFilePlus, IconPackage, IconSend, IconShieldCheck, IconTruck } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useItemBridgeByIds } from '../api';
import { useJobOfferLines } from '../quotes/api';
import { Badge, StatusPill } from '../../../ui/desktop/Badge';
import { Button } from '../../../ui/desktop/Button';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { useToast } from '../../../ui/desktop/Toast';
import { Ic, cx } from '../../../ui/desktop/Icon';
import type { Tone } from '../../../lib/tones';
import { formatDate, formatDayTime, formatINR, formatQty } from '../../../lib/format';
import { CompactField, H3, TabCard, TabSkeleton } from './ui';
import {
  useAcknowledgePo, useCreatePo, useJobPurchaseOrders, usePoGrns, usePurchaseOrder, useRecordShipment, useReleasePo,
  type PurchaseOrder, type PurchaseOrderRow,
} from './data';

const STAGES = [
  { status: 'DRAFT', label: 'Draft' }, { status: 'RELEASED', label: 'Released' }, { status: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { status: 'SHIPPED', label: 'Shipped' }, { status: 'RECEIVED', label: 'Received' },
] as const;
const PO_TONE: Record<PurchaseOrderRow['po_status'], Tone> = {
  DRAFT: 'neutral', RELEASED: 'progress', ACKNOWLEDGED: 'progress', SHIPPED: 'progress', RECEIVED: 'success', CLOSED: 'success', CANCELLED: 'blocked',
};
const h2 = 'min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg';

export function PurchaseOrderTab() {
  const { job } = useJobWorkspace();
  const me = useMe();
  const isPurchase = can.purchaseWork(me.role);
  const posQ = useJobPurchaseOrders(job.id, isPurchase);
  const [picked, setPicked] = useState<string | null>(null);
  const pos = posQ.data ?? [];
  const poId = picked && pos.some((p) => p.id === picked) ? picked : pos[0]?.id;
  const poQ = usePurchaseOrder(job.id, poId);

  if (!isPurchase) return <StateCard><EmptyState icon={IconPackage} title="Supplier POs are Purchase-only" body="Supplier prices and purchase orders are visible to Purchase." /></StateCard>;
  if (posQ.isPending) return <TabSkeleton right={400} />;
  if (posQ.isError) return <StateCard><ErrorState title="Couldn't load the supplier POs" body={errorBody(posQ.error)} onRetry={() => posQ.refetch()} retrying={posQ.isFetching} /></StateCard>;
  if (pos.length === 0) return <RaisePo />;

  return (
    <div className="flex min-h-[738px] w-full flex-1 flex-col gap-[20px]">
      {pos.length > 1 && (
        <div className="flex flex-wrap gap-[8px]" role="tablist" aria-label="Purchase orders">
          {pos.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === poId} onClick={() => setPicked(p.id)}
              className={cx('rounded-t-chip border px-[16px] py-[10px] font-mono text-[13px] font-medium leading-[18px]', p.id === poId ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface')}>
              {p.po_number} · {p.supplier_name_snapshot}
            </button>
          ))}
        </div>
      )}
      {poQ.isPending ? <TabSkeleton right={400} /> : poQ.isError || !poQ.data ? (
        <StateCard><ErrorState title="Couldn't load this PO" body={errorBody(poQ.error)} onRetry={() => poQ.refetch()} retrying={poQ.isFetching} /></StateCard>
      ) : <PoView po={poQ.data} />}
    </div>
  );
}

function Lifecycle({ po }: { po: PurchaseOrder }) {
  const idx = po.po_status === 'CLOSED' ? STAGES.length : STAGES.findIndex((s) => s.status === po.po_status);
  return (
    <TabCard className="shrink-0">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={cx(h2, 'font-mono')}>{po.po_number}</h2>
        <span className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{po.supplier_name_snapshot}</span>
        <Badge tone={PO_TONE[po.po_status]} label={po.po_status} />
      </div>
      {po.po_status === 'CANCELLED' ? (
        <InlineAlert tone="blocked" title="PO cancelled">This purchase order no longer commits the supplier.</InlineAlert>
      ) : (
        <ol className="flex w-full items-center overflow-clip">
          {STAGES.map((s, i) => {
            // As drawn (status ACKNOWLEDGED): every status reached is ✓, the next one is current.
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

function PoView({ po }: { po: PurchaseOrder }) {
  const { job } = useJobWorkspace();
  const itemsQ = useItemBridgeByIds(po.lines.map((l) => l.item_bridge_id));
  const offers = useJobOfferLines(job.id, true);
  const grnsQ = usePoGrns(job.id, po.id);
  const poValue = po.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const H = ({ w, children, right }: { w?: number; children: ReactNode; right?: boolean }) => (
    <div className={cx('flex items-center overflow-clip', w ? 'shrink-0' : 'min-w-px flex-1', right && 'justify-end')} style={w ? { width: w } : undefined}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
  const N = ({ w, children, strong }: { w: number; children: ReactNode; strong?: boolean }) => (
    <div className="flex shrink-0 items-center justify-end overflow-clip" style={{ width: w }}>
      <span className={cx('whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg', strong && 'font-semibold')}>{children}</span>
    </div>
  );
  return (
    <>
      <Lifecycle po={po} />
      <div className="flex min-h-px w-full flex-1 items-stretch gap-[16px]">
        <TabCard className="min-w-px flex-1">
          <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Lines</h2></div>
          <div role="table" className="flex w-full flex-col gap-[14px]">
            <div role="row" className="flex w-full items-start gap-[14px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
              <H>Item</H><H w={70} right>Qty</H><H w={110} right>Unit price</H><H w={60} right>Disc.</H><H w={90} right>Freight</H><H w={110} right>Landed</H>
            </div>
            <div className="flex w-full flex-col gap-[14px]">
              {po.lines.map((l) => {
                const it = itemsQ.data?.[l.item_bridge_id];
                const src = offers.options.find((o) => o.line.id === l.source_br04_offer_line_id)?.line;
                const part = src ? [src.offered_make, src.offered_part_number].filter(Boolean).join(' ') : '';
                return (
                  <div key={l.id} role="row" className="flex w-full items-center gap-[14px] overflow-clip border-b border-line px-[14px] py-[12px]">
                    <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                      <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{it?.item_code ?? '…'}</span>
                      <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{part ? `${part}${src?.product_condition ? ` (${src.product_condition})` : ''}` : it?.item_name ?? 'Loading item…'}</span>
                    </div>
                    <N w={70}>{formatQty(l.quantity, l.uom)}</N>
                    <N w={110} strong>{formatINR(l.unit_price)}</N>
                    <N w={60}>{src ? formatINR(src.quoted_discount) : '—'}</N>
                    <N w={90}>{src ? formatINR(src.freight_packing_nonrecoverable) : '—'}</N>
                    <N w={110} strong>{src?.comparable_landed_cost ? formatINR(src.comparable_landed_cost) : '—'}</N>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex w-full items-start gap-[10px] overflow-clip text-[14px] leading-[20px]">
            <p className="min-w-px flex-1 text-fg-2">PO value (pre-tax) · {po.currency_code}{po.payment_terms ? ` · ${po.payment_terms}` : ''}</p>
            <p className="shrink-0 whitespace-nowrap font-mono font-semibold text-fg">{formatINR(poValue.toFixed(2))}</p>
          </div>
          <H3>Goods receipts</H3>
          {grnsQ.isError ? <p className="text-[12px] leading-[16px] text-st-blocked-fg">{errorBody(grnsQ.error)}</p>
            : (grnsQ.data ?? []).length === 0 ? (
              <div className="flex w-full justify-center"><EmptyState icon={IconPackage} title={grnsQ.isPending ? 'Loading receipts…' : 'Nothing received yet'} body="Stores records the GRN when the shipment reaches the receiving bay." /></div>
            ) : grnsQ.data!.map((g) => (
              <div key={g.id} className="flex w-full items-center gap-[16px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
                <span className="min-w-px flex-1 font-mono text-[13px] font-medium leading-[18px] text-fg">{g.grn_number}</span>
                <span className="shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Received {formatDayTime(g.received_at)}</span>
              </div>
            ))}
        </TabCard>
        <TabCard width={400}><NextAction po={po} /></TabCard>
      </div>
    </>
  );
}

function NextAction({ po }: { po: PurchaseOrder }) {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const release = useReleasePo(job.id);
  const ack = useAcknowledgePo(job.id);
  const ship = useRecordShipment(job.id);
  const [f, setF] = useState({ a: '', b: '', c: '', d: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const head = (t: string) => <div className="flex w-full items-center overflow-clip"><h2 className={h2}>{t}</h2></div>;
  const opt = (k: string, v: string) => (v.trim() ? { [k]: v.trim() } : {});

  switch (po.po_status) {
    case 'DRAFT':
      return (
        <>
          {head('Release to supplier')}
          <p className="text-[14px] leading-[20px] text-fg-2">Releasing numbers the PO and commits it to {po.supplier_name_snapshot}. Lines can&apos;t change after release.</p>
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={release.error} title="The PO wasn't released" />
          <Button kind="primary" block icon={<Ic icon={IconSend} size={18} />} busy={release.isPending} onClick={() => release.mutate(po.id, { onSuccess: () => toast({ tone: 'progress', title: 'PO released', body: po.po_number }) })}>Release PO</Button>
        </>
      );
    case 'RELEASED':
      return (
        <>
          {head('Record acknowledgement')}
          <CompactField label="Supplier reference" value={f.a} onChange={set('a')} helper="Optional — their order / SO number" />
          <CompactField label="Expected delivery" type="date" value={f.b} onChange={set('b')} />
          <CompactField label="Notes" value={f.c} onChange={set('c')} />
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={ack.error} title="The acknowledgement wasn't saved" />
          <Button kind="primary" block icon={<Ic icon={IconShieldCheck} size={18} />} busy={ack.isPending}
            onClick={() => ack.mutate({ poId: po.id, body: { ...opt('supplier_reference', f.a), ...opt('expected_delivery_date', f.b), ...opt('notes', f.c) } }, { onSuccess: () => { setF({ a: '', b: '', c: '', d: '' }); toast({ tone: 'progress', title: 'Supplier acknowledged', body: po.po_number }); } })}>
            Mark as acknowledged
          </Button>
        </>
      );
    case 'ACKNOWLEDGED':
      return (
        <>
          {head('Record shipment')}
          <CompactField label="Carrier" value={f.a} onChange={set('a')} />
          <CompactField label="Tracking / AWB" value={f.b} onChange={set('b')} />
          <CompactField label="Expected" type="date" value={f.c} onChange={set('c')} />
          <CompactField label="Notes" value={f.d} onChange={set('d')} helper="Optional" />
          <GapNote code="G-B6-1">Figma&apos;s &ldquo;Shipped on&rdquo; date isn&apos;t stored: the shipment API takes carrier, AWB / LR, expected arrival and notes only.</GapNote>
          <div className="min-h-px w-px flex-1" />
          <FormErrors error={ship.error} title="The shipment wasn't recorded" />
          <Button kind="primary" block icon={<Ic icon={IconTruck} size={18} />} busy={ship.isPending}
            onClick={() => ship.mutate({ poId: po.id, body: { ...opt('carrier', f.a), ...opt('awb_or_lr_number', f.b), ...opt('expected_arrival_date', f.c), ...opt('notes', f.d) } }, { onSuccess: () => { setF({ a: '', b: '', c: '', d: '' }); toast({ tone: 'progress', title: 'Marked as shipped', body: po.po_number }); } })}>
            Mark as shipped
          </Button>
        </>
      );
    case 'SHIPPED':
      return <>{head('In transit')}<p className="text-[14px] leading-[20px] text-fg-2">Stores receives the goods and records the GRN line by line (photo gate, then post). The PO moves to RECEIVED when every line is posted.</p></>;
    case 'CANCELLED':
      return <>{head('Cancelled')}<p className="text-[14px] leading-[20px] text-fg-2">No further action on this PO.</p></>;
    default:
      return (
        <>
          {head('Received')}
          <InlineAlert tone="success" title={`${po.po_number} received`}>Posted stock is available to reserve on the Authorisation tab.</InlineAlert>
          {po.released_at && <p className="text-[12px] leading-[16px] text-fg-2">Released {formatDate(po.released_at)}</p>}
        </>
      );
  }
}

/** No PO yet: pick COMPLIANT offer lines from this job's RFQs → POST /jobs/{id}/purchase-orders (one supplier per PO). */
function RaisePo() {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const offers = useJobOfferLines(job.id, true);
  const create = useCreatePo(job.id);
  const [sel, setSel] = useState<string[]>([]);
  const [terms, setTerms] = useState('');
  const compliant = offers.options.filter((o) => o.line.technical_status === 'COMPLIANT');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="flex min-h-[738px] w-full flex-1 items-stretch gap-[16px]">
      <TabCard className="min-w-px flex-1">
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Supplier purchase order</h2></div>
        {offers.isPending ? <p className="text-[14px] leading-[20px] text-fg-2">Loading offers…</p>
          : compliant.length === 0 ? (
            <div className="flex w-full justify-center">
              <EmptyState icon={IconFilePlus} title="No PO for this job" body="A PO is raised from a compliant supplier offer. Mark an offer valid on the Sourcing tab first — jobs covered from stock need no PO." />
            </div>
          ) : (
            <>
              <p className="text-[14px] leading-[20px] text-fg-2">Choose the compliant offer lines to order. Lines from one supplier go on one PO.</p>
              {compliant.map((o) => {
                const on = sel.includes(o.line.id);
                return (
                  <button key={o.line.id} type="button" onClick={() => toggle(o.line.id)} aria-pressed={on}
                    className={cx('flex w-full items-center gap-[16px] overflow-clip rounded-[16px] px-[16px] py-[12px] text-left', on ? 'border border-brand-border bg-brand-subtle' : 'border border-transparent bg-subtle hover:bg-surface')}>
                    <span className="min-w-px flex-1 truncate text-[14px] font-medium leading-[20px] text-fg">{o.label}</span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatINR(o.line.comparable_landed_cost)}</span>
                    {on && <StatusPill domain="offerTechnical" value="COMPLIANT" />}
                  </button>
                );
              })}
            </>
          )}
      </TabCard>
      <TabCard width={400}>
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Raise PO</h2></div>
        <CompactField label="Payment terms" value={terms} onChange={(e) => setTerms(e.target.value)} helper="Optional — e.g. 30 days from invoice" />
        <div className="min-h-px w-px flex-1" />
        <FormErrors error={create.error} title="The PO wasn't created" />
        <Button kind="primary" block icon={<Ic icon={IconFilePlus} size={18} />} busy={create.isPending} disabled={sel.length === 0}
          onClick={() => create.mutate({ offer_line_ids: sel, ...(terms.trim() ? { payment_terms: terms.trim() } : {}) }, { onSuccess: (po) => toast({ tone: 'success', title: 'Draft PO created', body: po.po_number }) })}>
          Create draft PO{sel.length ? ` · ${sel.length} ${sel.length === 1 ? 'line' : 'lines'}` : ''}
        </Button>
        {sel.length === 0 && <p className="text-[12px] leading-[16px] text-fg-2">Select at least one offer line.</p>}
      </TabCard>
    </div>
  );
}
