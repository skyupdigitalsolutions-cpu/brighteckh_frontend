// RFQ detail drawers (kit Drawer = Figma 177:108447 layout: 520 wide, header/body/footer, Cancel + primary).
// - InviteSupplierDrawer — "S1 · RFQ · Invite supplier (drawer)" 177:121956: Supplier name * (helper "Saved on the
//   RFQ as a snapshot") · Contact (email / phone) · neutral InlineAlert "What they receive". The API takes a free-text
//   supplier snapshot (SupplierInviteDto.supplier_name_snapshot / supplier_contact_snapshot) — no supplier id needed.
//   POST /rfqs/{id}/supplier-invites. (The first invite moves a DRAFT RFQ to SENT, server-side.)
// - RecordOfferDrawer — "S1 · RFQ · Record offer (drawer)" 177:122122: Supplier * (select of this RFQ's invites) ·
//   Make / Part number · Condition * chips · Unit price (₹) * / Discount · Freight / packing (₹) / Non-recoverable
//   tax (₹) · Delivery (days) / Valid until · "Comparable landed cost" box (brand-subtle, radius 14, px-16 py-12).
//   Deviations (API wins): Condition offers the API enum NEW / REFURBISHED / OTHER (Figma draws two); "Discount" is
//   an AMOUNT in ₹ (`quoted_discount`, numeric ≥ 0, subtracted from the landed cost by the DB) — Figma labels it
//   "Discount %"; the offered quantity is the RFQ line quantity (the supplier quotes only what was asked) and is
//   shown, not edited. Several RFQ lines → one block per line (Figma draws a one-line RFQ). Valid until is the offer
//   header's `validity_until`. The landed preview mirrors the DB generated column
//   round(qty × unit price, 2) − discount + freight + non-recoverable tax; the saved value comes from the server.
//   POST /rfqs/{id}/offers.
// - MarkInvalidDrawer — "S1 · RFQ · Mark invalid (drawer)" 177:122603: Summary strip (bg-subtle, radius 14, px-16
//   py-12, gap 16: Unit price · Landed · Delivery, 12/16 label over Data/ID) + Reason * (helper "Required. Saved with
//   the offer line and shown in comparisons."). POST /offer-lines/{id}/mark-validity {valid:false, reason}.
import { useEffect, useState } from 'react';
import { IconCheck, IconSend, IconX } from '@tabler/icons-react';
import { Drawer } from '../../../ui/desktop/Drawer';
import { Button } from '../../../ui/desktop/Button';
import { Ic } from '../../../ui/desktop/Icon';
import { ChoiceChips, DateField, FieldRow, NumberInput, SelectField, TextInput } from '../../../ui/desktop/Fields';
import { FormErrors, InlineAlert } from '../../../ui/desktop/Feedback';
import { formatINR, formatQty } from '../../../lib/format';
import {
  useAddSupplierInvite, useMarkOfferValidity, useRecordOffer,
  type OfferLine, type OfferLineBody, type OfferRecorded, type Rfq, type SupplierInvite,
} from '../api';
import { shortId } from './data';

// ---------------------------------------------------------------- invite
export function InviteSupplierDrawer({ open, onClose, rfq, subtitle, jobId, onDone }: {
  open: boolean; onClose: () => void; rfq: Rfq; subtitle: string; jobId?: string; onDone: (inv: SupplierInvite) => void;
}) {
  const m = useAddSupplierInvite(rfq.id, jobId);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setName(''); setContact(''); setTried(false); m.reset(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const first = rfq.lines[0];
  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={m.isPending}
      bodyGap={16}
      title="Invite supplier"
      subtitle={subtitle}
      onSubmit={() => {
        setTried(true);
        if (!name.trim()) return;
        m.mutate(
          { supplier_name_snapshot: name.trim(), ...(contact.trim() ? { supplier_contact_snapshot: contact.trim() } : {}) },
          { onSuccess: onDone },
        );
      }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconSend} size={18} />}>Send invite</Button>
        </>
      )}
    >
      <TextInput
        label="Supplier name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        helper="Saved on the RFQ as a snapshot"
        error={tried && !name.trim() ? 'Enter the supplier name.' : null}
        autoFocus
      />
      <TextInput label="Contact (email / phone)" value={contact} onChange={(e) => setContact(e.target.value)} />
      <InlineAlert tone="neutral" title="What they receive">
        {first
          ? `${rfq.lines.length === 1 ? 'Line 1' : `${rfq.lines.length} lines`} · ${formatQty(first.quantity, first.uom)} · spec and needed-by date. No customer details and no other suppliers' prices.`
          : "The RFQ lines · spec and needed-by date. No customer details and no other suppliers' prices."}
      </InlineAlert>
      <FormErrors error={m.error} />
    </Drawer>
  );
}

