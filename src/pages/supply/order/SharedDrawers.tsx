// Drawers both roles use (Sales and Purchase can both attach authorisation evidence, cancel a DRAFT and raise change requests).
// Shell = kit Drawer (scrim .55, 12px inset, radius 28, header 22/28 + 14/20 subtitle + 40px close, Cancel + primary footer).
// - Attach authorisation — PO1 240:48741 (drawer 240:48813, 560 wide): Source chips CUSTOMER PO · ORDER CONFIRMATION ·
//   EMAIL AUTHORISATION, Reference * + Dated * row (gap 12), evidence upload, 12/16 muted helper. Footer Cancel · Attach.
//   API POST /sales-orders/:id/authorisations {source_kind, source_reference (CUSTOMER_PO), customer_email_sender
//   (EMAIL_AUTHORISATION), received_at, evidence_uri}. "Reference" becomes "Sender email" for EMAIL AUTHORISATION.
// - Raise change request — SOS1 244:52427 (drawer 244:52594, 600 wide) and PO3 244:47930: Change kind chips (7 API values),
//   Line, kind-specific field, Reason *, neutral alert "Purchase decides". Footer Cancel · Raise request (file-plus).
//   API POST /sales-orders/:id/change-requests {change_kind, reason, sales_order_line_id?, customer_evidence_uri?,
//   technical_approval_evidence_uri? (SUBSTITUTION), financial_impact_description?}. The drawn "Requested delivery date"
//   has no API field (GapNote; put it in the reason).
// - Cancel draft (no frame; the Verify card's "Cancel draft" ghost button, 240:48731): confirm drawer → POST
//   /sales-orders/:id/cancel (DRAFT only).
import { useState } from 'react';
import { IconFilePlus, IconUpload, IconX } from '@tabler/icons-react';
import { Button, Drawer, FormErrors, GapNote, Ic, InlineAlert, SelectField } from '../../../ui/desktop';
import { AUTH_SOURCES, CHANGE_KINDS, supplyApi, useSupplyMutation, type AuthorisationSource, type ChangeKind, type OrderDetail } from '../api';
import { CHANGE_KIND_HELP, lineLabel, type Item, type Role } from './data';
import { Chips, CompactInput, EvidenceUpload, Row2 } from './ui';
import { useEvidence } from './evidence';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function AttachAuthorisationDrawer({ open, onClose, order, subtitle, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; subtitle: string; onDone: (title: string, body: string) => void;
}) {
  const [source, setSource] = useState<AuthorisationSource>('CUSTOMER_PO');
  const [ref, setRef] = useState('');
  const [dated, setDated] = useState(todayIso());
  const [tried, setTried] = useState(false);
  const ev = useEvidence();
  const m = useSupplyMutation((b: Parameters<typeof supplyApi.addAuthorisation>[1]) => supplyApi.addAuthorisation(order.id, b));

  const reset = () => { setSource('CUSTOMER_PO'); setRef(''); setDated(todayIso()); setTried(false); ev.clear(); m.reset(); };
  const close = () => { reset(); onClose(); };
  const email = source === 'EMAIL_AUTHORISATION';
  const refRequired = source === 'CUSTOMER_PO' || email;
  const errs = {
    ref: refRequired && !ref.trim() ? (email ? 'Enter the sender’s email.' : 'Enter the PO number.') : null,
    dated: !dated ? 'Pick the date on the evidence.' : null,
    ev: !ev.uri ? (ev.busy ? 'Wait for the upload to finish.' : 'Attach the evidence file.') : null,
  };

  const submit = () => {
    setTried(true);
    if (errs.ref || errs.dated || errs.ev) return;
    m.mutate({
      source_kind: source,
      received_at: `${dated}T00:00:00+05:30`,
      evidence_uri: ev.uri!,
      ...(source === 'CUSTOMER_PO' && ref.trim() ? { source_reference: ref.trim() } : {}),
      ...(source === 'ORDER_CONFIRMATION' && ref.trim() ? { source_reference: ref.trim() } : {}),
      ...(email ? { customer_email_sender: ref.trim() } : {}),
    }, {
      onSuccess: (a) => {
        const what = `${source.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}${a.source_reference ? ` ${a.source_reference}` : ''}`;
        reset();
        onDone('Evidence attached', `${what} is ${a.verified_status} verification.`);
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title="Attach authorisation"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={ev.busy} icon={<Ic icon={IconUpload} size={18} />}>Attach</Button>
        </>
      )}
    >
      <Chips label="Source *" options={AUTH_SOURCES} value={source} onChange={(v) => { setSource(v); setRef(''); }} />
      <Row2>
        <CompactInput
          label={email ? 'Sender email *' : source === 'CUSTOMER_PO' ? 'Reference *' : 'Reference'}
          type={email ? 'email' : 'text'}
          value={ref}
          maxLength={email ? 254 : 160}
          onChange={(e) => setRef(e.target.value)}
          placeholder={email ? 'buyer@customer.com' : source === 'CUSTOMER_PO' ? 'Customer PO number' : 'Confirmation reference'}
          error={tried ? errs.ref : null}
        />
        <CompactInput label="Dated *" type="date" value={dated} max={todayIso()} onChange={(e) => setDated(e.target.value)} error={tried ? errs.dated : null} />
      </Row2>
      <EvidenceUpload prompt="Attach the PO / confirmation / email (image or PDF)" evidence={ev} error={tried ? errs.ev : null} />
      <p className="w-full text-[12px] leading-[16px] text-fg-muted">Sales or Purchase can attach. Purchase verifies it before the order is numbered.</p>
      <FormErrors error={m.error} title="The evidence wasn't attached" />
    </Drawer>
  );
}

export function ChangeRequestDrawer({ open, onClose, order, items, subtitle, role, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; items: Record<string, Item>; subtitle: string; role: Role;
  onDone: (title: string, body: string) => void;
}) {
  const [kind, setKind] = useState<ChangeKind | null>(null);
  const [lineId, setLineId] = useState('');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState('');
  const [tried, setTried] = useState(false);
  const customerEv = useEvidence();
  const techEv = useEvidence();
  const m = useSupplyMutation((b: Parameters<typeof supplyApi.raiseChangeRequest>[1]) => supplyApi.raiseChangeRequest(order.id, b));

  const reset = () => { setKind(null); setLineId(''); setReason(''); setImpact(''); setTried(false); customerEv.clear(); techEv.clear(); m.reset(); };
  const close = () => { reset(); onClose(); };
  const errs = {
    kind: !kind ? 'Choose what changes.' : null,
    reason: !reason.trim() ? 'Say why — the decision is recorded against it.' : null,
  };
  const uploading = customerEv.busy || techEv.busy;

  const submit = () => {
    setTried(true);
    if (errs.kind || errs.reason || uploading) return;
    m.mutate({
      change_kind: kind!,
      reason: reason.trim(),
      ...(lineId ? { sales_order_line_id: lineId } : {}),
      ...(customerEv.uri ? { customer_evidence_uri: customerEv.uri } : {}),
      ...(kind === 'SUBSTITUTION' && techEv.uri ? { technical_approval_evidence_uri: techEv.uri } : {}),
      ...(impact.trim() ? { financial_impact_description: impact.trim() } : {}),
    }, {
      onSuccess: (cr) => {
        const line = order.lines.find((l) => l.sales_order_line_id === cr.sales_order_line_id);
        reset();
        onDone('Change request raised', `${cr.change_kind.replace(/_/g, ' ')} · ${line ? lineLabel(line, items) : 'whole order'} · waiting for Purchase decision.`);
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
      title="Raise change request"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={uploading} icon={<Ic icon={IconFilePlus} size={18} />}>Raise request</Button>
        </>
      )}
    >
      <Chips label="Change kind *" options={CHANGE_KINDS} value={kind} onChange={setKind} error={tried ? errs.kind : null} />
      <SelectField label="Line" value={lineId} onChange={(e) => setLineId(e.target.value)}>
        <option value="">All lines</option>
        {order.lines.map((l) => <option key={l.sales_order_line_id ?? ''} value={l.sales_order_line_id ?? ''}>{lineLabel(l, items)}</option>)}
      </SelectField>
      {kind === 'DELIVERY_DATE' && (
        <GapNote code="API">The requested delivery date has no field in the change-request API. Put the new date in the reason.</GapNote>
      )}
      {(kind === 'PRICE' || kind === 'QTY' || kind === 'CANCELLATION' || kind === 'BACKORDER_REMOVAL') && (
        <CompactInput label="Financial impact" value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="e.g. line 3 → 1 NOS · value −₹14,800" />
      )}
      <CompactInput label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What the customer asked for, and why" error={tried ? errs.reason : null} />
      <EvidenceUpload label="Customer evidence" prompt="Attach the customer’s email / letter (optional)" evidence={customerEv} />
      {kind === 'SUBSTITUTION' && <EvidenceUpload label="Technical approval evidence" prompt="Attach the engineer’s suitability note" evidence={techEv} />}
      {kind && CHANGE_KIND_HELP[kind] && <p className="w-full text-[12px] leading-[16px] text-fg-2">{CHANGE_KIND_HELP[kind]}</p>}
      <InlineAlert tone="neutral" title="Purchase decides">
        {role === 'SALES' ? 'You’ll see the decision on this order.' : 'Decide it from the Change requests card on this order.'}
      </InlineAlert>
      <FormErrors error={m.error} title="The change request wasn't raised" />
    </Drawer>
  );
}

export function CancelDraftDrawer({ open, onClose, order, subtitle, onDone }: {
  open: boolean; onClose: () => void; order: OrderDetail; subtitle: string; onDone: (title: string, body: string) => void;
}) {
  const m = useSupplyMutation(() => supplyApi.cancelDraftOrder(order.id));
  const close = () => { m.reset(); onClose(); };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title="Cancel draft order"
      subtitle={subtitle}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Keep draft</Button>
          <Button kind="danger" busy={m.isPending} icon={<Ic icon={IconX} size={18} />} onClick={() => m.mutate(undefined, { onSuccess: () => { m.reset(); onDone('Draft cancelled', 'The draft order is cancelled. Draft a new one from the quote if the customer still wants it.'); } })}>
            Cancel draft
          </Button>
        </>
      )}
    >
      <InlineAlert tone="neutral" title="What happens">
        The draft is CANCELLED and stays on record. Only a DRAFT can be cancelled here; a verified order needs an approved CANCELLATION change request.
      </InlineAlert>
      <FormErrors error={m.error} title="The draft wasn't cancelled" />
    </Drawer>
  );
}

