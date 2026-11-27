// Purchase-only drawers (rendered from Purchase screens only; supplier price never reaches a Sales view).
// - Verify order — PO1 240:49300 (drawer 240:49382, 600): check rows (bg-subtle r12 px-14 py-10 gap 10, 16px check, 14/20),
//   evidence choice, neutral "On verify" alert, footer Cancel · Verify & number order (shield-check).
//   API POST /sales-orders/:id/verify {authorisation_event_id} (a PENDING event). Deviations: the drawn "Evidence decision
//   VERIFIED / REJECTED" and "Note" have no API (verify only) → GapNote; "Customer status is APPROVED" isn't readable → not
//   drawn as a check.
// - Payment terms — PO2 243:47158 (600): Advance chips (4 API values), amount (₹) + %, neutral alert, designer notes G16 / G17,
//   footer Cancel · Save terms. API POST /sales-orders/:id/payment-terms {advance_kind, required_amount_paise (int paise,
//   unless NOT_REQUIRED), required_percent (PERCENTAGE), accepted_terms_evidence_uri *}. "Balance terms" has no field
//   (GapNote); the accepted-terms evidence the API requires is added.
// - Reserve stock — PO2 243:47869 / insufficient 243:48171 (600): KV box, Reserve qty *, helper, shortfall alert; on refusal
//   the blocked alert + "Authorise sourcing for n". API POST /sales-order-lines/:id/reservations {qty} + Idempotency-Key.
//   MAIN STORE allocatable has no read endpoint → GapNote; the server refuses insufficient stock (shown verbatim).
// - Release reservation — PO2 243:49644 (600): neutral "What happens", footer Keep · Release n (danger, x).
//   API POST /sales-reservations/:id/release. The drawn "Reason *" has no API field (GapNote).
// - Authorise sourcing — PO2 243:48480 (L1) / 243:48825 (non-L1 BLOCKED) (600): footer Cancel · Authorise & raise PO (cart).
//   API POST /sales-order-lines/:id/sourcing-authorisations then POST /sales-orders/:id/purchase-orders
//   {sourcing_authorisation_ids:[id]}. The drawn RFQ offer comparison table has no read for a sales line → the chosen offer is
//   entered (supplier, unit price, rank) with offer + comparison evidence. Non-L1 needs MD approver + date + MD evidence
//   (the API accepts them) — blocked with the reason until all three are given.
// - Decide change request — PO3 244:48700 (600): KV box, Decision chips APPROVED / REJECTED, Note, footer Cancel · Save
//   decision. API POST /sales-change-requests/:id/decide {decision, decision_note}. "Raised by" name isn't in the row
//   (requested_by_id only) → the date is shown.
import { useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconShieldCheck, IconShoppingCart, IconStack2, IconX } from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { formatDate, formatDateTime, formatPaise, formatQty } from '../../../lib/format';
import { Button, Drawer, FormErrors, GapNote, Ic, InlineAlert, LookupPicker } from '../../../ui/desktop';
import { employeeSource } from '../../purchase/api';
import {
  ADVANCE_KINDS, newIdempotencyKey, supplyApi, useSalesConfig, useSupplyMutation,
  type AdvanceKind, type Authorisation, type ChangeRequest, type OrderDetail, type OrderLine, type Reservation, type SourcingBody,
} from '../api';
import { lineLabel, num, rupeesToPaise, type Item } from './data';
import { Chips, CompactInput, EvidenceUpload, KVBox, OpenQuestion, ReasonStrip, Row2 } from './ui';
import { useEvidence } from './evidence';

type Done = (title: string, body: string) => void;
const todayIso = () => new Date().toISOString().slice(0, 10);

function CheckRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[12px] bg-subtle px-[14px] py-[10px]">
      <Ic icon={IconCheck} size={16} className="shrink-0 text-fg" />
      <p className="min-w-px flex-1 text-[14px] leading-[20px] text-fg">{children}</p>
    </div>
  );
}