// ---------------------------------------------------------------- record offer
type Cond = 'NEW' | 'REFURBISHED' | 'OTHER';
type LineIn = { make: string; part: string; cond: Cond; price: string; disc: string; freight: string; nrtax: string; days: string };
const blankLine: LineIn = { make: '', part: '', cond: 'NEW', price: '', disc: '', freight: '', nrtax: '', days: '' };
const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/,/g, '')));
const valid = (s: string) => s.trim() === '' || (Number.isFinite(Number(s.replace(/,/g, ''))) && Number(s.replace(/,/g, '')) >= 0);

/** Mirror of the DB generated column `comparable_landed_cost` (migration 001) for the preview only. */
function landedPreview(qty: number, l: LineIn): string | null {
  if (l.price.trim() === '' || !valid(l.price) || !valid(l.disc) || !valid(l.freight) || !valid(l.nrtax)) return null;
  const base = Math.round(qty * num(l.price) * 100) / 100;
  const v = Math.round((base - num(l.disc) + num(l.freight) + num(l.nrtax)) * 100) / 100;
  return v.toFixed(2);
}

export function RecordOfferDrawer({ open, onClose, rfq, jobId, preselectInvite, onDone }: {
  open: boolean; onClose: () => void; rfq: Rfq; jobId?: string; preselectInvite?: string;
  onDone: (o: OfferRecorded, supplier: string) => void;
}) {
  const m = useRecordOffer(rfq.id, jobId);
  const [invite, setInvite] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<Record<string, LineIn>>({});
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setInvite(preselectInvite ?? '');
    setValidUntil('');
    setLines({});
    setTried(false);
    m.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const get = (id: string) => lines[id] ?? blankLine;
  const set = (id: string, p: Partial<LineIn>) => setLines((s) => ({ ...s, [id]: { ...get(id), ...p } }));
  const one = rfq.lines.length === 1;
  const sub = one
    ? `${rfq.rfq_number ?? `RFQ #${rfq.rfq_seq}`} · line 1 · ${formatQty(rfq.lines[0].quantity, rfq.lines[0].uom)}`
    : `${rfq.rfq_number ?? `RFQ #${rfq.rfq_seq}`} · ${rfq.lines.length} lines`;

  const lineErrors = (id: string, qty: number) => {
    const l = get(id);
    return {
      price: l.price.trim() === '' ? 'Enter the unit price.' : !valid(l.price) ? 'Enter a number, 0 or more.' : null,
      disc: valid(l.disc) ? null : 'Enter an amount, 0 or more.',
      freight: valid(l.freight) ? null : 'Enter an amount, 0 or more.',
      nrtax: valid(l.nrtax) ? null : 'Enter an amount, 0 or more.',
      days: l.days.trim() === '' || /^\d+$/.test(l.days.trim()) ? null : 'Whole days, 0 or more.',
      landed: (() => { const p = landedPreview(qty, l); return p != null && Number(p) < 0 ? 'Discount is larger than the line value.' : null; })(),
    };
  };

  const submit = () => {
    setTried(true);
    if (!invite) return;
    const bad = rfq.lines.some((rl) => Object.values(lineErrors(rl.id, Number(rl.quantity))).some(Boolean));
    if (bad) return;
    const body: OfferLineBody[] = rfq.lines.map((rl) => {
      const l = get(rl.id);
      return {
        rfq_line_id: rl.id,
        offered_quantity: Number(rl.quantity),
        quoted_unit_price: num(l.price),
        product_condition: l.cond,
        ...(l.make.trim() ? { offered_make: l.make.trim() } : {}),
        ...(l.part.trim() ? { offered_part_number: l.part.trim() } : {}),
        ...(l.disc.trim() ? { quoted_discount: num(l.disc) } : {}),
        ...(l.freight.trim() ? { freight_packing_nonrecoverable: num(l.freight) } : {}),
        ...(l.nrtax.trim() ? { nonrecoverable_tax: num(l.nrtax) } : {}),
        ...(l.days.trim() ? { delivery_days: Number(l.days.trim()) } : {}),
      };
    });
    const supplier = rfq.invites.find((i) => i.id === invite)?.supplier_name_snapshot ?? 'Supplier';
    m.mutate(
      { supplier_invite_id: invite, ...(validUntil ? { validity_until: validUntil } : {}), lines: body },
      { onSuccess: (o) => onDone(o, supplier) },
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={m.isPending}
      bodyGap={16}
      title="Record supplier offer"
      subtitle={sub}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconCheck} size={18} />}>Save offer</Button>
        </>
      )}
    >
      <SelectField
        label="Supplier *"
        placeholder={rfq.invites.length ? 'Choose an invited supplier' : 'Invite a supplier first'}
        value={invite}
        onChange={(e) => setInvite(e.target.value)}
        error={tried && !invite ? (rfq.invites.length ? 'Choose the supplier who quoted.' : 'Invite the supplier on the Suppliers tab first.') : null}
      >
        {rfq.invites.map((i) => <option key={i.id} value={i.id}>{i.supplier_name_snapshot}</option>)}
      </SelectField>

      {rfq.lines.map((rl) => {
        const l = get(rl.id);
        const qty = Number(rl.quantity);
        const er = tried ? lineErrors(rl.id, qty) : null;
        const preview = landedPreview(qty, l);
        return (
          <div key={rl.id} className="flex w-full flex-col gap-[16px]">
            {!one && (
              <p className="text-[14px] font-semibold leading-[20px] text-fg">
                Line {rl.line_no} · {rl.item_name ?? `Item ${shortId(rl.item_bridge_id)}`} · {formatQty(rl.quantity, rl.uom)}
              </p>
            )}
            <FieldRow gap={12}>
              <TextInput label="Make" value={l.make} onChange={(e) => set(rl.id, { make: e.target.value })} />
              <TextInput label="Part number" value={l.part} onChange={(e) => set(rl.id, { part: e.target.value })} />
            </FieldRow>
            <ChoiceChips<Cond>
              label="Condition *"
              value={l.cond}
              options={[{ value: 'NEW', label: 'NEW' }, { value: 'REFURBISHED', label: 'REFURBISHED' }, { value: 'OTHER', label: 'OTHER' }]}
              onChange={(v) => set(rl.id, { cond: v })}
            />
            <FieldRow gap={12}>
              <NumberInput mono="number" label="Unit price (₹) *" value={l.price} onChange={(e) => set(rl.id, { price: e.target.value })} error={er?.price} />
              <NumberInput mono="number" label="Discount (₹)" value={l.disc} placeholder="0" onChange={(e) => set(rl.id, { disc: e.target.value })} error={er?.disc} />
            </FieldRow>
            <FieldRow gap={12}>
              <NumberInput mono="number" label="Freight / packing (₹)" value={l.freight} placeholder="0.00" onChange={(e) => set(rl.id, { freight: e.target.value })} error={er?.freight} />
              <NumberInput mono="number" label="Non-recoverable tax (₹)" value={l.nrtax} placeholder="0.00" onChange={(e) => set(rl.id, { nrtax: e.target.value })} error={er?.nrtax} />
            </FieldRow>
            <FieldRow gap={12}>
              <NumberInput mono="number" label="Delivery (days)" inputMode="numeric" value={l.days} onChange={(e) => set(rl.id, { days: e.target.value })} error={er?.days} />
              {one
                ? <DateField label="Valid until" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                : <div />}
            </FieldRow>
            <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[14px] bg-brand-subtle px-[16px] py-[12px] text-[14px] leading-[20px] text-fg">
              <span className="min-w-px flex-1 font-medium">Comparable landed cost{one ? '' : ` · ${formatQty(rl.quantity, rl.uom)}`}</span>
              <span className="shrink-0 whitespace-nowrap font-mono font-semibold">{preview ? formatINR(preview) : '—'}</span>
            </div>
            {er?.landed && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{er.landed}</p>}
          </div>
        );
      })}
      {!one && <DateField label="Valid until" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}
      <FormErrors error={m.error} />
    </Drawer>
  );
}