// ------------------------------------------------------------------ verify
export function VerifyDrawer({ open, onClose, order, subtitle, customer, revisionNo, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; subtitle: string; customer: string | null; revisionNo: number | null; onDone: Done;
}) {
  const pending = order.authorisations.filter((a) => a.verified_status === 'PENDING');
  const [pick, setPick] = useState<string | null>(null);
  const chosen = pending.find((a) => a.id === pick) ?? (pending.length === 1 ? pending[0] : null);
  const m = useSupplyMutation((id: string) => supplyApi.verifyOrder(order.id, id));
  const close = () => { setPick(null); m.reset(); onClose(); };
  const evLabel = (a: Authorisation) => `${a.source_kind.replace(/_/g, ' ')}${a.source_reference ? ` · ${a.source_reference}` : a.customer_email_sender ? ` · ${a.customer_email_sender}` : ''}`;

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Verify order"
      subtitle={subtitle}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button
            kind="primary"
            busy={m.isPending}
            disabled={!chosen}
            icon={<Ic icon={IconShieldCheck} size={18} />}
            onClick={() => chosen && m.mutate(chosen.id, {
              onSuccess: (o) => { m.reset(); onDone(`Order verified · ${o.sales_order_number ?? ''}`, 'Next: record payment terms. Reservation and sourcing stay blocked until then.'); },
            })}
          >
            Verify &amp; number order
          </Button>
        </>
      )}
    >
      <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Check the evidence against the order</p>
      <CheckRow>Customer on the PO matches the quote{customer ? ` (${customer})` : ''}</CheckRow>
      <CheckRow>PO items and quantities match the accepted lines ({order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'})</CheckRow>
      <CheckRow>PO prices match the issued revision{revisionNo != null ? ` (r${revisionNo})` : ''}</CheckRow>
      {pending.length > 1 ? (
        <Chips
          label="Evidence to verify *"
          options={pending.map((a) => a.id)}
          value={chosen?.id ?? null}
          onChange={setPick}
          format={(id) => { const a = pending.find((x) => x.id === id)!; return `${evLabel(a)} · ${formatDate(a.received_at)}`; }}
        />
      ) : chosen ? (
        <KVBox rows={[{ label: 'Evidence', value: evLabel(chosen) }, { label: 'Dated', value: formatDate(chosen.received_at) }]} />
      ) : (
        <InlineAlert tone="blocked" title="No pending evidence">Attach the customer PO, order confirmation or authorising email first.</InlineAlert>
      )}
      <GapNote code="API">Verify only: the API can’t record a REJECTED evidence decision or a verify note. If the evidence doesn’t match, don’t verify — attach the right evidence instead.</GapNote>
      <InlineAlert tone="neutral" title="On verify">The order gets its SO number and becomes read-only. Record payment terms next.</InlineAlert>
      <FormErrors error={m.error} title="The order wasn't verified" />
    </Drawer>
  );
}

// ------------------------------------------------------------------ payment terms
export function PaymentTermsDrawer({ open, onClose, order, subtitle, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; subtitle: string; onDone: Done;
}) {
  const [kind, setKind] = useState<AdvanceKind | null>(null);
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState('');
  const [tried, setTried] = useState(false);
  const ev = useEvidence();
  const m = useSupplyMutation((b: Parameters<typeof supplyApi.recordPaymentTerms>[1]) => supplyApi.recordPaymentTerms(order.id, b));
  const reset = () => { setKind(null); setAmount(''); setPct(''); setTried(false); ev.clear(); m.reset(); };
  const close = () => { reset(); onClose(); };

  const needsAmount = kind !== null && kind !== 'NOT_REQUIRED';
  const paise = rupeesToPaise(amount);
  const p = Number(pct);
  const errs = {
    kind: !kind ? 'Choose the advance the customer accepted.' : null,
    amount: needsAmount && (paise === null || paise < 1) ? 'Enter the advance in rupees, e.g. 25000 or 25000.50.' : null,
    pct: kind === 'PERCENTAGE' && (!pct.trim() || !(p > 0 && p <= 100)) ? 'Enter a % between 0 and 100.' : null,
    ev: !ev.uri ? (ev.busy ? 'Wait for the upload to finish.' : 'Attach the accepted terms (quote acceptance / PO terms).') : null,
  };

  const submit = () => {
    setTried(true);
    if (errs.kind || errs.amount || errs.pct || errs.ev) return;
    m.mutate({
      advance_kind: kind!,
      accepted_terms_evidence_uri: ev.uri!,
      ...(needsAmount ? { required_amount_paise: paise! } : {}),
      ...(kind === 'PERCENTAGE' ? { required_percent: p } : {}),
    }, {
      onSuccess: (t) => {
        reset();
        onDone('Payment terms recorded', t.advance_kind === 'NOT_REQUIRED'
          ? 'No advance required. Reservation and sourcing are open.'
          : `Advance ${formatPaise(t.required_amount_paise)} sent to Finance for confirmation against a receipt.`);
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Payment terms"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={ev.busy} icon={<Ic icon={IconCheck} size={18} />}>Save terms</Button>
        </>
      )}
    >
      <Chips label="Advance *" options={ADVANCE_KINDS} value={kind} onChange={setKind} error={tried ? errs.kind : null} />
      {needsAmount && (
        <Row2>
          <CompactInput label="Advance amount (₹) *" inputMode="decimal" mono value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25,000" error={tried ? errs.amount : null} />
          {kind === 'PERCENTAGE'
            ? <CompactInput label="Percent of order *" inputMode="decimal" mono value={pct} onChange={(e) => setPct(e.target.value)} placeholder="30" error={tried ? errs.pct : null} helper="Recorded as stated in the terms; not used to compute." />
            : <div />}
        </Row2>
      )}
      <EvidenceUpload label="Accepted terms evidence *" prompt="Attach the accepted terms (image or PDF)" evidence={ev} error={tried ? errs.ev : null} />
      <GapNote code="API">Balance terms (e.g. “30 days from invoice”) have no field in the payment-terms API. The order keeps the quote’s payment terms snapshot.</GapNote>
      <InlineAlert tone="neutral" title="If an advance is required">Finance confirms it against a customer payment receipt.</InlineAlert>
      <AdvancePolicyNote />
      <OpenQuestion>G17 · CLIENT-UNCONFIRMED — whether reservation / sourcing must wait until the advance is CONFIRMED, not just recorded. This screen waits for Finance’s confirmation.</OpenQuestion>
      <FormErrors error={m.error} title="The terms weren't saved" />
    </Drawer>
  );
}

/** G16 answered: the company advance policy is set by System admin (Settings › Policies); show the live value. */
function AdvancePolicyNote() {
  const cfg = useSalesConfig();
  const p = cfg.data?.policy?.advance_policy ?? null;
  if (cfg.isPending) return null;
  return (
    <InlineAlert tone="neutral" title={`Company advance policy: ${p === 'NONE' ? 'NONE' : p === 'PER_ORDER' ? 'PER ORDER' : 'not set'}`}>
      {p === 'NONE'
        ? 'An order with no recorded terms needs no advance; terms you record here still apply.'
        : 'Record the advance terms on each order before reservation / sourcing.'}
      {' '}Set by System admin in Admin › Settings › Policies.
    </InlineAlert>
  );
}

// ------------------------------------------------------------------ reserve
export function ReserveDrawer({ open, onClose, order, line, items, onDone, onSource }: {
  open: boolean; onClose: () => void; order: OrderDetail; line: OrderLine | null; items: Record<string, Item>;
  onDone: Done; onSource: (line: OrderLine, qty: number) => void;
}) {
  const pending = num(line?.reservation_pending_qty);
  const [qty, setQty] = useState('');
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // One Idempotency-Key per user click: a re-click after a network failure (no server answer) reuses it, so the server can't
  // reserve twice; any server answer (success or refusal) ends that attempt.
  const attempt = useRef<{ key: string; qty: number } | null>(null);
  const m = useSupplyMutation((v: { qty: number; key: string }) => supplyApi.reserve(line!.sales_order_line_id!, v.qty, v.key));
  const reset = () => { setQty(''); setTried(false); setFailed(null); attempt.current = null; m.reset(); };
  const close = () => { reset(); onClose(); };
  if (!line) return null;

  const uom = line.uom;
  const q = Number(qty || String(pending));
  const err = !(q > 0) ? 'Enter a quantity above 0.' : q > pending ? `Max ${formatQty(String(pending), uom)} — the line’s reservation pending.` : null;
  const label = lineLabel(line, items);

  const submit = () => {
    setTried(true);
    if (err) return;
    if (!attempt.current || attempt.current.qty !== q) attempt.current = { key: newIdempotencyKey(), qty: q };
    const key = attempt.current.key;
    setFailed(null);
    m.mutate({ qty: q, key }, {
      onSuccess: (r) => {
        attempt.current = null;
        if (r.state === 'FAILED') { setFailed(r.error_message ?? 'The ledger refused the reservation.'); return; }
        reset();
        onDone('Stock reserved', `${formatQty(r.requested_qty, uom)} of ${label} reserved from MAIN STORE (${r.state}).`);
      },
      onError: (e) => { if (apiStatus(e)) attempt.current = null; },
    });
  };

  const shortfall = Math.max(0, pending - q);
  const refused = failed || (m.error && apiStatus(m.error) ? true : null);
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Reserve stock"
      subtitle={`${order.sales_order_number ?? 'Draft'} · ${label}`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconStack2} size={18} />}>
            Reserve {q > 0 ? formatQty(String(q), uom) : ''}
          </Button>
        </>
      )}
    >
      <KVBox rows={[
        { label: 'Ordered', value: formatQty(line.accepted_qty, uom), mono: true },
        { label: 'Already reserved', value: formatQty(line.reserved_qty ?? '0', uom), mono: true },
        { label: 'Sourcing authorised', value: formatQty(line.sourcing_authorised_qty ?? '0', uom), mono: true },
        { label: 'Reservation pending', value: formatQty(String(pending), uom), mono: true },
      ]} />
      <GapNote code="API">MAIN STORE allocatable stock has no read endpoint here. The server checks the live ledger when you reserve and refuses a shortfall.</GapNote>
      <CompactInput
        label="Reserve qty *"
        inputMode="decimal"
        mono
        value={qty}
        placeholder={formatQty(String(pending))}
        onChange={(e) => { setQty(e.target.value.replace(/[^\d.]/g, '')); setFailed(null); }}
        error={tried ? err : refused ? 'The ledger has less allocatable in MAIN STORE' : null}
        helper={`Max ${formatQty(String(pending), uom)} — MAIN STORE only. Other locations are never used.`}
      />
      {!refused && !err && shortfall > 0 && (
        <InlineAlert tone="progress" title={`Shortfall ${formatQty(String(shortfall), uom)}`}>
          After reserving, authorise sourcing for the remaining {formatQty(String(shortfall), uom)} from a supplier offer.
        </InlineAlert>
      )}
      {failed && <InlineAlert tone="blocked" title="Insufficient stock — reservation FAILED">{failed} Nothing was reserved.</InlineAlert>}
      <FormErrors error={m.error} title="Reservation refused — nothing was reserved" />
      {(refused || shortfall > 0) && (
        <Button kind="secondary" block icon={<Ic icon={IconShoppingCart} size={18} />} onClick={() => { const n = refused ? pending : shortfall; reset(); onSource(line, n); }}>
          Authorise sourcing for {formatQty(String(refused ? pending : shortfall))}
        </Button>
      )}
    </Drawer>
  );
}