// ---------------------------------------------------------------- mark invalid
export function MarkInvalidDrawer({ open, onClose, rfqId, jobId, line, title, onDone }: {
  open: boolean; onClose: () => void; rfqId: string; jobId?: string; line: OfferLine | null; title: string;
  onDone: (l: OfferLine, reason: string) => void;
}) {
  const m = useMarkOfferValidity(rfqId, jobId);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setReason(''); setTried(false); m.reset(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  if (!line) return null;

  const Fact = ({ label, value }: { label: string; value: string }) => (
    <div className="flex shrink-0 flex-col items-start gap-[3px] overflow-clip">
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{value}</span>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={m.isPending}
      bodyGap={16}
      title="Mark offer line invalid"
      subtitle={title}
      onSubmit={() => {
        setTried(true);
        if (!reason.trim()) return;
        m.mutate({ offerLineId: line.id, body: { valid: false, reason: reason.trim() } }, { onSuccess: (l) => onDone(l, reason.trim()) });
      }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button kind="danger" type="submit" busy={m.isPending} icon={<Ic icon={IconX} size={18} />}>Mark invalid</Button>
        </>
      )}
    >
      <div className="flex w-full items-start gap-[16px] overflow-clip whitespace-nowrap rounded-[14px] bg-subtle px-[16px] py-[12px]">
        <Fact label="Unit price" value={formatINR(line.quoted_unit_price)} />
        <Fact label="Landed" value={formatINR(line.comparable_landed_cost)} />
        <Fact label="Delivery" value={line.delivery_days == null ? '—' : `${line.delivery_days} days`} />
      </div>
      <TextInput
        label="Reason *"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        helper="Required. Saved with the offer line and shown in comparisons."
        error={tried && !reason.trim() ? 'Required. Saved with the offer line and shown in comparisons.' : null}
        autoFocus
      />
      <FormErrors error={m.error} />
    </Drawer>
  );
}