// ------------------------------------------------------------------ release
export function ReleaseDrawer({ open, onClose, order, line, items, reservations, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; line: OrderLine | null; items: Record<string, Item>; reservations: Reservation[]; onDone: Done;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const chosen = reservations.find((r) => r.id === pick) ?? (reservations.length === 1 ? reservations[0] : null);
  const m = useSupplyMutation((id: string) => supplyApi.releaseReservation(id));
  const close = () => { setPick(null); m.reset(); onClose(); };
  if (!line) return null;
  const uom = line.uom;
  const label = lineLabel(line, items);
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Release reservation"
      subtitle={`${order.sales_order_number ?? ''} · ${label}${chosen ? ` · ${formatQty(chosen.requested_qty, uom)} ${chosen.state}` : ''}`}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Keep</Button>
          <Button
            kind="danger"
            busy={m.isPending}
            disabled={!chosen}
            icon={<Ic icon={IconX} size={18} />}
            onClick={() => chosen && m.mutate(chosen.id, { onSuccess: () => { m.reset(); onDone('Reservation released', `${formatQty(chosen.requested_qty, uom)} of ${label} returned to MAIN STORE allocatable.`); } })}
          >
            Release {chosen ? formatQty(chosen.requested_qty, uom) : ''}
          </Button>
        </>
      )}
    >
      {reservations.length > 1 && (
        <Chips
          label="Reservation *"
          options={reservations.map((r) => r.id)}
          value={chosen?.id ?? null}
          onChange={setPick}
          format={(id) => { const r = reservations.find((x) => x.id === id)!; return `${formatQty(r.requested_qty, uom)} · ${formatDate(r.confirmed_at ?? r.created_at)}`; }}
        />
      )}
      <InlineAlert tone="neutral" title="What happens">
        {chosen ? formatQty(chosen.requested_qty, uom) : 'The quantity'} returns to MAIN STORE allocatable. The line goes back to reservation pending. A reservation already on an outward line can’t be released.
      </InlineAlert>
      <GapNote code="API">The release API takes no reason — note it on the order if needed.</GapNote>
      <FormErrors error={m.error} title="The reservation wasn't released" />
    </Drawer>
  );
}

// ------------------------------------------------------------------ sourcing
const RANKS = ['1', '2', '3', '4', '5'] as const;

export function SourcingDrawer({ open, onClose, order, line, items, initialQty, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; line: OrderLine | null; items: Record<string, Item>; initialQty: number; onDone: Done;
}) {
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState('');
  const [rank, setRank] = useState<(typeof RANKS)[number]>('1');
  const [qty, setQty] = useState('');
  const [md, setMd] = useState<string | null>(null);
  const [mdAt, setMdAt] = useState(todayIso());
  const [tried, setTried] = useState(false);
  const offerEv = useEvidence();
  const compEv = useEvidence();
  const mdEv = useEvidence();
  const m = useSupplyMutation(async (b: SourcingBody) => {
    const auth = await supplyApi.authoriseSourcing(line!.sales_order_line_id!, b);
    try {
      const po = await supplyApi.raiseSalesOrderPo(order.id, { sourcing_authorisation_ids: [auth.id] });
      return { auth, po, poError: null as unknown };
    } catch (e) {
      return { auth, po: null, poError: e };
    }
  });
  const reset = () => {
    setSupplier(''); setPrice(''); setRank('1'); setQty(''); setMd(null); setMdAt(todayIso()); setTried(false);
    offerEv.clear(); compEv.clear(); mdEv.clear(); m.reset();
  };
  const close = () => { reset(); onClose(); };
  if (!line) return null;

  const uom = line.uom;
  const label = lineLabel(line, items);
  const q = Number(qty || String(initialQty));
  const nonL1 = rank !== '1';
  const unit = Number(price.replace(/,/g, ''));
  const mdMissing = nonL1 && (!md || !mdAt || !mdEv.uri);
  const errs = {
    supplier: !supplier.trim() ? 'Enter the supplier.' : null,
    price: !price.trim() || !(unit >= 0) || !/^\d+(\.\d+)?$/.test(price.replace(/,/g, '').trim()) ? 'Enter the supplier unit price in ₹.' : null,
    qty: !(q >= 1) ? 'Enter at least 1.' : null,
    offer: !offerEv.uri ? 'Attach the supplier offer.' : null,
    comp: !compEv.uri ? 'Attach the comparison (L1 / L2 / L3).' : null,
  };
  const uploading = offerEv.busy || compEv.busy || mdEv.busy;

  const submit = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean) || mdMissing || uploading) return;
    m.mutate({
      quantity: q,
      supplier_name: supplier.trim(),
      supplier_unit_price: unit,
      supplier_offer_evidence_uri: offerEv.uri!,
      comparison_evidence_uri: compEv.uri!,
      selected_rank: Number(rank),
      ...(nonL1 ? { md_approved_by_id: md!, md_approved_at: `${mdAt}T00:00:00+05:30`, md_approval_evidence_uri: mdEv.uri! } : {}),
    });
  };

  const r = m.data;
  if (r) {
    const finish = () => {
      const ok = !r.poError;
      const body = `${formatQty(r.auth.quantity, uom)} of ${label} from ${r.auth.supplier_name_snapshot}${r.po ? ` · ${r.po.po_number} (SALES ORDER)` : ''}.`;
      reset();
      if (ok) onDone('Sourcing authorised · PO raised', body); else onClose();
    };
    return (
      <Drawer
        open={open}
        onClose={finish}
        width={600}
        bodyGap={16}
        title="Authorise sourcing"
        subtitle={`${order.sales_order_number ?? ''} · ${label}`}
        footer={<Button kind="secondary" onClick={finish}>Close</Button>}
      >
        <InlineAlert tone="success" title="Sourcing authorised">
          {formatQty(r.auth.quantity, uom)} from {r.auth.supplier_name_snapshot} at ₹{r.auth.supplier_unit_price} / unit (L{r.auth.selected_rank}).
        </InlineAlert>
        {r.poError
          ? <FormErrors error={r.poError} title="The supplier PO wasn't raised — raise it from the Sourcing card" />
          : <InlineAlert tone="success" title={`${r.po?.po_number ?? 'PO'} raised`}>SALES ORDER supplier PO, same PO series as repair POs (no job number). Release it from the PO screen.</InlineAlert>}
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Authorise sourcing"
      subtitle={`${order.sales_order_number ?? ''} · ${label} · shortfall ${formatQty(String(initialQty), uom)}`}
      onSubmit={submit}
      footer={mdMissing ? (
        <div className="flex w-full flex-col gap-[12px]">
          <ReasonStrip>MD evidence required for a non-L1 offer</ReasonStrip>
          <Button kind="primary" block disabled>Authorise &amp; raise PO</Button>
        </div>
      ) : (
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={uploading} icon={<Ic icon={IconShoppingCart} size={18} />}>Authorise &amp; raise PO</Button>
        </>
      )}
    >
      <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Supplier offer (Purchase only)</p>
      <GapNote code="API">No offer-comparison read exists for a sales line: enter the chosen offer and attach the supplier offer and the comparison.</GapNote>
      <Row2>
        <CompactInput label="Supplier *" value={supplier} maxLength={200} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" error={tried ? errs.supplier : null} />
        <CompactInput label="Unit price (₹) *" inputMode="decimal" mono value={price} onChange={(e) => setPrice(e.target.value)} placeholder="17,064.00" error={tried ? errs.price : null} />
      </Row2>
      <Row2>
        <Chips label="Rank selected *" options={RANKS} value={rank} onChange={setRank} format={(v) => `L${v}`} />
        <CompactInput label="Qty to source *" inputMode="decimal" mono value={qty} placeholder={formatQty(String(initialQty))} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} error={tried ? errs.qty : null} helper={uom ? `In ${uom}` : undefined} />
      </Row2>
      <EvidenceUpload label="Supplier offer *" prompt="Attach the supplier’s offer" evidence={offerEv} error={tried ? errs.offer : null} />
      <EvidenceUpload label="Comparison evidence *" prompt="Attach the offer comparison (L1 / L2 / L3)" evidence={compEv} error={tried ? errs.comp : null} />
      {nonL1 ? (
        <>
          <InlineAlert tone="blocked" title="Not the L1 offer">Choosing L{rank} needs MD approval evidence.</InlineAlert>
          <LookupPicker label="MD approved by *" placeholder="Select the approver" value={md} onChange={(id) => setMd(id)} source={employeeSource()} />
          <CompactInput label="MD approved on *" type="date" value={mdAt} max={todayIso()} onChange={(e) => setMdAt(e.target.value)} />
          <EvidenceUpload label="MD approval evidence *" prompt="Attach the MD’s approval (email / signed note)" evidence={mdEv} />
          <OpenQuestion>G23 · CLIENT-UNCONFIRMED — how MD evidence for a non-L1 offer is captured (document upload vs MD approval in the app) is not decided. The API takes an approver, a date and an evidence file.</OpenQuestion>
        </>
      ) : (
        <InlineAlert tone="success" title="L1 selected">No MD evidence needed. Next: a SALES ORDER supplier PO is raised (same PO series, no job number).</InlineAlert>
      )}
      <FormErrors error={m.error} title="Sourcing wasn't authorised" />
    </Drawer>
  );
}

// ------------------------------------------------------------------ decide change request
export function DecideChangeDrawer({ open, onClose, order, request, items, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; request: ChangeRequest | null; items: Record<string, Item>; onDone: Done;
}) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((v: { id: string; decision: 'APPROVED' | 'REJECTED'; note: string }) =>
    supplyApi.decideChangeRequest(v.id, { decision: v.decision, ...(v.note ? { decision_note: v.note } : {}) }));
  const reset = () => { setDecision(null); setNote(''); setTried(false); m.reset(); };
  const close = () => { reset(); onClose(); };
  if (!request) return null;
  const line = order.lines.find((l) => l.sales_order_line_id === request.sales_order_line_id);
  const lineText = line ? lineLabel(line, items) : 'Whole order';

  const submit = () => {
    setTried(true);
    if (!decision) return;
    m.mutate({ id: request.id, decision, note: note.trim() }, {
      onSuccess: (r) => {
        reset();
        const cancel = r.change_request.change_kind === 'CANCELLATION';
        onDone(
          `${cancel ? 'Cancellation' : 'Change request'} ${r.change_request.decision}`,
          cancel && r.change_request.decision === 'APPROVED'
            ? `${lineText} cancelled. Order is now ${r.order.status.replace(/_/g, ' ')}.`
            : `${r.change_request.change_kind.replace(/_/g, ' ')} · ${lineText} — decision recorded.`,
        );
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Decide change request"
      subtitle={`${order.sales_order_number ?? ''} · ${request.change_kind.replace(/_/g, ' ')} · ${lineText}`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconCheck} size={18} />}>Save decision</Button>
        </>
      )}
    >
      <KVBox rows={[
        { label: 'Raised', value: formatDateTime(request.created_at) },
        { label: 'Reason', value: request.reason },
        ...(request.financial_impact_description ? [{ label: 'Financial impact', value: request.financial_impact_description }] : []),
      ]} />
      <Chips label="Decision *" options={['APPROVED', 'REJECTED'] as const} value={decision} onChange={setDecision} error={tried && !decision ? 'Choose a decision.' : null} />
      <CompactInput label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why — recorded with the decision" />
      <InlineAlert tone="neutral" title="What a decision does">
        Only an APPROVED CANCELLATION changes data (the line / order is cancelled if nothing is shipped, invoiced, reserved or on a PO). Other kinds record the decision; make the agreed change through the normal flow.
      </InlineAlert>
      <FormErrors error={m.error} title="The decision wasn't saved" />
    </Drawer>
  );
}
